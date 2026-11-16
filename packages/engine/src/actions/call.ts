import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';

/** Run a shared step group with arguments, e.g. "Đăng nhập(user, pass)" [D-01]. */
export const callAction = defineAction({
  type: 'call',
  params: z.object({
    shared: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  ui: { label: 'actions.call', icon: 'layers', group: 'flow' },
  container: true,
  async execute({ shared, args }, ctx) {
    const def = ctx.run.sharedSteps.get(shared);
    if (!def)
      throw new EngineError('UNKNOWN_SHARED_STEP', `Shared step "${shared}" not found`, { shared });
    const missing = def.params.filter((p) => !Object.hasOwn(args, p));
    if (missing.length) {
      throw new EngineError(
        'INVALID_PARAMS',
        `Missing arguments for "${def.name}": ${missing.join(', ')}`,
        { shared, missing },
      );
    }
    // Shared steps follow the caller's session unless they pin one.
    const steps = def.steps.map((s) =>
      s.session === 'default' ? { ...s, session: ctx.session } : s,
    );
    await ctx.runSteps(steps, { param: args });
  },
});
