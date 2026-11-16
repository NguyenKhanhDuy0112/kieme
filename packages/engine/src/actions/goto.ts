import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, text } from './_common';

/** Open a URL; relative paths use the environment's base URL [A-01]. */
export const gotoAction = defineAction({
  type: 'goto',
  params: z.object({
    url: text,
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load'),
  }),
  ui: { label: 'actions.goto', icon: 'globe', group: 'navigation' },
  async execute({ url, waitUntil }, ctx) {
    const page = await ctx.page();
    const full = ctx.run.url(url);
    ctx.log(`Open ${full}`);
    await page.goto(full, { waitUntil, timeout: left(ctx) });
  },
});
