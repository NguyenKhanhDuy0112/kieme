import { z } from 'zod';
import { defineAction } from '../define-action';
import { left } from './_common';

/** Reload, go back or forward [A-12]. */
export const navigateAction = defineAction({
  type: 'navigate',
  params: z.object({ to: z.enum(['reload', 'back', 'forward']) }),
  ui: { label: 'actions.navigate', icon: 'rotate-cw', group: 'navigation' },
  async execute({ to }, ctx) {
    const page = await ctx.page();
    const opts = { timeout: left(ctx) };
    if (to === 'reload') await page.reload(opts);
    else if (to === 'back') await page.goBack(opts);
    else await page.goForward(opts);
  },
});
