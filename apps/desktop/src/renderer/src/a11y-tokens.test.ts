import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r ?? 0) + 0.7152 * f(g ?? 0) + 0.0722 * f(bl ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(__dirname, 'styles.css'), 'utf8');
function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]?.toLowerCase()]),
  ) as Record<string, string>;
}

/** Text colour → backgrounds it is shown on. */
const TEXT_PAIRS: [string, string[]][] = [
  ['foreground', ['background', 'card', 'popover', 'muted', 'accent']],
  ['muted-foreground', ['background', 'card', 'muted', 'sidebar']],
  ['primary-foreground', ['primary']],
  ['secondary-foreground', ['secondary']],
  ['accent-foreground', ['accent']],
  ['sidebar-foreground', ['sidebar']],
  ['sidebar-accent-foreground', ['sidebar-accent']],
  ['sidebar-primary-foreground', ['sidebar-primary']],
  ['destructive', ['background', 'card']],
  ['pass-text', ['background', 'card', 'muted', 'pass-soft']],
  ['fail-text', ['background', 'card', 'muted', 'fail-soft']],
  ['warning-text', ['background', 'card', 'muted', 'warning-soft']],
  ['primary', ['info-soft']],
];

describe('design tokens are readable (U-13, WCAG AA)', () => {
  const light = tokens(':root');
  const themes = { light, dark: { ...light, ...tokens('.dark') } };

  for (const [theme, t] of Object.entries(themes)) {
    it(`${theme}: text contrast ≥ 4.5:1 and focus ring ≥ 3:1`, () => {
      const bad: string[] = [];
      for (const [fg, bgs] of TEXT_PAIRS)
        for (const bg of bgs) {
          const ratio = contrast(t[fg] ?? '', t[bg] ?? '');
          if (!(ratio >= 4.5)) bad.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`);
        }
      const ring = contrast(t.ring ?? '', t.background ?? '');
      if (!(ring >= 3)) bad.push(`ring: ${ring.toFixed(2)}`);
      expect(bad).toEqual([]);
    });
  }

  it('white text on the destructive button is readable', () => {
    expect(contrast('#ffffff', light.destructive ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it('no text size below 13px', () => {
    const sizes = [...css.matchAll(/--text-(\w+):\s*(\d+)px;/g)].map((m) => [m[1], Number(m[2])]);
    expect(sizes.map(([n]) => n)).toEqual(['xs', 'sm', 'base', 'lg', 'xl']);
    for (const [, px] of sizes) expect(px).toBeGreaterThanOrEqual(13);
  });
});
