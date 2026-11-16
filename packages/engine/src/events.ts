import type { ArtifactRef, RunResult, StepResult } from '@kiemi/schema';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Which list a step belongs to. */
export type StepPhase = 'steps' | 'cleanup';

/** Events streamed by the engine while a run progresses (plain data, MessagePort-safe). */
export type EngineEvent =
  | { type: 'runStart'; runId: string; testCaseId: string; at: string; stepCount: number }
  | {
      type: 'stepStart';
      runId: string;
      stepId: string;
      phase: StepPhase;
      index: number;
      session: string;
      at: string;
      /** Set for nested steps (if/else, loop, shared step) [D-01, D-03, D-04]. */
      parentStepId?: string;
      /** Step number shown to testers: `5` or `5.2`. */
      stepNo?: string;
    }
  | {
      type: 'stepEnd';
      runId: string;
      phase: StepPhase;
      index: number;
      result: StepResult;
      parentStepId?: string;
    }
  | { type: 'artifact'; runId: string; stepId?: string; artifact: ArtifactRef }
  | { type: 'log'; runId: string; stepId?: string; level: LogLevel; message: string; at: string }
  | { type: 'runEnd'; runId: string; result: RunResult };

export type EngineEventListener = (event: EngineEvent) => void;
