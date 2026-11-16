import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Move the mouse over an element [A-05]. */
export const hoverAction = defineAction({
  type: 'hover',
  params: z.object({ target }),
  ui: { label: 'actions.hover', icon: 'pointer', group: 'input' },
  async execute({ target: t }, ctx) {
    const { locator } = await ctx.resolve(t);
    await locator.hover({ timeout: left(ctx) });
  },
});
