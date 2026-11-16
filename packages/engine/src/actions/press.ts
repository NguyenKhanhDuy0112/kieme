import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Normalises "Ctrl+S", "cmd+enter", "Esc" to Playwright key names. */
export function normalizeKeys(keys: string): string {
  const map: Record<string, string> = {
    ctrl: 'Control',
    control: 'Control',
    cmd: 'Meta',
    command: 'Meta',
    meta: 'Meta',
    win: 'Meta',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift',
    esc: 'Escape',
    escape: 'Escape',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    space: 'Space',
    del: 'Delete',
    delete: 'Delete',
    backspace: 'Backspace',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    home: 'Home',
    end: 'End',
  };
  return keys
    .split('+')
    .map((k) => k.trim())
    .map((k) => map[k.toLowerCase()] ?? (k.length === 1 ? k : k[0]?.toUpperCase() + k.slice(1)))
    .join('+');
}

/** Press a key or a shortcut, optionally on an element [A-09]. */
export const pressAction = defineAction({
  type: 'press',
  params: z.object({ keys: z.string().min(1), target: target.optional() }),
  ui: { label: 'actions.press', icon: 'keyboard', group: 'input' },
  async execute({ keys, target: t }, ctx) {
    const combo = normalizeKeys(keys);
    if (t) {
      const { locator } = await ctx.resolve(t);
      await locator.press(combo, { timeout: left(ctx) });
    } else {
      await (await ctx.page()).keyboard.press(combo);
    }
  },
});
