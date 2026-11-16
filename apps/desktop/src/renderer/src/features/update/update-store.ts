import type { UpdateState } from '@main/update/update-service';
import { trpcClient } from '@renderer/lib/trpc';
import { create } from 'zustand';

interface UpdateStore {
  state: UpdateState;
  /** "Có gì mới" dialog open. */
  dialogOpen: boolean;
  setDialogOpen(open: boolean): void;
  /** Starts following the main process (idempotent). */
  follow(): void;
  check(): Promise<void>;
  install(): Promise<void>;
  openDownloadPage(): Promise<void>;
}

let following = false;

/** App update state streamed from main [N-12]. */
export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: { status: 'off' },
  dialogOpen: false,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  follow() {
    if (following) return;
    following = true;
    trpcClient.updates.events.subscribe(undefined, {
      onData: (state) => {
        const prev = get().state.status;
        set({ state });
        // Tell once when the update becomes usable; the header button stays afterwards.
        if ((state.status === 'ready' || state.status === 'available') && prev !== state.status)
          set({ dialogOpen: true });
      },
      onError: () => {
        following = false;
      },
    });
  },
  async check() {
    set({ state: await trpcClient.updates.check.mutate() });
  },
  async install() {
    await trpcClient.updates.install.mutate();
  },
  async openDownloadPage() {
    await trpcClient.updates.openDownloadPage.mutate();
  },
}));

/** Has something to show in the header. */
export function hasUpdate(
  s: UpdateState,
): s is Extract<UpdateState, { version: string; notes: string }> {
  return s.status === 'ready' || s.status === 'available';
}
