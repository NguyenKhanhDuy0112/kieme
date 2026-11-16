/**
 * Dynamic ID handling [C-05]: ASP.NET WebForms (`ctl00_MainContent_ctl42_txtName`)
 * and generated IDs (`input-8f3a2c91`, `field_123456_email`) change between page
 * loads. We keep only the stable parts and match them with attribute selectors.
 */

const SEPARATOR = /([_$:.-])/;

/** A token that is likely regenerated on each load. */
export function isVolatileToken(token: string): boolean {
  if (/^ctl\d+$/i.test(token)) return true; // WebForms naming container
  if (/^\d{3,}$/.test(token)) return true; // counters / timestamps
  if (/^[0-9a-f]{6,}$/i.test(token) && /\d/.test(token)) return true; // hashes, uuid parts
  if (/^(?=.*\d)(?=.*[a-z])[a-z0-9]{10,}$/i.test(token) && countDigits(token) >= 3) return true; // random ids
  return false;
}

function countDigits(s: string): number {
  return s.replace(/\D/g, '').length;
}

/** True when the id contains volatile parts but also something stable to match on. */
export function isDynamicId(id: string): boolean {
  return stableIdParts(id) !== undefined;
}

export interface StableIdParts {
  /** Stable text at the start (kept with its trailing separator). */
  prefix?: string;
  /** Stable text at the end (kept with its leading separator). */
  suffix?: string;
  /** Stable runs in the middle (kept with surrounding separators). */
  contains: string[];
}

/** Splits an id into stable runs, or `undefined` if it is not dynamic or has nothing stable. */
export function stableIdParts(id: string): StableIdParts | undefined {
  const pieces = id.split(SEPARATOR); // tokens at even indexes, separators at odd
  const volatile = pieces.map((p, i) => i % 2 === 0 && p !== '' && isVolatileToken(p));
  if (!volatile.some(Boolean)) return undefined;

  // Group consecutive stable tokens (with the separators between them) into runs.
  const runs: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i < pieces.length; i += 2) {
    const stable = pieces[i] !== '' && !volatile[i];
    if (stable && start < 0) start = i;
    if (!stable && start >= 0) {
      runs.push({ start, end: i - 2 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: pieces.length - 1 });
  if (runs.length === 0) return undefined;

  const last = pieces.length - 1;
  const text = (from: number, to: number) => pieces.slice(Math.max(from, 0), to + 1).join('');
  const parts: StableIdParts = { contains: [] };
  for (const run of runs) {
    if (run.start === 0 && run.end === last) return undefined; // nothing volatile after all
    if (run.start === 0) parts.prefix = text(0, run.end + 1);
    else if (run.end === last) parts.suffix = text(run.start - 1, last);
    else parts.contains.push(text(run.start - 1, run.end + 1));
  }
  // Require at least one real word: matching only "_" would be meaningless.
  const words = [parts.prefix, parts.suffix, ...parts.contains].filter(
    (p): p is string => p !== undefined && /[A-Za-z]{2,}/.test(p),
  );
  return words.length > 0 ? parts : undefined;
}

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Attribute selector matching only the stable parts of a dynamic id (or `name`),
 * e.g. `ctl00_MainContent_ctl42_txtName` → `[id*="_MainContent_"][id$="_txtName"]`.
 */
export function stableIdSelector(
  value: string,
  attribute: 'id' | 'name' = 'id',
): string | undefined {
  const parts = stableIdParts(value);
  if (!parts) return undefined;
  let sel = '';
  if (parts.prefix) sel += `[${attribute}^=${cssString(parts.prefix)}]`;
  for (const c of parts.contains) sel += `[${attribute}*=${cssString(c)}]`;
  if (parts.suffix) sel += `[${attribute}$=${cssString(parts.suffix)}]`;
  return sel;
}

/**
 * For a css/xpath strategy that pins a single dynamic id or name, returns a css
 * selector matching only its stable parts; otherwise `undefined`.
 */
export function stableVariantOf(kind: 'css' | 'xpath', value: string): string | undefined {
  const v = value.trim();
  let match: RegExpMatchArray | null;
  if (kind === 'css') {
    match = v.match(/^#((?:[A-Za-z0-9_-]|\\.)+)$/);
    if (match?.[1]) return stableIdSelector(match[1].replace(/\\(.)/g, '$1'), 'id');
    match = v.match(
      /^(?:([a-z][a-z0-9]*))?\[(id|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\]\s]+))\]$/i,
    );
  } else {
    match = v.match(/^\/\/(\*|[a-z][a-z0-9]*)\[@(id|name)\s*=\s*(?:"([^"]+)"|'([^']+)')\]$/i);
  }
  if (!match) return undefined;
  const tag = match[1] && match[1] !== '*' ? match[1].toLowerCase() : '';
  const attribute = match[2]?.toLowerCase() === 'name' ? 'name' : 'id';
  const raw = match[3] ?? match[4] ?? match[5];
  if (!raw) return undefined;
  const sel = stableIdSelector(raw, attribute);
  return sel === undefined ? undefined : `${tag}${sel}`;
}
