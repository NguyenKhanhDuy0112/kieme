/**
 * Entry of the engine utility process (`utilityProcess.fork`) [N-05].
 * Playwright runs here, so a crash or a busy run never freezes the window.
 */
import type { HostToWorker, WorkerToHost } from './protocol';
import { createEngineWorker } from './worker-core';

interface ParentPort {
  postMessage(message: WorkerToHost): void;
  on(event: 'message', listener: (e: { data: HostToWorker }) => void): void;
}

const port = (process as unknown as { parentPort?: ParentPort }).parentPort;
if (!port) throw new Error('engine-worker must run in an Electron utility process');

const worker = createEngineWorker((msg) => port.postMessage(msg));
// The host kills this process once it has received `done` / `fatal`
// (exiting here could drop the last message before it is delivered).
port.on('message', (e) => {
  void worker.handle(e.data);
});
port.postMessage({ type: 'ready' });
