import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Words allowed as-is in the UI: product names and URL hints. */
const ALLOWED = new Set(['Chromium', 'Microsoft Edge', 'Google Chrome', 'https://…', 'Trace']);

const root = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'ui' ? [] : files(p);
    return p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });
}

/**
 * Every UI string goes through i18n (CLAUDE.md §5.8, M6-03): no literal JSX text and no
 * literal placeholder / aria-label / title / alt in screens (shadcn `components/ui` excluded).
 */
describe('no hard-coded UI strings', () => {
  it('screens use translation keys', () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const where = `${relative(root, file)}:${i + 1}`;
        for (const m of line.matchAll(/\b(placeholder|aria-label|title|alt)="([^"]*)"/g)) {
          const v = m[2] ?? '';
          if (/\p{L}{2,}/u.test(v) && !ALLOWED.has(v)) found.push(`${where} ${m[1]}="${v}"`);
        }
        // Text between tags on one line: `>Lưu<`, `> Save </Button>`.
        for (const m of line.matchAll(/>\s*([^<>{}=()]*\p{L}{2,}[^<>{}=()]*?)\s*<\/?[A-Za-z]/gu)) {
          const v = (m[1] ?? '').trim();
          if (v && !/^[&|?:,]/.test(v) && !/Promise|void/.test(v) && !ALLOWED.has(v))
            found.push(`${where} text "${v}"`);
        }
      });
    }
    expect(found).toEqual([]);
  });
});
