import { en, vi } from '@kiemi/shared';
import { describe, expect, it } from 'vitest';
import { updateStatusText } from './update-text';

/** Strict translator over a locale object: fails on a missing key. */
const translator =
  (locale: unknown) =>
  (key: string, vars: Record<string, unknown> = {}): string => {
    let node: unknown = locale;
    for (const part of key.split('.')) node = (node as Record<string, unknown>)?.[part];
    if (typeof node !== 'string') throw new Error(`missing ${key}`);
    return node.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k]));
  };

describe('updateStatusText [N-12]', () => {
  it('describes every state in both languages', () => {
    for (const locale of [vi, en]) {
      const tx = translator(locale);
      for (const s of [
        { status: 'off' },
        { status: 'idle' },
        { status: 'checking' },
        { status: 'upToDate' },
        { status: 'error', message: 'x' },
        { status: 'downloading', version: '1.1.0', percent: 40 },
        { status: 'ready', version: '1.1.0', notes: '' },
        { status: 'available', version: '1.1.0', notes: '', url: 'https://x' },
      ] as const) {
        expect(updateStatusText(s, tx).length).toBeGreaterThan(0);
      }
    }
    const tx = translator(vi);
    expect(updateStatusText({ status: 'downloading', version: '1.1.0', percent: 40 }, tx)).toBe(
      'Đang tải bản 1.1.0… 40%',
    );
  });
});
