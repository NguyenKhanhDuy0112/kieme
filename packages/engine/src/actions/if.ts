import { z } from 'zod';
import { defineAction } from '../define-action';
import { ConditionSchema, evaluateCondition } from '../flow/condition';

const steps = z.array(z.record(z.string(), z.unknown()));

/** If / else on an element, text or variable condition [D-03]. */
export const ifAction = defineAction({
  type: 'if',
  params: z.object({
    condition: ConditionSchema,
    /** Steps when the condition holds. */
    steps: steps.default([]),
    /** Steps otherwise. */
    elseSteps: steps.default([]),
  }),
  ui: { label: 'actions.if', icon: 'split', group: 'flow' },
  rawParams: ['condition', 'steps', 'elseSteps'],
  container: true,
  async execute(p, ctx) {
    const ok = await evaluateCondition(ctx.vars.interpolate(p.condition), ctx);
    ctx.log(ok ? 'Condition true' : 'Condition false');
    await ctx.runSteps(ok ? p.steps : p.elseSteps);
  },
});
