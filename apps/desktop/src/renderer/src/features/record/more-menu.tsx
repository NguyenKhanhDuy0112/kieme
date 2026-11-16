import {
  applyVariant,
  COLUMN_RE,
  DatasetConflictError,
  dataCandidates,
  formVariants,
  toDataset,
  type Variant,
} from '@kiemi/recorder/pure';
import type { TestCase } from '@kiemi/schema';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Input } from '@renderer/components/ui/input';
import { errorMessage } from '@renderer/lib/errors';
import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQueryClient } from '@tanstack/react-query';
import { Ellipsis, FlaskConical, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '../editor/editor-store';

/** Secondary editor actions (U-02): "Biến thành dữ liệu" [M-02], "Sinh biến thể" [M-03]. */
export function EditorMoreMenu({
  testId,
  doc,
  beforeCreate,
}: {
  testId: string;
  doc: TestCase;
  beforeCreate: () => Promise<void>;
}) {
  const tx = useTx();
  const [dialog, setDialog] = useState<'data' | 'variants' | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={tx('ui.record.more')}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('data')}>
            <Table2 /> {tx('ui.toData.menu')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('variants')}>
            <FlaskConical /> {tx('ui.variants.menu')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === 'data' && <ToDataDialog doc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'variants' && (
        <VariantsDialog
          testId={testId}
          doc={doc}
          beforeCreate={beforeCreate}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function ToDataDialog({ doc, onClose }: { doc: TestCase; onClose: () => void }) {
  const tx = useTx();
  const candidates = useMemo(() => dataCandidates(doc), [doc]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [columns, setColumns] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((c) => [c.stepId, c.column])),
  );
  const stepNo = (id: string) => doc.steps.findIndex((s) => s.id === id) + 1;
  const chosen = candidates.filter((c) => picked[c.stepId]);

  const apply = () => {
    try {
      const picks = chosen.map((c) => ({
        stepId: c.stepId,
        column: columns[c.stepId] ?? c.column,
      }));
      useEditorStore.getState().apply((d) => toDataset(d, picks));
      toast.success(tx('ui.toData.done', { count: picks.length }));
      onClose();
    } catch (err) {
      if (err instanceof DatasetConflictError)
        toast.error(
          err.reason === 'notTable'
            ? tx('ui.toData.notTable')
            : tx('ui.toData.badColumn', { column: err.column ?? '' }),
        );
      else toast.error(errorMessage(err, tx));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tx('ui.toData.title')}</DialogTitle>
          <DialogDescription>{tx('ui.toData.text')}</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tx('ui.toData.none')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="w-8" />
                <th className="py-1">{tx('ui.toData.step')}</th>
                <th>{tx('ui.toData.value')}</th>
                <th>{tx('ui.toData.column')}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const col = columns[c.stepId] ?? '';
                return (
                  <tr key={c.stepId} className="border-t">
                    <td className="py-1.5">
                      <Checkbox
                        aria-label={`${c.label} = ${c.value}`}
                        checked={!!picked[c.stepId]}
                        onCheckedChange={(v) => setPicked({ ...picked, [c.stepId]: v === true })}
                      />
                    </td>
                    <td>
                      {stepNo(c.stepId) > 0 ? `${stepNo(c.stepId)}. ` : ''}
                      {c.label}
                    </td>
                    <td className="max-w-40 truncate">{c.value}</td>
                    <td>
                      <Input
                        className="h-8"
                        aria-label={tx('ui.toData.column')}
                        aria-invalid={!COLUMN_RE.test(col)}
                        value={col}
                        onChange={(e) => setColumns({ ...columns, [c.stepId]: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tx('common.cancel')}
          </Button>
          <Button disabled={!chosen.length} onClick={apply}>
            {tx('ui.toData.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantsDialog({
  testId,
  doc,
  beforeCreate,
  onClose,
}: {
  testId: string;
  doc: TestCase;
  beforeCreate: () => Promise<void>;
  onClose: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const projectId = useAppStore((s) => s.projectId);
  const variants = useMemo(() => formVariants(doc), [doc]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const chosen = variants.filter((v) => picked[v.id]);
  const byField = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants) m.set(v.stepId, [...(m.get(v.stepId) ?? []), v]);
    return [...m.values()];
  }, [variants]);

  const create = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await beforeCreate();
      const source = await trpcClient.testCases.get.query({ id: testId });
      for (const v of chosen) {
        const reason = tx(`ui.variants.reasons.${v.reason}`);
        const name = tx('ui.variants.testName', { name: doc.name, field: v.field, reason });
        const row = await trpcClient.testCases.create.mutate({
          projectId,
          name: name.slice(0, 300),
          folderId: source.folderId ?? null,
        });
        const content = applyVariant(doc, v, {
          id: row.id,
          name: row.name,
          description: tx('ui.variants.note', { field: v.field, reason }),
        });
        await trpcClient.testCases.save.mutate({ id: row.id, version: row.version, content });
      }
      await qc.invalidateQueries({ queryKey: trpc.testCases.list.queryKey({ projectId }) });
      toast.success(tx('ui.variants.done', { count: chosen.length }));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, tx));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tx('ui.variants.title')}</DialogTitle>
          <DialogDescription>{tx('ui.variants.text')}</DialogDescription>
        </DialogHeader>
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tx('ui.variants.none')}</p>
        ) : (
          <div className="flex max-h-96 flex-col gap-3 overflow-auto text-sm">
            {byField.map((list) => (
              <fieldset key={list[0]?.stepId} className="flex flex-col gap-1">
                <legend className="font-medium">{list[0]?.field}</legend>
                {list.map((v) => (
                  <label key={v.id} htmlFor={`variant-${v.id}`} className="flex items-center gap-2">
                    <Checkbox
                      id={`variant-${v.id}`}
                      checked={!!picked[v.id]}
                      onCheckedChange={(c) => setPicked({ ...picked, [v.id]: c === true })}
                    />
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {tx(`ui.variants.kinds.${v.kind}`)}
                    </span>
                    <span>{tx(`ui.variants.reasons.${v.reason}`)}</span>
                    <code className="ml-auto max-w-40 truncate text-xs text-muted-foreground">
                      {v.value === '' ? '""' : v.value}
                    </code>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tx('common.cancel')}
          </Button>
          <Button disabled={!chosen.length || busy} onClick={() => void create()}>
            {tx('ui.variants.create', { count: chosen.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
