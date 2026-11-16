import { utilityProcess } from 'electron';
import type { HostToWorker, WorkerToHost } from './protocol';
import type { WorkerHandle } from './run-manager';

/** Forks `engine-worker.js` as an Electron utility process [N-05]. */
export function spawnUtilityWorker(modulePath: string): WorkerHandle {
  const child = utilityProcess.fork(modulePath, [], {
    serviceName: 'Kiemi Engine',
    stdio: 'inherit',
  });
  // Messages sent before the process is up are queued by Electron.
  return {
    send: (msg: HostToWorker) => child.postMessage(msg),
    onMessage: (listener) => {
      child.on('message', (msg: WorkerToHost) => listener(msg));
    },
    onExit: (listener) => {
      child.once('exit', (code) => listener(code));
    },
    kill: () => {
      child.kill();
    },
  };
}
