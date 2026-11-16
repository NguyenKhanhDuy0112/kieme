import type { DownloadProgress, EngineEvent, LaunchSettingsInput, RunRequest } from '@kiemi/engine';
import type { RunError, RunResult } from '@kiemi/schema';

/**
 * Messages between the main process and the engine utility process [N-05].
 * Plain structured-cloneable data only (no functions, no class instances).
 */
export type HostToWorker =
  | {
      type: 'start';
      /** One request per test case / dataset row, run one after another. */
      requests: RunRequest[];
      launch: { settings: LaunchSettingsInput; browsersPath: string };
      /** Stop the remaining tests after the first one that does not pass [H-04]. */
      stopOnFailure?: boolean;
      /** Breakpoints (step ids) and "pause before the first step" [H-03]. */
      debug?: { breakpoints?: string[]; pauseAtStart?: boolean };
    }
  | { type: 'cancel' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' }
  | { type: 'breakpoints'; stepIds: string[] };

export type WorkerToHost =
  | { type: 'ready' }
  | { type: 'download'; progress: DownloadProgress }
  | { type: 'event'; event: EngineEvent }
  /** Paused before a step, or running again [H-03]. */
  | {
      type: 'debug';
      state: 'paused' | 'running';
      runCaseId: string;
      stepId: string;
      stepNo: string;
    }
  /** All requests finished (each one's result also came as a `runEnd` event). */
  | { type: 'done'; results: RunResult[] }
  /** The run could not start or stopped outside a test case (e.g. browser launch). */
  | { type: 'fatal'; error: RunError };
