import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { left, target, text } from './_common';

/**
 * Choose in a dropdown [A-06]: native `<select>` (by text, value or position),
 * or a custom dropdown (div/li): open it, then click the option.
 */
export const selectAction = defineAction({
  type: 'select',
  params: z.object({
    target,
    by: z.enum(['label', 'value', 'index']).default('label'),
    /** Option text / value, or 1-based position for `index`. */
    option: text,
  }),
  ui: { label: 'actions.select', icon: 'list', group: 'input' },
  async execute({ target: t, by, option }, ctx) {
    const { locator } = await ctx.resolve(t);
    const tag = await locator.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      const value =
        by === 'index'
          ? { index: Number(option) - 1 }
          : by === 'value'
            ? { value: option }
            : { label: option };
      await locator.selectOption(value, { timeout: left(ctx) });
      return;
    }
    // Custom dropdown: open it, then pick the option among visible candidates.
    await locator.click({ timeout: left(ctx) });
    const page = await ctx.page();
    const deadline = Date.now() + left(ctx);
    for (;;) {
      for (const frame of page.frames()) {
        const roleOptions = frame.getByRole('option').filter({ visible: true });
        let pick =
          by === 'index'
            ? roleOptions.nth(Number(option) - 1)
            : by === 'value'
              ? frame
                  .locator(`[data-value="${option.replace(/"/g, '\\"')}"]`)
                  .filter({ visible: true })
                  .first()
              : roleOptions.filter({ hasText: option }).first();
        if (by === 'label' && (await pick.count()) === 0) {
          pick = frame
            .locator('li, [role="menuitem"], .option, [class*="option"], [class*="item"]')
            .filter({ visible: true })
            .getByText(option, { exact: true })
            .first();
        }
        if ((await pick.count()) > 0) {
          await pick.click({ timeout: left(ctx) });
          return;
        }
      }
      if (Date.now() >= deadline - 150) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new EngineError('ELEMENT_NOT_FOUND', `Option "${option}" not found in the dropdown`, {
      option,
      timeoutMs: ctx.timeoutMs,
    });
  },
});
