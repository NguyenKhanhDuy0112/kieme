import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Scroll to an element, to the top/bottom, or by an amount [A-10]. */
export const scrollAction = defineAction({
  type: 'scroll',
  params: z.object({
    target: target.optional(),
    to: z.enum(['top', 'bottom']).optional(),
    by: z.object({ x: z.number().default(0), y: z.number().default(0) }).optional(),
  }),
  ui: { label: 'actions.scroll', icon: 'arrow-down-up', group: 'input' },
  async execute({ target: t, to, by }, ctx) {
    if (t) {
      const { locator } = await ctx.resolve(t);
      await locator.scrollIntoViewIfNeeded({ timeout: left(ctx) });
      return;
    }
    const page = await ctx.page();
    if (by) await page.mouse.wheel(by.x, by.y);
    else
      await page.evaluate((where) => {
        window.scrollTo(0, where === 'top' ? 0 : document.documentElement.scrollHeight);
      }, to ?? 'bottom');
  },
});
