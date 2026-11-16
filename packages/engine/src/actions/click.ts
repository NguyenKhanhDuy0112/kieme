import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Click, double-click or right-click [A-04]. */
export const clickAction = defineAction({
  type: 'click',
  params: z.object({
    target,
    variant: z.enum(['single', 'double', 'right']).default('single'),
    modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional(),
  }),
  ui: { label: 'actions.click', icon: 'mouse-pointer-click', group: 'input' },
  async execute({ target: t, variant, modifiers }, ctx) {
    const { locator } = await ctx.resolve(t);
    const opts = { timeout: left(ctx), ...(modifiers ? { modifiers } : {}) };
    if (variant === 'double') await locator.dblclick(opts);
    else await locator.click({ ...opts, button: variant === 'right' ? 'right' : 'left' });
  },
});
