import { add, format, isValid, parse, startOfDay } from 'date-fns';
import type { Duration } from './expression';

export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
export const DEFAULT_DATETIME_FORMAT = 'dd/MM/yyyy HH:mm:ss';

export function addDuration(date: Date, d: Duration, sign: 1 | -1): Date {
  const n = d.amount * sign;
  switch (d.unit) {
    case 'y':
      return add(date, { years: n });
    case 'M':
      return add(date, { months: n });
    case 'w':
      return add(date, { weeks: n });
    case 'd':
      return add(date, { days: n });
    case 'h':
      return add(date, { hours: n });
    case 'min':
      return add(date, { minutes: n });
    case 's':
      return add(date, { seconds: n });
  }
}

/** Date-only values print as `dd/MM/yyyy`, others with the time [E-06]. */
export function formatDate(date: Date, pattern?: string): string {
  if (pattern) return format(date, pattern);
  return date.getTime() === startOfDay(date).getTime()
    ? format(date, DEFAULT_DATE_FORMAT)
    : format(date, DEFAULT_DATETIME_FORMAT);
}

/** Formats tried when reading a date from the page or data [B-06]. */
export const DATE_INPUT_FORMATS = [
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'dd.MM.yyyy',
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  'dd/MM/yyyy HH:mm',
  'dd/MM/yyyy HH:mm:ss',
  "yyyy-MM-dd'T'HH:mm",
  "yyyy-MM-dd'T'HH:mm:ss",
  'yyyy-MM-dd HH:mm:ss',
  'dd/MM/yy',
  'MM/yyyy',
];

/** Parses a date in common Vietnamese / ISO formats; `undefined` if none fits. */
export function parseDate(
  text: string,
  pattern?: string,
  reference = new Date(),
): Date | undefined {
  const s = text.trim().replace(/^ngày\s+/i, '');
  const patterns = pattern ? [pattern] : DATE_INPUT_FORMATS;
  for (const p of patterns) {
    const d = parse(s, p, reference);
    if (isValid(d) && format(d, p) === s) return d;
    // Accept non-padded variants like 5/3/2026 for padded patterns.
    if (isValid(d) && !pattern && p.startsWith('d/M')) return d;
  }
  // "Ngày 05 tháng 03 năm 2026"
  const vn = /(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i.exec(s);
  if (vn) return new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]));
  if (!pattern && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (isValid(d)) return d;
  }
  return undefined;
}
