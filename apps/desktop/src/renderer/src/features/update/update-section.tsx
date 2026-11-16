import { Button } from '@renderer/components/ui/button';
import { trpc } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { hasUpdate, useUpdateStore } from './update-store';
import { updateStatusText } from './update-text';

/** Settings → "Cập nhật": current version, status, "Kiểm tra cập nhật" [N-12]. */
export function UpdateSection() {
  const tx = useTx();
  const info = useQuery(trpc.app.info.queryOptions());
  const state = useUpdateStore((s) => s.state);
  useEffect(() => useUpdateStore.getState().follow(), []);
  const busy = state.status === 'checking' || state.status === 'downloading';

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{tx('ui.update.settingsTitle')}</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">
            {info.data ? tx('app.version', { version: info.data.version }) : ''}
          </span>
          <p className="text-xs text-muted-foreground" data-testid="update-status">
            {updateStatusText(state, tx)}
          </p>
        </div>
        {hasUpdate(state) ? (
          <Button onClick={() => useUpdateStore.getState().setDialogOpen(true)}>
            <Sparkles /> {tx('ui.update.whatsNew')}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy || state.status === 'off'}
            onClick={() => void useUpdateStore.getState().check()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} {tx('ui.update.check')}
          </Button>
        )}
      </div>
    </section>
  );
}
