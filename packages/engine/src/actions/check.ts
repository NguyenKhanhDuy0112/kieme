import { z } from 'zod';
import { defineAction } from '../define-action';
import { left, target } from './_common';

/** Tick / untick a checkbox, choose a radio button [A-07]. */
export const checkAction = defineAction({
  type: 'check',
  params: z.object({ target, checked: z.boolean().default(true) }),
  ui: { label: 'actions.check', icon: 'square-check', group: 'input' },
  async execute({ target: t, checked }, ctx) {
    const { locator } = await ctx.resolve(t, { state: 'attached' });
    await locator.setChecked(checked, { timeout: left(ctx), force: !(await locator.isVisible()) });
  },
});
