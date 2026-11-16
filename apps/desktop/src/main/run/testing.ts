import type { Services } from '@kiemi/db';
import type { HostToWorker, WorkerToHost } from './protocol';
import { RunManager, type RunManagerDeps, type WorkerHandle } from './run-manager';
import { createEngineWorker, type WorkerDeps } from './worker-core';

/**
 * In-process stand-in for the utility process: runs `worker-core` and passes
 * messages asynchronously through structured clone, like the real channel.
 */
export class InProcessWorker implements WorkerHandle {
  readonly sent: HostToWorker[] = [];
  #onMessage: ((msg: WorkerToHost) => void) | undefined;
  #onExit: ((code: number) => void) | undefined;
  #alive = true;
  readonly #core: ReturnType<typeof createEngineWorker>;

  constructor(deps: WorkerDeps) {
    this.#core = createEngineWorker((msg) => {
      const copy = structuredClone(msg);
      setTimeout(() => {
        if (this.#alive) this.#onMessage?.(copy);
      }, 0);
    }, deps);
  }

  send(msg: HostToWorker): void {
    this.sent.push(msg);
    const copy = structuredClone(msg);
    setTimeout(() => {
      if (this.#alive) void this.#core.handle(copy);
    }, 0);
  }
  onMessage(listener: (msg: WorkerToHost) => void): void {
    this.#onMessage = listener;
  }
  onExit(listener: (code: number) => void): void {
    this.#onExit = listener;
  }
  kill(): void {
    this.crash(0);
  }
  /** Simulates the process dying. */
  crash(code = 1): void {
    if (!this.#alive) return;
    this.#alive = false;
    setTimeout(() => this.#onExit?.(code), 0);
  }
}

/** Run manager for tests; by default the engine runs without a real browser. */
export function createTestRunManager(
  services: Services,
  overrides: Partial<RunManagerDeps> & { worker?: WorkerDeps } = {},
): RunManager {
  const { worker, ...rest } = overrides;
  return new RunManager({
    services,
    artifactsRoot: '/tmp/kiemi-test-runs',
    browsersPath: '/tmp/kiemi-test-browsers',
    spawnWorker: () =>
      new InProcessWorker({
        launch: async () => ({
          browser: { close: async () => undefined } as never,
        }),
        ...worker,
      }),
    ...rest,
  });
}
