import { trpcClient } from '@renderer/lib/trpc';
import { create } from 'zustand';
import { applyFeed, initialRun, isFinished, type LiveRun } from './run-state';

interface RunStore {
  /** Latest run started from the editor (kept after it ends to show step results). */
  run: LiveRun | null;
  start: (testId: string, onEnd: (run: LiveRun) => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
}

let unsubscribe: (() => void) | undefined;

/** Starts a run in the engine process and follows its events [M4-01, N-05]. */
export const useRunStore = create<RunStore>((set, get) => ({
  run: null,

  async start(testId, onEnd) {
    const cur = get().run;
    if (cur && !isFinished(cur.status)) return;
    unsubscribe?.();
    const { runId } = await trpcClient.runs.start.mutate({ testCaseId: testId });
    const info = await trpcClient.runs.get.query({ runId }).catch(() => undefined);
    set({ run: initialRun(runId, testId, info?.cases.length ?? 1) });
    const sub = trpcClient.runs.events.subscribe(
      { runId },
      {
        onData: (event) => {
          const before = get().run;
          if (!before || before.runId !== runId) return;
          const next = applyFeed(before, event);
          set({ run: next });
          if (!isFinished(before.status) && isFinished(next.status)) onEnd(next);
        },
      },
    );
    unsubscribe = () => sub.unsubscribe();
  },

  async stop() {
    const run = get().run;
    if (!run || isFinished(run.status)) return;
    set({ run: { ...run, stopping: true } });
    await trpcClient.runs.cancel.mutate({ runId: run.runId });
  },

  clear() {
    unsubscribe?.();
    unsubscribe = undefined;
    set({ run: null });
  },
}));
