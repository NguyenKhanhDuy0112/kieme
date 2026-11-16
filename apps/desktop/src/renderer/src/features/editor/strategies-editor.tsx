import type { LocatorStrategy } from '@kiemi/schema';
import { Button } from '@renderer/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { useTx } from '@renderer/lib/tx';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  blankStrategy,
  moveItem,
  ROLES,
  STRATEGY_KINDS,
  type StrategyKind,
  strategyProblem,
} from './strategies';
import { VariableInput } from './variable-input';

/**
 * Advanced mode (C-07): the ordered "ways to find" of an element, each editable by hand.
 * Kiemi tries them from top to bottom [C-01].
 */
export function StrategiesEditor({
  value,
  onChange,
  note,
}: {
  value: readonly LocatorStrategy[];
  onChange: (next: LocatorStrategy[]) => void;
  note?: string;
}) {
  const tx = useTx();
  const set = (i: number, s: LocatorStrategy) => onChange(value.map((x, j) => (j === i ? s : x)));
  return (
    <fieldset className="flex flex-col gap-2 rounded-md bg-muted/40 p-2" data-testid="strategies">
      <legend className="sr-only">{tx('ui.advanced.strategiesTitle')}</legend>
      <p className="text-xs text-muted-foreground">{note ?? tx('ui.advanced.strategiesHint')}</p>
      <ol className="flex flex-col gap-2">
        {value.map((s, i) => {
          const problem = strategyProblem(s);
          const problemId = `strategy-problem-${i}`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: strategies have no id; order is the identity.
            <li key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>
                <Select
                  value={s.kind}
                  onValueChange={(k) => set(i, blankStrategy(k as StrategyKind, s))}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-32 shrink-0"
                    aria-label={tx('ui.advanced.kind')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {tx(`ui.advanced.kinds.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {s.kind === 'role' ? (
                  <>
                    <Select value={s.role} onValueChange={(role) => set(i, { ...s, role })}>
                      <SelectTrigger
                        size="sm"
                        className="w-24 shrink-0"
                        aria-label={tx('ui.props.target.role')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set([s.role, ...ROLES])].map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <VariableInput
                      className="min-w-0 flex-1"
                      value={s.name ?? ''}
                      placeholder={tx('ui.advanced.roleName')}
                      label={tx('ui.advanced.roleName')}
                      onChange={(name) => {
                        const { name: _old, ...rest } = s;
                        set(i, name ? { ...rest, name } : rest);
                      }}
                    />
                  </>
                ) : (
                  <VariableInput
                    className="min-w-0 flex-1 font-mono text-xs"
                    value={s.value}
                    placeholder={tx('ui.advanced.value')}
                    label={tx('ui.advanced.value')}
                    invalid={!!problem}
                    {...(problem ? { describedBy: problemId } : {})}
                    onChange={(v) => set(i, { ...s, value: v })}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={tx('ui.advanced.up')}
                  disabled={i === 0}
                  onClick={() => onChange(moveItem(value, i, -1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={tx('ui.advanced.down')}
                  disabled={i === value.length - 1}
                  onClick={() => onChange(moveItem(value, i, 1))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={
                    value.length > 1 ? tx('ui.advanced.remove') : tx('ui.advanced.lastOne')
                  }
                  title={value.length > 1 ? undefined : tx('ui.advanced.lastOne')}
                  disabled={value.length <= 1}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              {problem && (
                <p id={problemId} className="pl-5 text-xs text-warning-text">
                  {tx(`ui.advanced.problems.${problem}`)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => onChange([...value, { kind: 'css', value: '' }])}
      >
        <Plus /> {tx('ui.advanced.add')}
      </Button>
    </fieldset>
  );
}
