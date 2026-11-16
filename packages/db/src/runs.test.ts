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
