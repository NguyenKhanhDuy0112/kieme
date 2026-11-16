import { z } from 'zod';
import { defineAction } from '../define-action';
import { text } from './_common';

/**
 * Answer the next alert/confirm/prompt of this session [A-14]. Place it before
 * the step that opens the dialog. The dialog text is saved as `{{dialogMessage}}`.
 */
export const dialogAction = defineAction({
  type: 'dialog',
  params: z.object({
    action: z.enum(['accept', 'dismiss']).default('accept'),
    text: text.optional(),
  }),
  ui: { label: 'actions.dialog', icon: 'message-square-warning', group: 'tabs' },
  async execute({ action, text: t }, ctx) {
    await ctx.page(); // dialogs are hooked per page: open the session if needed
    ctx.run.dialogs.arm(
      ctx.session,
      action === 'accept' ? { action, ...(t === undefined ? {} : { text: t }) } : { action },
    );
  },
});
