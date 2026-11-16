import { z } from 'zod';
import { defineAction } from '../define-action';

/** Clear cookies and/or local/session storage of this session [A-17]. */
export const clearDataAction = defineAction({
  type: 'clearData',
  params: z.object({ cookies: z.boolean().default(true), storage: z.boolean().default(true) }),
  ui: { label: 'actions.clearData', icon: 'cookie', group: 'tabs' },
  async execute({ cookies, storage }, ctx) {
    const context = await ctx.context();
    if (cookies) await context.clearCookies();
    if (storage) {
      for (const page of await ctx.run.pages.pages(ctx.session)) {
        for (const frame of page.frames()) {
          await frame
            .evaluate(() => {
              localStorage.clear();
              sessionStorage.clear();
            })
            .catch(() => undefined); // about:blank / opaque origins
        }
      }
    }
  },
});
