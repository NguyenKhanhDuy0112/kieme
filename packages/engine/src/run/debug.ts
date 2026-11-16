import type { StepPhase } from '../events';

/** Step about to run, as seen by a debugger. */
export interface StepGate {
  stepId: string;
  stepNo: string;
  phase: StepPhase;
  parentStepId?: string | undefined;
}

/** Awaited before every step; resolve to let the step run [H-03]. */
export interface RunDebugger {
  beforeStep(step: StepGate, signal: AbortSignal): Promise<void>;
}

export interface DebugListener {
  onPause?(step: StepGate): void;
  onResume?(step: StepGate): void;
}

/**
 * Pause / resume / step-over / breakpoints for a run [H-03, S-03].
 * - `pause()`: stops before the next step.
 * - `step()`: while paused, runs exactly one step then pauses again.
 * - Breakpoints: step ids that pause the run before they start.
 * Cleanup steps never pause (they must always run).
 */
export class DebugController implements RunDebugger {
  #breakpoints = new Set<string>();
  #pauseRequested = false;
  #stepping = false;
  #release: (() => void) | undefined;
  #paused: StepGate | undefined;
  readonly #listener: DebugListener;

  constructor(
    options: { breakpoints?: Iterable<string>; pauseAtStart?: boolean } = {},
    listener: DebugListener = {},
  ) {
    this.#breakpoints = new Set(options.breakpoints ?? []);
    this.#pauseRequested = options.pauseAtStart === true;
    this.#listener = listener;
  }

  get paused(): StepGate | undefined {
    return this.#paused;
  }

  setBreakpoints(ids: Iterable<string>): void {
    this.#breakpoints = new Set(ids);
  }

  pause(): void {
    this.#pauseRequested = true;
  }

  resume(): void {
    this.#pauseRequested = false;
    this.#stepping = false;
    this.#release?.();
  }

  /** Runs the next step, then pauses again. */
  step(): void {
    this.#stepping = true;
    this.#release?.();
  }

  async beforeStep(step: StepGate, signal: AbortSignal): Promise<void> {
    if (step.phase === 'cleanup' || signal.aborted) return;
    const shouldPause =
      this.#pauseRequested || this.#stepping || this.#breakpoints.has(step.stepId);
    if (!shouldPause) return;
    this.#stepping = false;
    this.#pauseRequested = false;
    this.#paused = step;
    this.#listener.onPause?.(step);
    await new Promise<void>((resolve) => {
      const done = () => {
        signal.removeEventListener('abort', done);
        this.#release = undefined;
        resolve();
      };
      this.#release = done;
      signal.addEventListener('abort', done);
    });
    this.#paused = undefined;
    this.#listener.onResume?.(step);
  }
}
