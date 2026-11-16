import { Input } from '@renderer/components/ui/input';
import { useTx } from '@renderer/lib/tx';
import { cn } from '@renderer/lib/utils';
import { createContext, useContext, useId, useRef, useState } from 'react';
import {
  applySuggestion,
  openTemplateAt,
  type Suggestion,
  suggest,
  type VariableSources,
} from './variable-suggest';

const EMPTY: VariableSources = { environment: [], test: [], data: [], secret: [], saved: [] };
export const VariableSourcesContext = createContext<VariableSources>(EMPTY);

/**
 * Text field with `{{` variable suggestions (E-01, M3-04). Arrow keys pick,
 * Enter/Tab inserts, Esc closes.
 */
export function VariableInput({
  value,
  onChange,
  id,
  placeholder,
  invalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const tx = useTx();
  const sources = useContext(VariableSourcesContext);
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const refresh = (text: string, caret: number) => {
    const open = openTemplateAt(text, caret);
    setItems(open ? suggest(sources, open.query, 12) : []);
    setActive(0);
  };

  const pick = (s: Suggestion) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = applySuggestion(value, caret, s.insert);
    onChange(next.text);
    setItems([]);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={ref}
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onBlur={() => setTimeout(() => setItems([]), 120)}
        onKeyDown={(e) => {
          if (!items.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % items.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            const s = items[active];
            if (s) {
              e.preventDefault();
              pick(s);
            }
          } else if (e.key === 'Escape') {
            setItems([]);
          }
        }}
      />
      {items.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={tx('ui.vars.suggest')}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {items.map((s, i) => (
            <div
              key={s.insert}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1 text-sm',
                i === active && 'bg-accent',
              )}
            >
              <span className="font-mono">{`{{${s.insert}}}`}</span>
              <span className="text-xs text-muted-foreground">
                {s.labelKey ? tx(s.labelKey) : tx(`ui.vars.groups.${s.group}`)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
