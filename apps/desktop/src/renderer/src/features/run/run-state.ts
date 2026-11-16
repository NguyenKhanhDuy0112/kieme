import type { RunError } from '@kiemi/schema';
import type { RunFeedEvent } from '@main/run/run-manager';

export type LiveRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';
export type LiveStepStatus = 'running' | 'passed' | 'failed' | 'skipped';

/** What the editor shows while a run streams in [M4-01]. */
export interface LiveRun {
  runId: string;
  testId: string;
  status: LiveRunStatus;
  /** Chromium download (first run without Edge/Chrome) [N-03]. */
  downloadPercent?: number | undefined;
  /** 1-based dataset row being run, and how many rows there are. */
  row: number;
  rows: number;
  /** Top-level steps of the current row. */
  stepCount: number;
  stepsDone: number;
  /** Step number shown as "Đang chạy bước X". */
  currentStepNo?: string | undefined;
  /** Status of every step (nested ones included) in the current row. */
  steps: Record<string, LiveStepStatus>;
  /** Top-level steps passed / run, over every row. */
  passedTotal: number;
  ranTotal: number;
  /** First hard failure, for the result message. */
  failure?: RunError | undefined;
  /** Run-level error (engine crash, browser, SSH…). */
  error?: RunError | undefined;
  stopping: boolean;
}

export const isFinished = (s: LiveRunStatus) => s !== 'queued' && s !== 'running';

export function initialRun(runId: string, testId: string, rows = 1): LiveRun {
  return {
    runId,
    testId,
    status: 'queued',
    row: 0,
    rows,
    stepCount: 0,
    stepsDone: 0,
    steps: {},
    passedTotal: 0,
    ranTotal: 0,
    stopping: false,
  };
}

/** Applies one event of `runs.events` to the live state (pure). */
export function applyFeed(run: LiveRun, e: RunFeedEvent): LiveRun {
  if (e.runId !== run.runId) return run;
  if (e.type === 'status') {
    return {
      ...run,
      status: e.status,
      ...(e.error ? { error: e.error } : {}),
      ...(isFinished(e.status) ? { currentStepNo: undefined, downloadPercent: undefined } : {}),
    };
  }
  if (e.type === 'download') return { ...run, downloadPercent: e.percent };
  const ev = e.event;
  switch (ev.type) {
    case 'runStart':
      return {
        ...run,
        downloadPercent: undefined,
        row: run.row + 1,
        stepCount: ev.stepCount,
        stepsDone: 0,
        steps: {},
        currentStepNo: undefined,
      };
    case 'stepStart':
      return {
        ...run,
        currentStepNo:
          ev.phase === 'steps' ? (ev.stepNo ?? String(ev.index + 1)) : run.currentStepNo,
        steps: { ...run.steps, [ev.stepId]: 'running' },
      };
    case 'stepEnd': {
      const r = ev.result;
      const top = ev.parentStepId === undefined && ev.phase === 'steps';
      const ran = top && r.status !== 'skipped';
      return {
        ...run,
        steps: { ...run.steps, [r.stepId]: r.status },
        stepsDone: top ? run.stepsDone + 1 : run.stepsDone,
        ranTotal: ran ? run.ranTotal + 1 : run.ranTotal,
        passedTotal: top && r.status === 'passed' ? run.passedTotal + 1 : run.passedTotal,
        failure: run.failure ?? (r.status === 'failed' && !r.soft && r.error ? r.error : undefined),
      };
    }
    case 'runEnd':
      return {
        ...run,
        failure: run.failure ?? ev.result.error,
      };
    default:
      return run;
  }
}
