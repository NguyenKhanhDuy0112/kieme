import { EmptyState } from '@renderer/components/empty-state';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@renderer/components/ui/table';
import { useAppStore } from '@renderer/lib/store';
import { trpc } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { cn } from '@renderer/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { GitCompare, History, Layers, Tag } from 'lucide-react';
import { useState } from 'react';
import { RunStatusBadge } from '../run/run-screen';
import { CompareDialog } from './compare-dialog';

const ALL = '__all__';
const STATUSES = ['passed', 'failed', 'error', 'cancelled', 'running'] as const;

const fmt = (d: Date | string | null) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

/** Lịch sử chạy: list, filters, compare 2 runs [S-05]. */
export function HistoryScreen() {
  const tx = useTx();
  const projectId = useAppStore((s) => s.projectId) ?? '';
  const openRun = useAppStore((s) => s.openRun);
  const [testId, setTestId] = useState(ALL);
  const [suiteId, setSuiteId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const tests = useQuery(trpc.testCases.list.queryOptions({ projectId }));
  const suites = useQuery(trpc.suites.list.queryOptions({ projectId }));
  const runs = useQuery({
    ...trpc.runs.history.queryOptions({
      projectId,
      ...(testId === ALL ? {} : { testCaseId: testId }),
      ...(suiteId === ALL ? {} : { suiteId }),
      ...(status === ALL ? {} : { status: status as (typeof STATUSES)[number] }),
    }),
    refetchInterval: 5000,
  });
  const filtered = testId !== ALL || suiteId !== ALL || status !== ALL;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  if (runs.data && runs.data.length === 0 && !filtered) {
    return (
      <EmptyState
        icon={History}
        title={tx('ui.history.emptyTitle')}
        text={tx('ui.history.emptyText')}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Select value={testId} onValueChange={setTestId}>
          <SelectTrigger className="w-52" aria-label={tx('ui.history.allTests')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tx('ui.history.allTests')}</SelectItem>
            {(tests.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={suiteId} onValueChange={setSuiteId}>
          <SelectTrigger className="w-44" aria-label={tx('ui.history.allSuites')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tx('ui.history.allSuites')}</SelectItem>
            {(suites.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label={tx('ui.history.allStatuses')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tx('ui.history.allStatuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {tx(`ui.run.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          size="sm"
          variant="outline"
          disabled={picked.length !== 2}
          title={tx('ui.history.compareHint')}
          onClick={() => setComparing(true)}
        >
          <GitCompare /> {tx('ui.history.compare')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>{tx('ui.history.when')}</TableHead>
              <TableHead>{tx('ui.history.what')}</TableHead>
              <TableHead>{tx('ui.history.environment')}</TableHead>
              <TableHead>{tx('ui.history.result')}</TableHead>
              <TableHead className="text-right">{tx('ui.history.duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs.data ?? []).map((r) => {
              const t = r.target;
              const name = t?.kind === 'tag' ? tx('ui.run.tag', { tag: t.tag }) : (t?.name ?? '—');
              return (
                <TableRow
                  key={r.id}
                  data-run={r.id}
                  className={cn('cursor-pointer', picked.includes(r.id) && 'bg-accent')}
                  onClick={() => openRun(r.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={tx('ui.history.select')}
                      checked={picked.includes(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{fmt(r.startedAt ?? r.createdAt)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {t?.kind === 'suite' && <Layers className="size-4 text-muted-foreground" />}
                      {t?.kind === 'tag' && <Tag className="size-4 text-muted-foreground" />}
                      {name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.environmentName ?? tx('ui.run.noEnvironment')}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <RunStatusBadge status={r.status} />
                      {r.counts.total > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {tx('ui.run.summary', { passed: r.counts.passed, total: r.counts.total })}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.durationMs === null
                      ? ''
                      : tx('ui.run.duration', {
                          seconds: (Math.round(r.durationMs / 100) / 10).toLocaleString('vi-VN'),
                        })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {comparing && picked.length === 2 && (
        <CompareDialog
          a={picked[0] as string}
          b={picked[1] as string}
          onClose={() => setComparing(false)}
        />
      )}
    </div>
  );
}
