import { useTx } from '@renderer/lib/tx';
import { CircleCheck, CircleMinus, CircleX, Loader2 } from 'lucide-react';
import type { LiveStepStatus } from './run-state';
import { useRunStore } from './run-store';

/** Status icon of a step: colour + icon + label, never colour alone (U-07). */
export function StatusIcon({ status }: { status: LiveStepStatus | undefined }) {
  const tx = useTx();
  if (!status) return <span className="size-4 shrink-0" />;
  const label = tx(`ui.run.status.${status}`);
  const cls = 'size-4 shrink-0';
  if (status === 'running')
    return <Loader2 className={`${cls} animate-spin text-primary`} aria-label={label} />;
  if (status === 'passed')
    return <CircleCheck className={`${cls} status-pop text-pass-text`} aria-label={label} />;
  if (status === 'failed')
    return <CircleX className={`${cls} status-pop text-fail-text`} aria-label={label} />;
  return <CircleMinus className={`${cls} text-muted-foreground`} aria-label={label} />;
}

/** Live status of one step in the editor's step table (latest run of the test). */
export function StepStatusIcon({ testId, stepId }: { testId: string | null; stepId: string }) {
  const status = useRunStore((s) => {
    const runId = testId ? s.latestByTest[testId] : undefined;
    const run = runId ? s.runs[runId] : undefined;
    const c = run?.cases.filter((x) => x.testCaseId === testId).at(-1);
    return c?.steps[stepId]?.status;
  });
  return <StatusIcon status={status} />;
}
