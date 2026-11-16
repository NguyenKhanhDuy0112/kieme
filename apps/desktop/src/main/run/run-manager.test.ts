// @vitest-environment node
import { createMemoryServices } from '@kiemi/db';
import { ActionRegistry, defineAction } from '@kiemi/engine';
import type { StepInput } from '@kiemi/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createCaller } from '../api/root';
import type { RunFeedEvent, WorkerHandle } from './run-manager';
import { createTestRunManager, InProcessWorker } from './testing';

const seen: string[] = [];
const note = defineAction({
  type: 'note',
  params: z.object({ value: z.string() }),
  ui: { label: 'actions.note', icon: 'pencil', group: 'test' },
  execute: ({ value }) => {
    seen.push(value);
  },
});
const fail = defineAction({
  type: 'fail',
  params: z.object({}),
  ui: { label: 'actions.fail', icon: 'x', group: 'test' },
  execute: () => {
    throw new Error('boom');
  },
});
const pause = defineAction({
  type: 'pause',
  params: z.object({ ms: z.number() }),
  ui: { label: 'actions.pause', icon: 'clock', group: 'test' },
  execute: ({ ms }, ctx) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      ctx.signal.addEventListener('abort', () => {
        clearTimeout(t);
        resolve();
      });
    }),
});
const registry = new ActionRegistry([note, fail, pause]);

function setup(
  steps: StepInput[],
  opts: { dataset?: unknown; spawn?: () => WorkerHandle; cleanup?: StepInput[] } = {},
) {
  seen.length = 0;
  const { services, defaultProjectId } = createMemoryServices();
  const t = services.testCases.create({ projectId: defaultProjectId, name: 'Thử' });
  services.testCases.save(t.id, {
    ...t.content,
    steps,
    cleanup: opts.cleanup ?? [],
    ...(opts.dataset ? { dataset: opts.dataset } : {}),
  });
  const runs = createTestRunManager(services, {
    worker: { registry },
    cancelKillMs: 200,
    ...(opts.spawn ? { spawnWorker: opts.spawn } : {}),
  });
  const caller = createCaller({
    appVersion: '1',
    platform: 'darwin',
    services,
    defaultProjectId,
    runs,
  });
  return { services, runs, caller, testId: t.id };
}

async function collect(iter: AsyncIterable<RunFeedEvent>): Promise<RunFeedEvent[]> {
  const out: RunFeedEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

const finalStatus = (events: RunFeedEvent[]) => {
  const last = events.at(-1);
  return last?.type === 'status' ? last.status : undefined;
};

describe('RunManager [M4-01, N-05]', () => {
  it('runs a test in the worker, streams events and records results', async () => {
    const { services, caller, testId } = setup([
      { id: 's1', action: 'note', params: { value: 'a' } },
      { id: 's2', action: 'note', params: { value: 'b' } },
    ]);
    const { runId } = await caller.runs.start({ testCaseId: testId });
    const events = await collect(await caller.runs.events({ runId }));

    expect(seen).toEqual(['a', 'b']);
    expect(events[0]).toMatchObject({ type: 'status', status: 'queued' });
    expect(events[1]).toMatchObject({ type: 'status', status: 'running' });
    const engine = events.flatMap((e) => (e.type === 'engine' ? [e.event.type] : []));
    expect(engine).toEqual(['runStart', 'stepStart', 'stepEnd', 'stepStart', 'stepEnd', 'runEnd']);
    expect(finalStatus(events)).toBe('passed');

    const run = await caller.runs.get({ runId });
    expect(run).toMatchObject({ status: 'passed', running: false });
    expect(run.artifactDir).toBe(`/tmp/kiemi-test-runs/${runId}`);
    expect(run.cases).toMatchObject([{ testCaseId: testId, status: 'passed', rowIndex: null }]);
    const steps = services.runs.listSteps(run.cases[0]?.id as string);
    expect(steps.map((s) => [s.stepId, s.stepNo, s.status])).toEqual([
      ['s1', '1', 'passed'],
      ['s2', '2', 'passed'],
    ]);
  });

  it('replays past events to a late subscriber', async () => {
    const { runs, caller, testId } = setup([{ id: 's1', action: 'note', params: { value: 'x' } }]);
    const { runId } = await caller.runs.start({ testCaseId: testId });
    await collect(runs.events(runId));
    const again = await collect(runs.events(runId));
    expect(finalStatus(again)).toBe('passed');
    expect(again.some((e) => e.type === 'engine' && e.event.type === 'runEnd')).toBe(true);
  });

  it('records a failed step with its error', async () => {
    const { services, caller, testId } = setup([
      { id: 's1', action: 'fail' },
      { id: 's2', action: 'note', params: { value: 'never' } },
    ]);
    const { runId } = await caller.runs.start({ testCaseId: testId });
    expect(finalStatus(await collect(await caller.runs.events({ runId })))).toBe('failed');
    const [c] = services.runs.listCases(runId);
    expect(c).toMatchObject({ status: 'failed' });
    expect(services.runs.listSteps(c?.id as string)).toMatchObject([
      { stepId: 's1', status: 'failed', error: { message: expect.stringContaining('boom') } },
      { stepId: 's2', status: 'skipped' },
    ]);
    expect(seen).toEqual([]);
  });

  it('runs every dataset row as its own case', async () => {
    const { services, caller, testId } = setup(
      [{ id: 's1', action: 'note', params: { value: '{{row.name}}' } }],
      { dataset: { source: 'table', columns: ['name'], rows: [{ name: 'An' }, { name: 'Bình' }] } },
    );
    const { runId } = await caller.runs.start({ testCaseId: testId });
    expect(finalStatus(await collect(await caller.runs.events({ runId })))).toBe('passed');
    expect(seen).toEqual(['An', 'Bình']);
    expect(services.runs.listCases(runId).map((c) => [c.rowIndex, c.status])).toEqual([
      [0, 'passed'],
      [1, 'passed'],
    ]);
  });

  it('stops on cancel, still running cleanup', async () => {
    const { caller, testId } = setup([{ id: 's1', action: 'pause', params: { ms: 5000 } }], {
      cleanup: [{ id: 'c1', action: 'note', params: { value: 'cleanup' } }],
    });
    const { runId } = await caller.runs.start({ testCaseId: testId });
    const feed = collect(await caller.runs.events({ runId }));
    await new Promise((r) => setTimeout(r, 50));
    expect(await caller.runs.cancel({ runId })).toEqual({ cancelled: true });
    expect(finalStatus(await feed)).toBe('cancelled');
    expect(seen).toEqual(['cleanup']);
    expect(await caller.runs.cancel({ runId })).toEqual({ cancelled: false });
  });

  it('marks the run as error when the engine process crashes', async () => {
    let worker: InProcessWorker | undefined;
    const { services, runs, caller, testId } = setup(
      [{ id: 's1', action: 'pause', params: { ms: 5000 } }],
      {
        spawn: () => {
          worker = new InProcessWorker({
            registry,
            launch: async () => ({ browser: { close: async () => undefined } as never }),
          });
          return worker;
        },
      },
    );
    const { runId } = await caller.runs.start({ testCaseId: testId });
    const feed = collect(runs.events(runId));
    await new Promise((r) => setTimeout(r, 50));
    worker?.crash(3);
    const events = await feed;
    expect(events.at(-1)).toMatchObject({
      type: 'status',
      status: 'error',
      error: { code: 'ENGINE_CRASHED', details: { exitCode: 3 } },
    });
    expect(services.runs.get(runId).status).toBe('error');
    expect(services.runs.listCases(runId)[0]).toMatchObject({ status: 'error' });
    // The app keeps working: another run goes through.
    expect(runs.isRunning(runId)).toBe(false);
  });

  it('reports a browser launch failure', async () => {
    const { services, runs, testId } = setup([
      { id: 's1', action: 'note', params: { value: 'a' } },
    ]);
    const failing = createTestRunManager(services, {
      worker: {
        registry,
        launch: async () => {
          throw new Error('no browser');
        },
      },
    });
    void runs;
    const { runId } = failing.start({ testCaseId: testId });
    const events = await collect(failing.events(runId));
    expect(events.at(-1)).toMatchObject({
      status: 'error',
      error: { code: 'BROWSER_LAUNCH_FAILED' },
    });
  });

  it('opens the SSH tunnel before the run and closes it after', async () => {
    const { services, testId } = setup([{ id: 's1', action: 'note', params: { value: 'a' } }]);
    const env = services.environments.list(services.testCases.get(testId).projectId)[0];
    services.environments.update(env?.id as string, {
      ssh: {
        enabled: true,
        target: {
          host: 'jump.local',
          port: 22,
          username: 'u',
          auth: 'password',
          passwordSecret: 'p',
        },
      },
    });
    const log: string[] = [];
    let proxy: unknown;
    const runs = createTestRunManager(services, {
      worker: {
        registry,
        launch: async () => ({ browser: { close: async () => undefined } as never }),
        run: async (req, o) => {
          proxy = req.env?.proxy;
          const { runTestCase } = await import('@kiemi/engine');
          return runTestCase(req, o);
        },
      },
      openTunnel: async () => {
        log.push('open');
        return {
          proxyUrl: 'socks5://127.0.0.1:1080',
          close: async () => {
            log.push('close');
          },
        };
      },
    });
    const { runId } = runs.start({ testCaseId: testId });
    await collect(runs.events(runId));
    await new Promise((r) => setTimeout(r, 0));
    expect(proxy).toEqual({ server: 'socks5://127.0.0.1:1080', bypass: [] });
    expect(log).toEqual(['open', 'close']);
  });
});
