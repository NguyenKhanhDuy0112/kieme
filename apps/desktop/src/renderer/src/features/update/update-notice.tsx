import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { errorMessage } from '@renderer/lib/errors';
import { useTx } from '@renderer/lib/tx';
import { Download, RotateCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { hasUpdate, useUpdateStore } from './update-store';

/**
 * Header button "Có bản mới x.y.z" + "Có gì mới" dialog [N-12].
 * Installed app: "Khởi động lại để cập nhật". Portable: "Tải bản mới".
 */
export function UpdateNotice() {
  const tx = useTx();
  const state = useUpdateStore((s) => s.state);
  const open = useUpdateStore((s) => s.dialogOpen);
  const setOpen = useUpdateStore((s) => s.setDialogOpen);
  const [busy, setBusy] = useState(false);

  useEffect(() => useUpdateStore.getState().follow(), []);

  if (!hasUpdate(state)) return null;
  const ready = state.status === 'ready';

  const act = async () => {
    setBusy(true);
    try {
      const store = useUpdateStore.getState();
      if (ready) await store.install();
      else {
        await store.openDownloadPage();
        setOpen(false);
      }
    } catch (err) {
      toast.error(errorMessage(err, tx));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 border-pass/60"
        data-testid="update-badge"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="text-pass-text" />
        {tx('ui.update.badge', { version: state.version })}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tx(ready ? 'ui.update.readyTitle' : 'ui.update.availableTitle', {
                version: state.version,
              })}
            </DialogTitle>
            <DialogDescription>
              {ready ? tx('ui.update.dataSafe') : tx('ui.update.portableText')}
            </DialogDescription>
          </DialogHeader>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{tx('ui.update.whatsNew')}</h3>
            <div className="max-h-72 overflow-auto whitespace-pre-line rounded-md border bg-muted/40 p-3 text-sm">
              {state.notes || tx('ui.update.noNotes')}
            </div>
          </section>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tx('ui.update.later')}
            </Button>
            <Button disabled={busy} onClick={() => void act()}>
              {ready ? <RotateCw /> : <Download />}
              {tx(ready ? 'ui.update.restart' : 'ui.update.download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
