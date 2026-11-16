import type { Step, TestCase } from '@kiemi/schema';
import { useTx } from '@renderer/lib/tx';
import { cn } from '@renderer/lib/utils';
import { describeTarget, describeValue, SENTENCE_PARAMS, sentenceParts } from './describe';

/**
 * A step read as a Vietnamese sentence with clickable chips (U-03):
 * `Bấm vào [nút “Lưu”]`, `Nhập [ô “Mã NV”] = [003609]`.
 */
export function StepSentence({
  step,
  elements,
  sharedNames,
  onChipClick,
}: {
  step: Step;
  elements: TestCase['elements'];
  sharedNames?: ReadonlyMap<string, string>;
  onChipClick?: (param: string) => void;
}) {
  const tx = useTx();
  if (step.name) return <span className="truncate">{step.name}</span>;
  const key = `ui.steps.${step.action}.sentence`;
  const parts = sentenceParts(
    (vars) => tx(key, vars, tx('ui.steps.unknown.sentence', { ...vars, action: step.action })),
    [...SENTENCE_PARAMS],
  );
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {parts.map((p) => {
        if (p.kind === 'text') return <span key={p.key}>{p.text}</span>;
        const value =
          p.param === 'action' && !(p.param in step.params) ? step.action : step.params[p.param];
        const isTarget = p.param === 'target';
        const label = isTarget
          ? describeTarget(value, elements, tx)
          : describeValue(p.param, value, tx, sharedNames);
        const hasVar = typeof value === 'string' && value.includes('{{');
        return (
          <button
            type="button"
            key={p.key}
            onClick={(e) => {
              e.stopPropagation();
              onChipClick?.(p.param);
            }}
            className={cn(
              'max-w-64 truncate rounded-md border px-1.5 py-0.5 text-[13px] leading-5 hover:bg-accent focus-visible:outline-2',
              isTarget ? 'border-primary/30 bg-primary/5 font-medium text-primary' : 'bg-muted',
              hasVar && 'border-warning/50 font-mono',
            )}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}
