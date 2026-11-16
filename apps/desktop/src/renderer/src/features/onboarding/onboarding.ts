export { normalizeUrl } from './pure';

import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useQueryClient } from '@tanstack/react-query';

export type Settings = Awaited<ReturnType<typeof trpcClient.system.settings.query>>;
type SettingsPatch = Parameters<typeof trpcClient.system.updateSettings.mutate>[0];

/** Saves settings and refreshes the cached copy. */
export function useSaveSettings() {
  const qc = useQueryClient();
  return async (patch: SettingsPatch) => {
    const next = await trpcClient.system.updateSettings.mutate(patch);
    qc.setQueryData(trpc.system.settings.queryKey(), next);
    return next;
  };
}

/** Installs (once) and opens the sample project on its first test [L-01]. */
export function useOpenSamples() {
  const qc = useQueryClient();
  return async () => {
    const r = await trpcClient.samples.install.mutate();
    await qc.invalidateQueries({ queryKey: trpc.projects.list.queryKey() });
    const s = useAppStore.getState();
    s.setProject(r.projectId);
    if (r.firstTestId) s.openTest(r.firstTestId);
    else s.setView('tests');
    return r;
  };
}
