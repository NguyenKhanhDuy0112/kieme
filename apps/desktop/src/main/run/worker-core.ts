import {
  type ActionRegistry,
  createDefaultRegistry,
  type LaunchBrowserOptions,
  type LaunchedBrowser,
  launchBrowser,
  type RunOptions,
  type RunRequest,
  runTestCase,
  toRunError,
} from '@kiemi/engine';
import type { RunResult } from '@kiemi/schema';
import type { HostToWorker, WorkerToHost } from './protocol';

export interface WorkerDeps {
  launch?: (options: LaunchBrowserOptions) => Promise<Pick<LaunchedBrowser, 'browser'>>;
  run?: (request: RunRequest, options: RunOptions) => Promise<RunResult>;
  registry?: ActionRegistry;
}

/**
 * The engine side of a run, free of Electron so it can be unit-tested: one
 * browser for every request, results streamed back as messages [N-05].
 * The utility process entry (`engine-worker.ts`) only wires it to `parentPort`.
 */
export function createEngineWorker(post: (msg: WorkerToHost) => void, deps: WorkerDeps = {}) {
  const launch = deps.launch ?? launchBrowser;
  const run = deps.run ?? runTestCase;
  const registry = deps.registry ?? createDefaultRegistry();
  const abort = new AbortController();
  let started = false;

  async function start(msg: Extract<HostToWorker, { type: 'start' }>): Promise<void> {
    let launched: Pick<LaunchedBrowser, 'browser'> | undefined;
    try {
      launched = await launch({
        settings: msg.launch.settings,
        browsersPath: msg.launch.browsersPath,
        onDownloadProgress: (progress) => post({ type: 'download', progress }),
        signal: abort.signal,
      });
    } catch (err) {
      post({ type: 'fatal', error: toRunError(err, 'BROWSER_LAUNCH_FAILED') });
      return;
    }
    const results: RunResult[] = [];
    try {
      for (const request of msg.requests) {
        if (abort.signal.aborted) break;
        results.push(
          await run(request, {
            registry,
            browser: launched.browser,
            signal: abort.signal,
            onEvent: (event) => post({ type: 'event', event }),
          }),
        );
      }
      post({ type: 'done', results });
    } catch (err) {
      post({ type: 'fatal', error: toRunError(err, 'ENGINE_ERROR') });
    } finally {
      await launched.browser.close().catch(() => undefined);
    }
  }

  return {
    /** Resolves when the message has been fully handled (a `start` = the whole run). */
    async handle(msg: HostToWorker): Promise<void> {
      if (msg.type === 'cancel') {
        abort.abort();
        return;
      }
      if (started) return;
      started = true;
      await start(msg);
    },
  };
}
