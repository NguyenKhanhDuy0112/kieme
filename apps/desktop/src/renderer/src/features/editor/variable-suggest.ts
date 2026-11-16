/** Names available for `{{…}}` in the open test (E-01, E-02). */
export interface VariableSources {
  environment: string[];
  test: string[];
  /** Dataset columns → `row.<col>`. */
  data: string[];
  /** Secret names → `secret.<name>`. */
  secret: string[];
  /** Saved by steps (extract / api) → bare names. */
  saved: string[];
}

export type SuggestionGroup = keyof VariableSources | 'generator';

export interface Suggestion {
  group: SuggestionGroup;
  /** Text inserted between the braces. */
  insert: string;
  /** i18n key of a friendly label (generators), else none. */
  labelKey?: string;
}

const GENERATORS: { insert: string; labelKey: string }[] = [
  { insert: 'today', labelKey: 'ui.vars.generators.today' },
  { insert: 'today + 3d', labelKey: 'ui.vars.generators.todayPlus' },
  { insert: 'now', labelKey: 'ui.vars.generators.now' },
  { insert: 'startOfMonth', labelKey: 'ui.vars.generators.startOfMonth' },
  { insert: 'random', labelKey: 'ui.vars.generators.random' },
  { insert: 'uuid', labelKey: 'ui.vars.generators.uuid' },
  { insert: 'timestamp', labelKey: 'ui.vars.generators.timestamp' },
  { insert: 'fake.name', labelKey: 'ui.vars.generators.fakeName' },
  { insert: 'fake.phone', labelKey: 'ui.vars.generators.fakePhone' },
  { insert: 'fake.email', labelKey: 'ui.vars.generators.fakeEmail' },
  { insert: 'fake.address', labelKey: 'ui.vars.generators.fakeAddress' },
];

/**
 * The `{{` being typed at the caret, or `undefined`: returns where it starts
 * and what was typed after it (`{{ro` → query `ro`).
 */
export function openTemplateAt(
  text: string,
  caret: number,
): { start: number; query: string } | undefined {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open < 0) return undefined;
  const inside = before.slice(open + 2);
  if (inside.includes('}}')) return undefined;
  return { start: open, query: inside.trimStart() };
}

/** Suggestions matching `query` (case/diacritics-insensitive), grouped, at most `limit`. */
export function suggest(sources: VariableSources, query: string, limit = 30): Suggestion[] {
  const fold = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const q = fold(query);
  const all: Suggestion[] = [
    ...sources.saved.map((n) => ({ group: 'saved' as const, insert: n })),
    ...sources.test.map((n) => ({ group: 'test' as const, insert: n })),
    ...sources.data.map((n) => ({ group: 'data' as const, insert: `row.${n}` })),
    ...sources.environment.map((n) => ({ group: 'environment' as const, insert: `env.${n}` })),
    ...sources.secret.map((n) => ({ group: 'secret' as const, insert: `secret.${n}` })),
    ...GENERATORS.map((g) => ({ group: 'generator' as const, ...g })),
  ];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of all) {
    if (seen.has(s.insert)) continue;
    if (q && !fold(s.insert).includes(q)) continue;
    seen.add(s.insert);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Replaces the open `{{query` at the caret with `{{insert}}`; returns text + new caret. */
export function applySuggestion(
  text: string,
  caret: number,
  insert: string,
): { text: string; caret: number } {
  const open = openTemplateAt(text, caret);
  if (!open) return { text, caret };
  const after = text.slice(caret);
  const closing = after.startsWith('}}') ? 2 : 0;
  const head = `${text.slice(0, open.start)}{{${insert}}}`;
  return { text: head + after.slice(closing), caret: head.length };
}
