import { type Table, toTable } from './table';

/** Picks `,` `;` or tab — whichever splits the first line into the most cells. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ',';
  let bestCount = 0;
  for (const d of [',', ';', '\t']) {
    const count = parseCsv(first, d)[0]?.length ?? 0;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 CSV: quoted fields, `""` escapes, new lines inside quotes. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** CSV bytes/text → table. Handles UTF-8 BOM (Excel's "CSV UTF-8") [E-03]. */
export function readCsv(input: string | Uint8Array, delimiter?: string): Table {
  let text = typeof input === 'string' ? input : new TextDecoder('utf-8').decode(input);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return toTable(parseCsv(text, delimiter ?? detectDelimiter(text)));
}

/** Table → CSV text (with BOM so Excel opens Vietnamese correctly). */
export function writeCsv(table: Table, delimiter = ','): string {
  const esc = (v: string) => (/[",\r\n;\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    table.columns.map(esc).join(delimiter),
    ...table.rows.map((r) => table.columns.map((c) => esc(r[c] ?? '')).join(delimiter)),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
