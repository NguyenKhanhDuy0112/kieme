import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Empty a field [A-03]. */
export const clearAction = defineAction({
  type: 'clear',
  params: z.object({ target }),
  ui: { label: 'actions.clear', icon: 'eraser', group: 'input' },
  async execute({ target: t }, ctx) {
    const { locator } = await ctx.resolve(t);
    await locator.clear({ timeout: left(ctx) });
  },
});
