import type { StepChange } from '@kiemi/recorder';
import type { Step, TestCase } from '@kiemi/schema';
import { insertStep, removeStep, updateStep } from '../editor/doc-model';

/**
 * Applies live recorder changes to the open test [K-01, K-04]. `recorded` mirrors
 * the recorder's own list; its first step goes after `anchorId` (top-level step
 * recorded from, or the last step when recording started), or first if null.
 */
export function applyRecordChanges(
  doc: TestCase,
  recorded: readonly Step[],
  changes: readonly StepChange[],
  anchorId: string | null,
): { doc: TestCase; recorded: Step[] } {
  let next = doc;
  const list = [...recorded];
  for (const c of changes) {
    if (c.type === 'add') {
      const prev = c.index === 0 ? anchorId : (list[c.index - 1]?.id ?? anchorId);
      list.splice(c.index, 0, c.step);
      if (prev) next = insertStep(next, c.step, { afterId: prev });
      else next = { ...next, steps: [c.step, ...next.steps] };
    } else if (c.type === 'update') {
      const old = list[c.index];
      list[c.index] = c.step;
      if (old) next = updateStep(next, old.id, { params: c.step.params });
    } else {
      const old = list[c.index];
      list.splice(c.index, 1);
      if (old) next = removeStep(next, old.id);
    }
  }
  return { doc: next, recorded: list };
}

/** Shorthand target (`{ text }`, `{ role, name }`…) or saved element → full locator, for Highlight [C-06]. */
export function toLocator(target: unknown, elements: TestCase['elements']) {
  if (!target || typeof target !== 'object') return undefined;
  const o = target as Record<string, unknown>;
  if (typeof o.ref === 'string') return elements[o.ref];
  if (Array.isArray(o.strategies)) return target as TestCase['elements'][string];
  const str = (k: string) =>
    typeof o[k] === 'string' && o[k] !== '' ? (o[k] as string) : undefined;
  const role = str('role');
  if (role)
    return {
      strategies: [{ kind: 'role' as const, role, ...(str('name') ? { name: str('name') } : {}) }],
    };
  for (const kind of ['text', 'label', 'placeholder', 'css', 'xpath', 'testId'] as const) {
    const value = str(kind);
    if (value) return { strategies: [{ kind, value }] };
  }
  return undefined;
}
