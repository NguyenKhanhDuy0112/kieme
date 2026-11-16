import { useTx } from '@renderer/lib/tx';
import { CircleCheck, CircleMinus, CircleX, Loader2 } from 'lucide-react';
import { useRunStore } from './run-store';

/** Live status icon of one step in the step table [M4-01]. */
export function StepStatusIcon({ testId, stepId }: { testId: string | null; stepId: string }) {
  const tx = useTx();
  const status = useRunStore((s) =>
    s.run && s.run.testId === testId ? s.run.steps[stepId] : undefined,
  );
  if (!status) return <span className="size-4 shrink-0" />;
  const label = tx(`ui.run.status.${status}`);
  const cls = 'size-4 shrink-0';
  if (status === 'running')
    return <Loader2 className={`${cls} animate-spin text-primary`} aria-label={label} />;
  if (status === 'passed') return <CircleCheck className={`${cls} text-pass`} aria-label={label} />;
  if (status === 'failed') return <CircleX className={`${cls} text-fail`} aria-label={label} />;
  return <CircleMinus className={`${cls} text-muted-foreground`} aria-label={label} />;
}
