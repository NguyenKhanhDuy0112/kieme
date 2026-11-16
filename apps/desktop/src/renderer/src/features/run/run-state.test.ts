import type { EngineEvent } from '@kiemi/engine';
import type { RunFeedEvent } from '@main/run/run-manager';
import { describe, expect, it } from 'vitest';
import { applyFeed, initialRun, isFinished } from './run-state';

const at = '2026-11-16T00:00:00.000Z';
const eng = (event: EngineEvent): RunFeedEvent => ({
  type: 'engine',
  runId: 'r1',
  runCaseId: 'c1',
  event,
});
const end = (stepId: string, status: 'passed' | 'failed' | 'skipped', parentStepId?: string) =>
  eng({
    type: 'stepEnd',
    runId: 'c1',
    phase: 'steps',
    index: 0,
    ...(parentStepId ? { parentStepId } : {}),
    result: {
      stepId,
      session: 'default',
      status,
      soft: false,
      startedAt: at,
      durationMs: 1,
      artifacts: [],
      ...(status === 'failed' ? { error: { code: 'STEP_FAILED', message: 'x' } } : {}),
    },
  });

describe('live run state [M4-01]', () => {
  it('follows steps, nested steps and the final status', () => {
    const events: RunFeedEvent[] = [
      { type: 'status', runId: 'r1', status: 'running' },
      { type: 'download', runId: 'r1', percent: 40 },
      eng({ type: 'runStart', runId: 'c1', testCaseId: 't', at, stepCount: 2 }),
      eng({
        type: 'stepStart',
        runId: 'c1',
        stepId: 's1',
        phase: 'steps',
        index: 0,
        session: 'default',
        at,
        stepNo: '1',
      }),
      end('s1.a', 'passed', 's1'),
      end('s1', 'passed'),
      eng({
        type: 'stepStart',
        runId: 'c1',
        stepId: 's2',
        phase: 'steps',
        index: 1,
        session: 'default',
        at,
        stepNo: '2',
      }),
    ];
    let run = initialRun('r1', 't');
    for (const e of events) run = applyFeed(run, e);
    expect(run).toMatchObject({
      status: 'running',
      row: 1,
      stepCount: 2,
      stepsDone: 1,
      currentStepNo: '2',
      downloadPercent: undefined,
      steps: { s1: 'passed', 's1.a': 'passed', s2: 'running' },
    });

    run = applyFeed(run, end('s2', 'failed'));
    run = applyFeed(run, { type: 'status', runId: 'r1', status: 'failed' });
    expect(isFinished(run.status)).toBe(true);
    expect(run).toMatchObject({
      passedTotal: 1,
      ranTotal: 2,
      failure: { code: 'STEP_FAILED' },
      currentStepNo: undefined,
    });
  });

  it('ignores events of another run and keeps engine errors', () => {
    const run = initialRun('r1', 't');
    expect(applyFeed(run, { type: 'status', runId: 'other', status: 'passed' })).toBe(run);
    const crashed = applyFeed(run, {
      type: 'status',
      runId: 'r1',
      status: 'error',
      error: { code: 'ENGINE_CRASHED', message: 'gone' },
    });
    expect(crashed.error?.code).toBe('ENGINE_CRASHED');
  });
});
