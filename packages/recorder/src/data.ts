import type { Step, TestCase } from '@kiemi/schema';
import { elementLabel, toIdentifier } from './names';

/** Steps holding nested steps (`if`, `loop`…): their children are visited too. */
const CHILD_KEYS = ['steps', 'elseSteps'] as const;

function* walk(steps: readonly Step[]): Generator<Step> {
  for (const s of steps) {
    yield s;
    for (const k of CHILD_KEYS) {
      const kids = s.params[k];
      if (Array.isArray(kids)) yield* walk(kids as Step[]);
    }
  }
}

function mapSteps(steps: readonly Step[], fn: (s: Step) => Step): Step[] {
  return steps.map((s) => {
    let next = fn(s);
    for (const k of CHILD_KEYS) {
      const kids = next.params[k];
      if (Array.isArray(kids))
        next = { ...next, params: { ...next.params, [k]: mapSteps(kids as Step[], fn) } };
    }
    return next;
  });
}

/** Which parameter holds the typed / chosen value of a step. */
const VALUE_PARAM: Record<string, string> = { fill: 'value', select: 'option', pickDate: 'value' };

export interface DataCandidate {
  stepId: string;
  action: string;
  /** Element name shown to the tester (label, placeholder…). */
  label: string;
  value: string;
  /** Proposed column name (unique among candidates and existing columns). */
  column: string;
}

export const COLUMN_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Values typed or chosen while recording that can become data columns [M-02]. */
export function dataCandidates(tc: TestCase): DataCandidate[] {
  const taken = new Set(tc.dataset?.source === 'table' ? tc.dataset.columns : []);
  const out: DataCandidate[] = [];
  for (const s of walk(tc.steps)) {
    const param = VALUE_PARAM[s.action];
    const raw = param ? s.params[param] : undefined;
    if (raw === undefined || raw === null) continue;
    const value = String(raw);
    if (value.includes('{{')) continue; // already a variable
    const label = elementLabel(s.params.target);
    const base = toIdentifier(label, 'cot');
    let column = base;
    for (let n = 2; taken.has(column); n++) column = `${base}${n}`;
    taken.add(column);
    out.push({ stepId: s.id, action: s.action, label, value, column });
  }
  return out;
}

export class DatasetConflictError extends Error {
  constructor(
    readonly reason: 'notTable' | 'badColumn',
    readonly column?: string,
  ) {
    super(
      reason === 'notTable'
        ? 'The test uses data from a file or a saved dataset'
        : `Bad column ${column}`,
    );
  }
}

/**
 * "Biến thành dữ liệu" [M-02]: the picked values become columns of the test's
 * data table (first row = the recorded values; existing rows get them too) and
 * the steps use `{{row.<column>}}` instead.
 */
export function toDataset(
  tc: TestCase,
  picks: readonly { stepId: string; column: string }[],
): TestCase {
  if (!picks.length) return tc;
  if (tc.dataset && tc.dataset.source !== 'table') throw new DatasetConflictError('notTable');
  for (const p of picks) {
    if (!COLUMN_RE.test(p.column)) throw new DatasetConflictError('badColumn', p.column);
  }
  const byStep = new Map(picks.map((p) => [p.stepId, p.column]));
  const values = new Map<string, string>();
  const steps = mapSteps(tc.steps, (s) => {
    const column = byStep.get(s.id);
    const param = VALUE_PARAM[s.action];
    if (!column || !param || s.params[param] === undefined) return s;
    values.set(column, String(s.params[param]));
    return { ...s, params: { ...s.params, [param]: `{{row.${column}}}` } };
  });
  const table =
    tc.dataset?.source === 'table'
      ? tc.dataset
      : { source: 'table' as const, columns: [], rows: [] };
  const columns = [...table.columns];
  for (const c of values.keys()) if (!columns.includes(c)) columns.push(c);
  const rows = (table.rows.length ? table.rows : [{}]).map((r) => {
    const row = { ...r };
    for (const [c, v] of values) if (!(c in row) || row[c] === '') row[c] = v;
    return row;
  });
  return { ...tc, steps, dataset: { source: 'table', columns, rows } };
}
