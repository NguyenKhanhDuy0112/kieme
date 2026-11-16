import { z } from 'zod';
import { defineAction } from '../define-action';

/**
 * Switch to another session (user A/B/C) [A-16, F-01]: steps after it use that
 * session (set by the editor); at run time it opens the session if needed and
 * brings its window to the front.
 */
export const switchSessionAction = defineAction({
  type: 'switchSession',
  params: z.object({}),
  ui: { label: 'actions.switchSession', icon: 'users', group: 'tabs' },
  async execute(_p, ctx) {
    const page = await ctx.page();
    await page.bringToFront().catch(() => undefined);
    ctx.log(`Session: ${ctx.session}`);
  },
});
