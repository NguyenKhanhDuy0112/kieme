import { describeRunError } from '@kiemi/shared';
import { Button } from '@renderer/components/ui/button';
import { errorMessage } from '@renderer/lib/errors';
import { useTx } from '@renderer/lib/tx';
import { Loader2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { isFinished, type LiveRun } from './run-state';
import { useRunStore } from './run-store';

/** Live progress line, e.g. "Đang chạy bước 3 / 12". */
function progressText(run: LiveRun, tx: ReturnType<typeof useTx>): string {
  if (run.downloadPercent !== undefined)
    return tx('ui.run.downloading', { percent: Math.round(run.downloadPercent) });
  if (run.stopping) return tx('ui.run.stopping');
  if (run.row === 0 || run.currentStepNo === undefined) return tx('ui.run.preparing');
  const step = Math.min(run.stepsDone + 1, Math.max(run.stepCount, 1));
  return run.rows > 1
    ? tx('ui.run.progressRow', { row: run.row, rows: run.rows, step, total: run.stepCount })
    : tx('ui.run.progress', { step, total: run.stepCount });
}

/** Run / Stop button of the editor header with live progress [M4-01]. */
export function RunControls({
  testId,
  beforeRun,
}: {
  testId: string;
  beforeRun: () => Promise<void>;
}) {
  const tx = useTx();
  const run = useRunStore((s) => s.run);
  const start = useRunStore((s) => s.start);
  const stop = useRunStore((s) => s.stop);
  const active = run !== null && run.testId === testId && !isFinished(run.status);

  const onEnd = (r: LiveRun) => {
    if (r.status === 'passed') {
      toast.success(tx('ui.run.passed', { passed: r.passedTotal, total: r.ranTotal }));
      return;
    }
    if (r.status === 'cancelled') {
      toast(tx('ui.run.cancelled'));
      return;
    }
    const err = r.status === 'error' ? (r.error ?? r.failure) : r.failure;
    const title = tx(r.status === 'error' ? 'ui.run.error' : 'ui.run.failed');
    toast.error(title, err ? { description: describeRunError(err, tx).message } : undefined);
  };

  if (active) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" /> {progressText(run, tx)}
        </span>
        <Button size="sm" variant="outline" disabled={run.stopping} onClick={() => void stop()}>
          <Square /> {tx('ui.run.stop')}
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await beforeRun();
          await start(testId, onEnd);
        } catch (err) {
          toast.error(errorMessage(err, tx));
        }
      }}
    >
      <Play /> {tx('common.run')}
    </Button>
  );
}
