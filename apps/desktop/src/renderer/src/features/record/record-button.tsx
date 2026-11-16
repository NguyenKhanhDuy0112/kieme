import type { TestCase } from '@kiemi/schema';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { errorMessage } from '@renderer/lib/errors';
import { useAppStore } from '@renderer/lib/store';
import { trpc } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Square, Video } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRecordStore } from './record-store';

const NO_LOGIN = '__none__';

/** Last "Mở trang" URL of the test: where a new recording usually continues. */
function lastUrl(doc: TestCase): string {
  for (let i = doc.steps.length - 1; i >= 0; i--) {
    const s = doc.steps[i];
    if (s?.action === 'goto' && typeof s.params.url === 'string') return s.params.url;
  }
  return '';
}

/** "Ghi lại" in the editor header [K-01, K-04, F-02]; turns into "Dừng ghi" while recording. */
export function RecordButton({
  testId,
  doc,
  selectedId,
  beforeRecord,
}: {
  testId: string;
  doc: TestCase;
  selectedId: string | null;
  beforeRecord: () => Promise<void>;
}) {
  const tx = useTx();
  const projectId = useAppStore((s) => s.projectId);
  const rec = useRecordStore();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [insert, setInsert] = useState(false);
  const [login, setLogin] = useState(NO_LOGIN);
  const logins = useQuery({
    ...trpc.savedLogins.list.queryOptions({ projectId: projectId ?? '' }),
    enabled: !!projectId && open,
  });
  const busy = rec.testId === testId && rec.mode === 'record' && rec.recordingId !== null;
  const selectedIndex = selectedId ? doc.steps.findIndex((s) => s.id === selectedId) : -1;

  if (busy) {
    return (
      <Button size="sm" variant="destructive" onClick={() => void rec.stop()}>
        {rec.state === 'starting' ? <Loader2 className="animate-spin" /> : <Square />}{' '}
        {tx('ui.record.stop')}
      </Button>
    );
  }

  const begin = async () => {
    setOpen(false);
    try {
      await beforeRecord();
      const after = insert && selectedIndex >= 0 ? doc.steps[selectedIndex]?.id : undefined;
      await rec.start({
        testId,
        mode: 'record',
        ...(after ? { afterStepId: after } : { url: url.trim() || undefined }),
        ...(!after && login !== NO_LOGIN ? { loginName: login } : {}),
      });
    } catch (err) {
      toast.error(errorMessage(err, tx));
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setUrl(lastUrl(doc));
          setInsert(selectedIndex >= 0 && selectedIndex < doc.steps.length - 1);
          setLogin(NO_LOGIN);
          setOpen(true);
        }}
      >
        <Video /> {tx('ui.record.start')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tx('ui.record.dialogTitle')}</DialogTitle>
            <DialogDescription>{tx('ui.record.dialogText')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {selectedIndex >= 0 && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="rec-insert">
                  {tx('ui.record.insertAfter', { no: selectedIndex + 1 })}
                </Label>
                <Switch id="rec-insert" checked={insert} onCheckedChange={setInsert} />
              </div>
            )}
            {!insert && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-url">{tx('ui.record.url')}</Label>
                  <Input
                    id="rec-url"
                    value={url}
                    placeholder="https://…"
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void begin();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{tx('ui.record.urlHint')}</p>
                </div>
                {!!logins.data?.length && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rec-login">{tx('ui.record.login')}</Label>
                    <Select value={login} onValueChange={setLogin}>
                      <SelectTrigger id="rec-login" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_LOGIN}>{tx('ui.record.noLogin')}</SelectItem>
                        {logins.data.map((l) => (
                          <SelectItem key={l.id} value={l.name}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tx('common.cancel')}
            </Button>
            <Button onClick={() => void begin()}>
              <Video /> {tx('ui.record.begin')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
