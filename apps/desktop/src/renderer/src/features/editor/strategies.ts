import type { LocatorStrategy } from '@kiemi/schema';
import { createContext, useContext } from 'react';

/** Advanced mode (C-07): raw "ways to find" an element are shown and editable. */
export const AdvancedModeContext = createContext(false);
export const useAdvancedMode = () => useContext(AdvancedModeContext);

/** Every strategy kind, in the order Kiemi prefers them [C-01]. */
export const STRATEGY_KINDS = [
  'role',
  'label',
  'placeholder',
  'text',
  'testId',
  'css',
  'xpath',
] as const satisfies readonly LocatorStrategy['kind'][];
export type StrategyKind = (typeof STRATEGY_KINDS)[number];

/** A new strategy of this kind, keeping the old value when it makes sense. */
export function blankStrategy(kind: StrategyKind, from?: LocatorStrategy): LocatorStrategy {
  const old = from ? (from.kind === 'role' ? (from.name ?? '') : from.value) : '';
  if (kind === 'role') return { kind, role: 'button', ...(old ? { name: old } : {}) };
  return { kind, value: old };
}

/** Moves item `i` up (-1) or down (+1); unchanged at the ends. */
export function moveItem<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j] as T, next[i] as T];
  return next;
}

export type StrategyProblem = 'empty' | 'badCss' | 'badXpath';

/** What is wrong with a hand-written strategy, if anything (shown under the row). */
export function strategyProblem(s: LocatorStrategy): StrategyProblem | null {
  if (s.kind === 'role') return s.role.trim() ? null : 'empty';
  const v = s.value.trim();
  if (!v) return 'empty';
  // Values with {{variables}} are only known at run time.
  if (v.includes('{{')) return null;
  if (s.kind === 'css') {
    try {
      document.createDocumentFragment().querySelector(v);
    } catch {
      return 'badCss';
    }
  }
  if (s.kind === 'xpath') {
    if (!/^(\/|\(|\.)/.test(v)) return 'badXpath';
    if (typeof document.evaluate === 'function') {
      try {
        document.evaluate(v, document, null, 0, null);
      } catch {
        return 'badXpath';
      }
    }
  }
  return null;
}

/** Short technical text of a strategy, e.g. `css: #save`, `role: button "Lưu"`. */
export function strategyText(s: LocatorStrategy): string {
  if (s.kind === 'role') return `role: ${s.role}${s.name ? ` "${s.name}"` : ''}`;
  return `${s.kind}: ${s.value}`;
}

/** ARIA roles offered in pickers (subset testers meet). */
export const ROLES = [
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'option',
  'heading',
  'cell',
  'row',
  'tab',
  'menuitem',
  'img',
  'dialog',
];

/** How a step's target is written (see `targetKind` in the form). */
export type TargetKind =
  | 'ref'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'role'
  | 'testId'
  | 'css'
  | 'locator';

/** Choices of the "Tìm phần tử theo" list; technical ones only in advanced mode (U-05, C-07). */
export function targetKindsFor(
  current: TargetKind,
  hasRefs: boolean,
  advanced: boolean,
): TargetKind[] {
  const out: TargetKind[] = [];
  if (hasRefs || current === 'ref') out.push('ref');
  out.push('text', 'label', 'placeholder', 'role');
  if (advanced || current === 'testId') out.push('testId');
  if (advanced || current === 'css') out.push('css');
  if (advanced || current === 'locator') out.push('locator');
  return out;
}
