import { DbError } from '../repo';

export interface Table {
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Turns raw cell rows (first row = header) into named columns. Empty header
 * cells become "Cột N", duplicates get a suffix; fully empty rows are dropped.
 */
export function toTable(raw: string[][]): Table {
  const [header, ...body] = raw;
  if (!header || header.every((h) => h.trim() === '')) {
    throw new DbError('IMPORT_FAILED', 'The file has no header row', { reason: 'noHeader' });
  }
  const seen = new Map<string, number>();
  const columns = header.map((h, i) => {
    const base = h.trim() || `Cột ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });
  const rows = body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ''])));
  return { columns, rows };
}
