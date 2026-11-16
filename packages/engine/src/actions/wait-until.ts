import { z } from 'zod';
import { sleep } from '../assertions/actions';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { ConditionSchema, evaluateCondition } from '../flow/condition';

/**
 * Wait until a condition holds [D-02]: checked every `intervalSec`, optionally
 * reloading the page every `reloadEverySec` (data synced with a delay).
 */
export const waitUntilAction = defineAction({
  type: 'waitUntil',
  params: z.object({
    condition: ConditionSchema,
    timeoutSec: z.coerce.number().positive().max(3600).default(30),
    intervalSec: z.coerce.number().positive().default(1),
    reloadEverySec: z.coerce.number().positive().optional(),
  }),
  ui: { label: 'actions.waitUntil', icon: 'hourglass', group: 'flow' },
  rawParams: ['condition'],
  container: true,
  async execute({ condition, timeoutSec, intervalSec, reloadEverySec }, ctx) {
    const start = Date.now();
    let lastReload = start;
    for (;;) {
      if (await evaluateCondition(ctx.vars.interpolate(condition), ctx)) return;
      const now = Date.now();
      if (now - start >= timeoutSec * 1000) {
        throw new EngineError(
          'CONDITION_TIMEOUT',
          `Step ${ctx.stepNo}: condition still false after ${timeoutSec} s`,
          {
            timeoutSec,
            condition,
          },
        );
      }
      if (reloadEverySec !== undefined && now - lastReload >= reloadEverySec * 1000) {
        lastReload = now;
        ctx.log('Reload page');
        await (await ctx.page()).reload({ timeout: 30_000 }).catch(() => undefined);
      }
      await sleep(
        Math.min(intervalSec * 1000, Math.max(50, timeoutSec * 1000 - (Date.now() - start))),
        ctx.signal,
      );
    }
  },
});
