import { z } from 'zod';
import type { ActionContext } from '../define-action';
import { TargetParamSchema } from '../run/target';

export const target = TargetParamSchema;
/** Values typed by testers may be numbers after `{{…}}` interpolation. */
export const text = z.union([z.string(), z.number(), z.boolean()]).transform(String);

/** Time left for a Playwright call inside this step (≥ 1 ms). */
export const left = (ctx: ActionContext) => Math.max(1, ctx.remainingMs());

/** True when `value` contains any secret value (so the field is masked) [E-08]. */
export function holdsSecret(ctx: ActionContext, value: string): boolean {
  return ctx.vars.secretValues().some((s) => value.includes(s));
}
