import { describe, expect, it } from 'vitest';
import { createMemoryServices } from './testing';

describe('run records [M4-01]', () => {
  it('stores a run, its cases, steps and artifacts', () => {
    const { services: s, defaultProjectId } = createMemoryServices();
    const t = s.testCases.create({ projectId: defaultProjectId, name: 'Đăng nhập' });
    const run = s.runs.create({ projectId: defaultProjectId, artifactDir: '/tmp/r1' });
    expect(run).toMatchObject({ status: 'queued', trigger: 'manual', startedAt: null });

    expect(s.runs.markRunning(run.id).status).toBe('running');
    const c = s.runs.addCase({ runId: run.id, testCaseId: t.id, rowIndex: 1 });
    s.runs.startCase(c.id);
    const step = s.runs.recordStep({
      runCaseId: c.id,
      phase: 'steps',
      stepNo: '1',
      session: 'default',
      result: {
        stepId: 's1',
        session: 'default',
        status: 'failed',
        soft: false,
        startedAt: new Date().toISOString(),
        durationMs: 12.4,
        error: { code: 'ELEMENT_NOT_FOUND', message: 'not found', details: { stepNo: 1 } },
        artifacts: [],
      },
    });
    s.runs.addArtifact({
      runId: run.id,
      runCaseId: c.id,
      runStepId: step.id,
      artifact: { kind: 'screenshot', path: 'shot.png' },
    });
    s.runs.finishCase(c.id, {
      status: 'failed',
      durationMs: 40,
      error: { code: 'ELEMENT_NOT_FOUND', message: 'not found' },
    });
    const done = s.runs.finish(run.id, 'failed');

    expect(done.status).toBe('failed');
    expect(done.durationMs).toBeGreaterThanOrEqual(0);
    expect(done.finishedAt).toBeInstanceOf(Date);
    expect(s.runs.listCases(run.id)).toMatchObject([
      { status: 'failed', rowIndex: 1, durationMs: 40, error: { code: 'ELEMENT_NOT_FOUND' } },
    ]);
    expect(s.runs.listSteps(c.id)).toMatchObject([
      { stepId: 's1', status: 'failed', durationMs: 12, error: { details: { stepNo: 1 } } },
    ]);
    expect(s.runs.listArtifacts(run.id)).toMatchObject([{ kind: 'screenshot', path: 'shot.png' }]);
    expect(s.runs.list(defaultProjectId).map((r) => r.id)).toEqual([run.id]);
  });

  it('marks unfinished cases on crash', () => {
    const { services: s, defaultProjectId } = createMemoryServices();
    const run = s.runs.create({ projectId: defaultProjectId, artifactDir: '/tmp/r2' });
    const c = s.runs.addCase({ runId: run.id, testCaseId: 'x' });
    s.runs.abortCase(c.id, 'error', { code: 'ENGINE_CRASHED', message: 'crashed' });
    expect(s.runs.listCases(run.id)[0]).toMatchObject({
      status: 'error',
      rowIndex: null,
      error: { code: 'ENGINE_CRASHED' },
    });
  });
});

describe('run history and detail [S-04, S-05]', () => {
  it('lists runs newest first with counts and filters', () => {
    let t = 0;
    const { services: s, defaultProjectId: p } = createMemoryServices();
    const a = s.testCases.create({ projectId: p, name: 'A' });
    const b = s.testCases.create({ projectId: p, name: 'B' });
    const mk = (testIds: string[], status: 'passed' | 'failed', suiteId?: string) => {
      const r = s.runs.create({
        projectId: p,
        artifactDir: `/r${t++}`,
        ...(suiteId ? { suiteId } : {}),
        target: { kind: 'test', testCaseId: testIds[0] as string, name: 'x' },
      });
      for (const id of testIds) {
        const c = s.runs.addCase({ runId: r.id, testCaseId: id });
        s.runs.finishCase(c.id, { status, durationMs: 1 });
      }
      return s.runs.finish(r.id, status);
    };
    const r1 = mk([a.id], 'passed');
    const r2 = mk([a.id, b.id], 'failed', 'suite-1');
    const h = s.runs.history(p);
    expect(h.map((r) => r.id)).toEqual([r2.id, r1.id]);
    expect(h[0]?.counts).toMatchObject({ total: 2, failed: 2 });
    expect(h[0]?.target).toMatchObject({ kind: 'test', name: 'x' });
    expect(s.runs.history(p, { testCaseId: b.id }).map((r) => r.id)).toEqual([r2.id]);
    expect(s.runs.history(p, { status: 'passed' }).map((r) => r.id)).toEqual([r1.id]);
    expect(s.runs.history(p, { suiteId: 'suite-1' }).map((r) => r.id)).toEqual([r2.id]);

    const d = s.runs.detail(r2.id);
    expect(d.cases).toHaveLength(2);
    expect(d.cases[0]).toMatchObject({ steps: [], artifacts: [] });
  });
});
