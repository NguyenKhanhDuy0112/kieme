import { join } from 'node:path';
import type { RunRowStatus, Services } from '@kiemi/db';
import type { EngineEvent, RunRequest, StepPhase } from '@kiemi/engine';
import type { Dataset, Env, RunError, RunResult, Secrets, TestCase } from '@kiemi/schema';
import type { HostToWorker, WorkerToHost } from './protocol';

/** One engine utility process, as seen by the main process. */
export interface WorkerHandle {
  send(msg: HostToWorker): void;
  onMessage(listener: (msg: WorkerToHost) => void): void;
  /** Fires once when the process is gone (normal exit, kill or crash). */
  onExit(listener: (code: number) => void): void;
  kill(): void;
}

export interface TunnelLike {
  readonly proxyUrl: string;
  close(): Promise<void>;
}

export interface RunManagerDeps {
  services: Services;
  spawnWorker: () => WorkerHandle;
  /** Default parent folder of `<runId>/` artifact folders (`userData/runs`). */
  artifactsRoot: string;
  /** Where a downloaded Chromium lives (`userData/browsers`). */
  browsersPath: string;
  openTunnel?: (env: Env, secrets: Secrets) => Promise<TunnelLike>;
  /** Grace period after Stop before the engine process is killed. */
  cancelKillMs?: number;
}

export type FinalStatus = Exclude<RunRowStatus, 'queued' | 'running'>;

/** What the renderer receives while a run progresses [N-05]. */
export type RunFeedEvent =
  | { type: 'status'; runId: string; status: RunRowStatus; error?: RunError }
  | { type: 'download'; runId: string; percent: number }
  | { type: 'engine'; runId: string; runCaseId: string; event: EngineEvent };

export interface StartRunInput {
  testCaseId: string;
  /** `undefined` = first environment of the project; `null` = none. */
  environmentId?: string | null | undefined;
  /** Only this dataset row; otherwise every row runs. */
  rowIndex?: number | undefined;
}

interface StepInfo {
  phase: StepPhase;
  stepNo: string;
  session: string;
  parentStepId?: string | undefined;
}

interface ActiveRun {
  runId: string;
  history: RunFeedEvent[];
  listeners: Set<() => void>;
  finished: boolean;
  cancelRequested: boolean;
  worker?: WorkerHandle;
  tunnel?: TunnelLike;
  caseIds: Set<string>;
  openCases: Set<string>;
  steps: Map<string, StepInfo>;
}

const KEEP_FINISHED = 20;

function datasetOf(tc: TestCase, services: Services): Dataset | undefined {
  const src = tc.dataset;
  if (!src) return undefined;
  if (src.source === 'table')
    return { id: 'table', name: 'table', columns: src.columns, rows: src.rows };
  if (src.source === 'saved') return services.datasets.forRun(src.datasetId);
  // Excel/CSV files are imported into a table / saved dataset by the editor.
  return undefined;
}

function overall(results: RunResult[], cancelled: boolean): FinalStatus {
  if (results.some((r) => r.status === 'error')) return 'error';
  if (cancelled || results.some((r) => r.status === 'cancelled')) return 'cancelled';
  if (results.some((r) => r.status === 'failed')) return 'failed';
  return 'passed';
}

/**
 * Starts runs in the engine utility process, records progress in the DB and
 * streams it to the renderer [N-05, M4-01]. An engine crash marks the run
 * `error`; the app keeps working.
 */
export class RunManager {
  readonly #d: RunManagerDeps;
  readonly #runs = new Map<string, ActiveRun>();

  constructor(deps: RunManagerDeps) {
    this.#d = deps;
  }

  /** Validates and records the run, then runs it in the background. Returns the run id. */
  start(input: StartRunInput): { runId: string } {
    const s = this.#d.services;
    const row = s.testCases.get(input.testCaseId);
    const testCase = row.content;
    const environmentId =
      input.environmentId === undefined
        ? (s.environments.list(row.projectId)[0]?.id ?? null)
        : input.environmentId;
    const { env, secrets } = environmentId
      ? s.environments.forRun(environmentId)
      : { env: undefined, secrets: {} };
    const dataset = datasetOf(testCase, s);
    const rows =
      input.rowIndex !== undefined
        ? [input.rowIndex]
        : dataset?.rows.length
          ? dataset.rows.map((_, i) => i)
          : [undefined];
    const settings = s.settings.getAll();
    const sharedSteps = s.sharedSteps.forRun(row.projectId);

    const run = s.runs.create({
      projectId: row.projectId,
      environmentId,
      artifactDir: '',
    });
    const artifactDir = join(settings.resultsDir || this.#d.artifactsRoot, run.id);
    s.runs.repo.update(run.id, { artifactDir });

    const active: ActiveRun = {
      runId: run.id,
      history: [],
      listeners: new Set(),
      finished: false,
      cancelRequested: false,
      caseIds: new Set(),
      openCases: new Set(),
      steps: new Map(),
    };
    this.#runs.set(run.id, active);
    this.#trim();

    const requests: RunRequest[] = rows.map((rowIndex) => {
      const c = s.runs.addCase({ runId: run.id, testCaseId: testCase.id, rowIndex });
      active.caseIds.add(c.id);
      active.openCases.add(c.id);
      return {
        runId: c.id,
        testCase,
        ...(env ? { env } : {}),
        secrets,
        ...(dataset ? { dataset } : {}),
        ...(rowIndex === undefined ? {} : { rowIndex }),
        sharedSteps,
        options: {
          defaultStepTimeoutMs: settings.defaultTimeoutSec * 1000,
          artifacts: {
            dir: rows.length > 1 ? join(artifactDir, `row-${(rowIndex ?? 0) + 1}`) : artifactDir,
            screenshots: 'onFailure',
          },
        },
      };
    });

    this.#publish(active, { type: 'status', runId: run.id, status: 'queued' });
    void this.#execute(active, requests, env, secrets, {
      browser: settings.browser,
      headless: settings.headless,
    });
    return { runId: run.id };
  }

  /** Stop button: the engine still runs cleanup steps, then the run ends `cancelled`. */
  cancel(runId: string): boolean {
    const active = this.#runs.get(runId);
    if (!active || active.finished) return false;
    active.cancelRequested = true;
    if (active.worker) {
      active.worker.send({ type: 'cancel' });
      const w = active.worker;
      setTimeout(() => {
        if (!active.finished) w.kill();
      }, this.#d.cancelKillMs ?? 15_000).unref?.();
    }
    return true;
  }

  isRunning(runId: string): boolean {
    const a = this.#runs.get(runId);
    return a !== undefined && !a.finished;
  }

  /** Every event of the run so far, then live ones, until the run ends. */
  async *events(runId: string, signal?: AbortSignal): AsyncGenerator<RunFeedEvent> {
    const active = this.#runs.get(runId);
    if (!active) return;
    let next = 0;
    let wake: (() => void) | undefined;
    const notify = () => wake?.();
    active.listeners.add(notify);
    signal?.addEventListener('abort', notify);
    try {
      while (!signal?.aborted) {
        while (next < active.history.length) {
          yield active.history[next++] as RunFeedEvent;
        }
        if (active.finished) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = undefined;
      }
    } finally {
      active.listeners.delete(notify);
      signal?.removeEventListener('abort', notify);
    }
  }

  /** Stops every run (app quit). */
  async shutdown(): Promise<void> {
    for (const a of this.#runs.values()) {
      if (!a.finished) {
        a.cancelRequested = true;
        a.worker?.kill();
      }
      await a.tunnel?.close().catch(() => undefined);
    }
  }

  async #execute(
    active: ActiveRun,
    requests: RunRequest[],
    env: Env | undefined,
    secrets: Secrets,
    launch: { browser: 'auto' | 'msedge' | 'chrome' | 'chromium'; headless: boolean },
  ): Promise<void> {
    const s = this.#d.services;
    s.runs.markRunning(active.runId);
    this.#publish(active, { type: 'status', runId: active.runId, status: 'running' });

    let reqs = requests;
    if (env?.ssh?.enabled && this.#d.openTunnel) {
      try {
        const tunnel = await this.#d.openTunnel(env, secrets);
        active.tunnel = tunnel;
        const proxied: Env = {
          ...env,
          proxy: { server: tunnel.proxyUrl, bypass: env.proxy?.bypass ?? [] },
        };
        reqs = requests.map((r) => ({ ...r, env: proxied }));
      } catch (err) {
        this.#finish(active, 'error', {
          code: 'SSH_FAILED',
          message: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }
    if (active.cancelRequested) {
      this.#finish(active, 'cancelled');
      return;
    }

    let worker: WorkerHandle;
    try {
      worker = this.#d.spawnWorker();
    } catch (err) {
      this.#finish(active, 'error', {
        code: 'ENGINE_CRASHED',
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    active.worker = worker;
    worker.onMessage((msg) => this.#onMessage(active, msg));
    worker.onExit((code) => {
      if (active.finished) return;
      if (active.cancelRequested) this.#finish(active, 'cancelled');
      else
        this.#finish(active, 'error', {
          code: 'ENGINE_CRASHED',
          message: `Engine process exited with code ${code}`,
          details: { exitCode: code },
        });
    });
    worker.send({
      type: 'start',
      requests: reqs,
      launch: { settings: launch, browsersPath: this.#d.browsersPath },
    });
  }

  #onMessage(active: ActiveRun, msg: WorkerToHost): void {
    if (active.finished) return;
    const runId = active.runId;
    switch (msg.type) {
      case 'ready':
        return;
      case 'download':
        this.#publish(active, { type: 'download', runId, percent: msg.progress.percent });
        return;
      case 'event':
        this.#record(active, msg.event);
        if (active.caseIds.has(msg.event.runId)) {
          this.#publish(active, {
            type: 'engine',
            runId,
            runCaseId: msg.event.runId,
            event: msg.event,
          });
        }
        return;
      case 'done':
        this.#finish(active, overall(msg.results, active.cancelRequested));
        return;
      case 'fatal':
        this.#finish(active, active.cancelRequested ? 'cancelled' : 'error', msg.error);
        return;
    }
  }

  /** Persists engine progress (run_cases / run_steps / artifacts). */
  #record(active: ActiveRun, e: EngineEvent): void {
    const s = this.#d.services.runs;
    const caseId = e.runId;
    if (!active.caseIds.has(caseId)) return;
    try {
      switch (e.type) {
        case 'runStart':
          s.startCase(caseId);
          return;
        case 'stepStart':
          active.steps.set(`${caseId}:${e.stepId}`, {
            phase: e.phase,
            stepNo: e.stepNo ?? String(e.index + 1),
            session: e.session,
            parentStepId: e.parentStepId,
          });
          return;
        case 'stepEnd': {
          const info = active.steps.get(`${caseId}:${e.result.stepId}`);
          const step = s.recordStep({
            runCaseId: caseId,
            result: e.result,
            phase: info?.phase ?? e.phase,
            stepNo: info?.stepNo ?? String(e.index + 1),
            session: info?.session ?? e.result.session,
            parentStepId: e.parentStepId ?? info?.parentStepId,
          });
          for (const artifact of e.result.artifacts) {
            s.addArtifact({ runId: active.runId, runCaseId: caseId, runStepId: step.id, artifact });
          }
          return;
        }
        case 'runEnd':
          s.finishCase(caseId, e.result);
          for (const artifact of e.result.artifacts) {
            s.addArtifact({ runId: active.runId, runCaseId: caseId, artifact });
          }
          active.openCases.delete(caseId);
          return;
        default:
          return;
      }
    } catch {
      // A failed DB write must not break the live view; the result still streams.
    }
  }

  #finish(active: ActiveRun, status: FinalStatus, error?: RunError): void {
    if (active.finished) return;
    const s = this.#d.services.runs;
    for (const caseId of active.openCases) {
      try {
        s.abortCase(caseId, status === 'cancelled' ? 'cancelled' : 'error', error);
      } catch {
        // ignore
      }
    }
    active.openCases.clear();
    try {
      s.finish(active.runId, status);
    } catch {
      // ignore: the feed below still tells the UI.
    }
    active.finished = true;
    this.#publish(active, {
      type: 'status',
      runId: active.runId,
      status,
      ...(error ? { error } : {}),
    });
    active.worker?.kill();
    void active.tunnel?.close().catch(() => undefined);
  }

  #publish(active: ActiveRun, event: RunFeedEvent): void {
    active.history.push(event);
    for (const l of active.listeners) l();
  }

  /** Keeps the event history of only the latest finished runs in memory. */
  #trim(): void {
    const finished = [...this.#runs.values()].filter((r) => r.finished);
    for (const r of finished.slice(0, Math.max(0, finished.length - KEEP_FINISHED))) {
      this.#runs.delete(r.runId);
    }
  }
}
