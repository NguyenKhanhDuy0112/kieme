import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Label } from '@renderer/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { errorMessage } from '@renderer/lib/errors';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RunDialog, useStartRun } from '../run/run-dialog';

const FIRST = '__first__';

/** Edit a suite (tests in order, default environment) and run it [S-01, H-01, H-02]. */
export function SuiteDialog({
  projectId,
  suiteId,
  onClose,
}: {
  projectId: string;
  suiteId: string;
  onClose: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const suite = useQuery(trpc.suites.get.queryOptions({ id: suiteId }));
  const tests = useQuery(trpc.testCases.list.queryOptions({ projectId }));
  const envs = useQuery(trpc.environments.list.queryOptions({ projectId }));
  const startRun = useStartRun();
  const [picked, setPicked] = useState<string[]>([]);
  const [env, setEnv] = useState(FIRST);
  const [options, setOptions] = useState(false);

  useEffect(() => {
    if (!suite.data) return;
    setPicked(suite.data.items.filter((i) => i.enabled).map((i) => i.testCaseId));
    setEnv(suite.data.environmentId ?? FIRST);
  }, [suite.data]);

  const save = async (): Promise<boolean> => {
    if (!suite.data) return false;
    try {
      await trpcClient.suites.update.mutate({
        id: suiteId,
        version: suite.data.version,
        patch: { environmentId: env === FIRST ? null : env },
      });
      await trpcClient.suites.setItems.mutate({
        id: suiteId,
        items: picked.map((testCaseId) => ({ testCaseId })),
      });
      await qc.invalidateQueries({ queryKey: trpc.suites.get.queryKey({ id: suiteId }) });
      return true;
    } catch (err) {
      toast.error(errorMessage(err, tx));
      return false;
    }
  };

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const target = { kind: 'suite' as const, suiteId };

  return (
    <>
      <Dialog open={!options} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{suite.data?.name ?? tx('ui.suite.title')}</DialogTitle>
            <DialogDescription>{tx('ui.suite.count', { count: picked.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="suite-env">{tx('ui.suite.environment')}</Label>
            <Select value={env} onValueChange={setEnv}>
              <SelectTrigger id="suite-env" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIRST}>{envs.data?.[0]?.name ?? '—'}</SelectItem>
                {(envs.data ?? []).slice(1).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{tx('ui.suite.tests')}</p>
            {(tests.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{tx('ui.suite.noTests')}</p>
            ) : (
              <ul className="max-h-72 overflow-auto rounded-md border">
                {(tests.data ?? []).map((t) => {
                  const order = picked.indexOf(t.id);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                    >
                      <Checkbox
                        id={`suite-t-${t.id}`}
                        checked={order >= 0}
                        onCheckedChange={() => toggle(t.id)}
                      />
                      <Label htmlFor={`suite-t-${t.id}`} className="flex-1 font-normal">
                        {t.name}
                      </Label>
                      {order >= 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          #{order + 1}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                if (await save()) toast.success(tx('ui.suite.saved'));
              }}
            >
              {tx('ui.suite.save')}
            </Button>
            <Button
              variant="outline"
              disabled={picked.length === 0}
              onClick={async () => {
                if (await save()) setOptions(true);
              }}
            >
              <SlidersHorizontal /> {tx('ui.run.options')}
            </Button>
            <Button
              disabled={picked.length === 0}
              onClick={async () => {
                if (!(await save())) return;
                onClose();
                await startRun(target);
              }}
            >
              <Play /> {tx('ui.suite.run')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RunDialog
        open={options}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        target={target}
      />
    </>
  );
}
