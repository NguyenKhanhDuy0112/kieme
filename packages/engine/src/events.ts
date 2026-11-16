import type { RunResult, StepResult } from '@kiemi/schema';

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
    }
  | { type: 'stepEnd'; runId: string; phase: StepPhase; index: number; result: StepResult }
  | { type: 'log'; runId: string; stepId?: string; level: LogLevel; message: string; at: string }
  | { type: 'runEnd'; runId: string; result: RunResult };

export type EngineEventListener = (event: EngineEvent) => void;
