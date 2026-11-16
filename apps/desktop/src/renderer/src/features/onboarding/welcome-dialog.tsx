import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { errorMessage } from '@renderer/lib/errors';
import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Video } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { normalizeUrl, useOpenSamples, useSaveSettings } from './onboarding';

/**
 * First start (S-08, N-01): type a URL → the editor opens and recording starts; or open
 * the sample tests. Shown until the tester picks one or skips.
 */
export function WelcomeDialog() {
  const tx = useTx();
  const qc = useQueryClient();
  const settings = useQuery(trpc.system.settings.queryOptions());
  const projectId = useAppStore((s) => s.projectId);
  const saveSettings = useSaveSettings();
  const openSamples = useOpenSamples();
  const [url, setUrl] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState<'record' | 'samples' | null>(null);

  const open = settings.data?.onboardingDone === false && !!projectId;

  const finish = () => saveSettings({ onboardingDone: true });

  const record = async () => {
    const target = normalizeUrl(url);
    if (!target || !projectId) {
      setInvalid(true);
      return;
    }
    setBusy('record');
    try {
      const t = await trpcClient.testCases.create.mutate({
        projectId,
        folderId: null,
        name: tx('ui.onboarding.firstTestName'),
      });
      await qc.invalidateQueries({ queryKey: trpc.testCases.list.queryKey() });
      const s = useAppStore.getState();
      s.setPendingRecord({ testId: t.id, url: target });
      s.openTest(t.id);
      await finish();
    } catch (err) {
      toast.error(errorMessage(err, tx));
    } finally {
      setBusy(null);
    }
  };

  const samples = async () => {
    setBusy('samples');
    try {
      await openSamples();
      await finish();
      toast.success(tx('ui.onboarding.samplesReady'));
    } catch (err) {
      toast.error(errorMessage(err, tx));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) void finish();
      }}
    >
      <DialogContent className="sm:max-w-xl" data-testid="welcome-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{tx('ui.onboarding.title')}</DialogTitle>
          <DialogDescription>{tx('ui.onboarding.text')}</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Video className="size-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold">{tx('ui.onboarding.recordTitle')}</h3>
              <p className="text-sm text-muted-foreground">{tx('ui.onboarding.recordText')}</p>
            </div>
          </div>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void record();
            }}
          >
            <Label htmlFor="welcome-url">{tx('ui.onboarding.url')}</Label>
            <div className="flex gap-2">
              <Input
                id="welcome-url"
                autoFocus
                value={url}
                placeholder="https://…"
                aria-invalid={invalid}
                aria-describedby={invalid ? 'welcome-url-error' : undefined}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setInvalid(false);
                }}
              />
              <Button type="submit" disabled={!!busy}>
                {busy === 'record' ? <Loader2 className="animate-spin" /> : <Video />}
                {tx('ui.onboarding.recordAction')}
              </Button>
            </div>
            {invalid && (
              <p id="welcome-url-error" role="alert" className="text-sm text-destructive">
                {tx('ui.onboarding.urlInvalid')}
              </p>
            )}
          </form>
        </section>
        <section className="flex items-start gap-3 rounded-xl border p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <BookOpen className="size-5" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <h3 className="font-semibold">{tx('ui.onboarding.sampleTitle')}</h3>
              <p className="text-sm text-muted-foreground">{tx('ui.onboarding.sampleText')}</p>
            </div>
            <Button
              variant="outline"
              className="self-start"
              disabled={!!busy}
              onClick={() => void samples()}
            >
              {busy === 'samples' && <Loader2 className="animate-spin" />}
              {tx('ui.onboarding.sampleAction')}
            </Button>
          </div>
        </section>
        <div className="flex justify-end">
          <Button variant="ghost" disabled={!!busy} onClick={() => void finish()}>
            {tx('ui.onboarding.skip')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
