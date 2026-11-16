import type {
  Dataset,
  Env,
  RunError,
  RunResult,
  RunStatus,
  Secrets,
  Step,
  StepResult,
  TestCase,
} from '@kiemi/schema';
import type { Browser } from 'playwright-core';
import type { z } from 'zod';
import { SessionPages, type ViewportSettings } from './browser';
import type { ActionContext, ActionRegistry } from './define-action';
import { EngineError, toRunError } from './errors';
import type { EngineEvent, EngineEventListener, LogLevel, StepPhase } from './events';

/** Default per-step timeout when neither the step nor the request sets one [D-07]. */
export const DEFAULT_STEP_TIMEOUT_MS = 10_000;

export interface RunRequest {
  runId: string;
  testCase: TestCase;
  dataset?: Dataset;
  env?: Env;
  secrets?: Secrets;
  rowIndex?: number;
  options?: {
    /** Fallback timeout for steps without `timeoutMs`. */
    defaultStepTimeoutMs?: number;
    /** Screen size / device emulation for every session [G-03]. */
    viewport?: ViewportSettings;
  };
}

export interface RunOptions {
  registry: ActionRegistry;
  onEvent?: EngineEventListener;
  /** Launched browser (see `launchBrowser`); each session gets its own context. */
  browser?: Browser;
  /** Abort to cancel the run; cleanup still runs. */
  signal?: AbortSignal;
  /** Injectable clock for tests. */
  now?: () => Date;
}

type Outcome = { result: StepResult; stop: boolean };

/** Runs a test case's steps sequentially, then its cleanup steps, streaming events. */
export async function runTestCase(request: RunRequest, options: RunOptions): Promise<RunResult> {
  const { runId, testCase } = request;
  const now = options.now ?? (() => new Date());
  const runSignal = options.signal ?? new AbortController().signal;
  const defaultTimeout = request.options?.defaultStepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const pages = new SessionPages(options.browser, request.options?.viewport);

  const emit = (event: EngineEvent) => {
    try {
      options.onEvent?.(event);
    } catch {
      // A broken listener must never break the run.
    }
  };
  const log = (level: LogLevel, message: string, stepId?: string) =>
    emit(
      stepId === undefined
        ? { type: 'log', runId, level, message, at: now().toISOString() }
        : { type: 'log', runId, stepId, level, message, at: now().toISOString() },
    );

  const runStarted = now();
  emit({
    type: 'runStart',
    runId,
    testCaseId: testCase.id,
    at: runStarted.toISOString(),
    stepCount: testCase.steps.length,
  });

  const skipped = (step: Step, error?: RunError): StepResult => ({
    stepId: step.id,
    session: step.session,
    status: 'skipped',
    soft: false,
    startedAt: now().toISOString(),
    durationMs: 0,
    artifacts: [],
    ...(error ? { error } : {}),
  });

  const runStep = async (step: Step, index: number, phase: StepPhase, signal: AbortSignal) => {
    if (!step.enabled) return { result: skipped(step), stop: false };
    if (signal.aborted) {
      return {
        result: skipped(step, { code: 'RUN_CANCELLED', message: 'Run was cancelled' }),
        stop: true,
      };
    }

    const started = now();
    const startMs = performance.now();
    emit({
      type: 'stepStart',
      runId,
      stepId: step.id,
      phase,
      index,
      session: step.session,
      at: started.toISOString(),
    });

    const timeoutMs = step.timeoutMs ?? defaultTimeout;
    let error: RunError | undefined;
    let cancelled = false;
    try {
      await executeStep(step, index, timeoutMs, signal, options.registry, pages, (message, level) =>
        log(level ?? 'info', message, step.id),
      );
    } catch (err) {
      error = toRunError(err);
      cancelled = error.code === 'RUN_CANCELLED';
    }

    const result: StepResult = {
      stepId: step.id,
      session: step.session,
      status: cancelled ? 'skipped' : error ? 'failed' : 'passed',
      soft: error !== undefined && !cancelled && step.mode === 'soft',
      startedAt: started.toISOString(),
      durationMs: Math.max(0, performance.now() - startMs),
      artifacts: [],
      ...(error ? { error } : {}),
    };
    if (error) log(cancelled ? 'warn' : 'error', error.message, step.id);
    return { result, stop: cancelled || (error !== undefined && step.mode === 'hard') };
  };

  const finish = (outcome: Outcome, phase: StepPhase, index: number, list: StepResult[]) => {
    list.push(outcome.result);
    emit({ type: 'stepEnd', runId, phase, index, result: outcome.result });
  };

  const steps: StepResult[] = [];
  const cleanup: StepResult[] = [];
  let status: RunStatus = 'passed';
  let runError: RunError | undefined;

  try {
    let stopped = false;
    for (const [index, step] of testCase.steps.entries()) {
      if (stopped) {
        finish({ result: skipped(step), stop: true }, 'steps', index, steps);
        continue;
      }
      const outcome = await runStep(step, index, 'steps', runSignal);
      finish(outcome, 'steps', index, steps);
      stopped = outcome.stop;
    }

    // Cleanup always runs [D-05], even after a failure or cancel, with its own signal.
    const cleanupSignal = new AbortController().signal;
    for (const [index, step] of testCase.cleanup.entries()) {
      finish(await runStep(step, index, 'cleanup', cleanupSignal), 'cleanup', index, cleanup);
    }

    if (runSignal.aborted) status = 'cancelled';
    else if ([...steps, ...cleanup].some((r) => r.status === 'failed')) status = 'failed';
  } catch (err) {
    status = 'error';
    runError = toRunError(err, 'ENGINE_ERROR');
    log('error', runError.message);
  } finally {
    await pages.closeAll();
  }

  const result: RunResult = {
    runId,
    testCaseId: testCase.id,
    ...(request.rowIndex === undefined ? {} : { rowIndex: request.rowIndex }),
    status,
    startedAt: runStarted.toISOString(),
    durationMs: Math.max(0, now().getTime() - runStarted.getTime()),
    steps,
    cleanup,
    ...(runError ? { error: runError } : {}),
  };
  emit({ type: 'runEnd', runId, result });
  return result;
}

/** Validates params, then runs the action racing a timeout and the run's cancel signal. */
async function executeStep(
  step: Step,
  index: number,
  timeoutMs: number,
  runSignal: AbortSignal,
  registry: ActionRegistry,
  pages: SessionPages,
  log: ActionContext['log'],
): Promise<void> {
  const stepNo = index + 1;
  const action = registry.get(step.action);
  if (!action) {
    throw new EngineError('UNKNOWN_ACTION', `Step ${stepNo}: unknown action "${step.action}"`, {
      step: stepNo,
      action: step.action,
    });
  }
  const parsed = action.params.safeParse(step.params);
  if (!parsed.success) {
    throw new EngineError('INVALID_PARAMS', `Step ${stepNo}: invalid parameters`, {
      step: stepNo,
      action: step.action,
      issues: parsed.error.issues.map((i: z.core.$ZodIssue) => ({
        path: i.path.map(String),
        message: i.message,
      })),
    });
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onCancel: (() => void) | undefined;

  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new EngineError(
        'STEP_TIMEOUT',
        `Step ${stepNo}: did not finish within ${timeoutMs / 1000} seconds`,
        { step: stepNo, timeoutMs },
      );
      controller.abort(err);
      reject(err);
    }, timeoutMs);
    onCancel = () => {
      const err = new EngineError('RUN_CANCELLED', 'Run was cancelled', { step: stepNo });
      controller.abort(err);
      reject(err);
    };
    runSignal.addEventListener('abort', onCancel, { once: true });
  });

  const ctx: ActionContext = {
    step,
    session: step.session,
    timeoutMs,
    signal: controller.signal,
    log,
    page: () => pages.page(step.session),
    context: () => pages.context(step.session),
  };

  try {
    await Promise.race([Promise.resolve().then(() => action.execute(parsed.data, ctx)), guard]);
  } finally {
    clearTimeout(timer);
    if (onCancel) runSignal.removeEventListener('abort', onCancel);
  }
}
