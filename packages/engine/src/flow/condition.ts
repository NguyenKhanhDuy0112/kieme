import { z } from 'zod';
import { CHECKS_BY_NAME } from '../assertions/checks';
import type { ActionContext } from '../define-action';
import { EngineError } from '../errors';

/**
 * Conditions for if / waitUntil / skipIf [D-02, D-03, D-06]:
 * - `{ "assert": "visible", "target": { "text": "Đã duyệt" } }` — any check by name
 * - `{ "variable": "trangThai", "op": "equals", "value": "OK" }`
 * - `{ "not": cond }`, `{ "all": [cond…] }`, `{ "any": [cond…] }`
 */
export type Condition = Record<string, unknown>;
export const ConditionSchema = z.record(z.string(), z.unknown());

const isNotFound = (err: unknown) =>
  err instanceof EngineError &&
  (err.code === 'ELEMENT_NOT_FOUND' || err.code === 'ELEMENT_AMBIGUOUS');

/** Evaluates a condition once (no waiting). Missing elements count as `false`. */
export async function evaluateCondition(cond: unknown, ctx: ActionContext): Promise<boolean> {
  if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) {
    throw new EngineError('INVALID_PARAMS', 'A condition must be an object', { condition: cond });
  }
  const c = cond as Condition;
  if ('not' in c) return !(await evaluateCondition(c.not, ctx));
  if ('all' in c || 'any' in c) {
    const list = (c.all ?? c.any) as unknown;
    if (!Array.isArray(list))
      throw new EngineError('INVALID_PARAMS', '"all"/"any" must be a list', { condition: c });
    if ('all' in c) {
      for (const x of list) if (!(await evaluateCondition(x, ctx))) return false;
      return true;
    }
    for (const x of list) if (await evaluateCondition(x, ctx)) return true;
    return false;
  }
  const { assert, variable, ...rest } = c;
  const name = typeof variable === 'string' ? 'variable' : assert;
  const check = typeof name === 'string' ? CHECKS_BY_NAME.get(name) : undefined;
  if (!check) {
    throw new EngineError('INVALID_PARAMS', `Unknown condition "${String(name)}"`, {
      condition: c,
    });
  }
  const parsed = check.params.safeParse(
    typeof variable === 'string' ? { name: variable, ...rest } : rest,
  );
  if (!parsed.success) {
    throw new EngineError('INVALID_PARAMS', `Invalid condition "${String(name)}"`, {
      condition: c,
      issues: parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
    });
  }
  try {
    return (await check.check(parsed.data, ctx)).pass;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}
