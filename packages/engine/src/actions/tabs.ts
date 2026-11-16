import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { left, text } from './_common';

/** Open a new tab (optionally at a URL); it becomes the active tab [A-13]. */
export const newTabAction = defineAction({
  type: 'newTab',
  params: z.object({ url: text.optional() }),
  ui: { label: 'actions.newTab', icon: 'app-window', group: 'tabs' },
  async execute({ url }, ctx) {
    const context = await ctx.context();
    await ctx.page(); // make sure the session exists first
    const page = await context.newPage();
    await ctx.run.pages.setActivePage(ctx.session, page);
    if (url) await page.goto(ctx.run.url(url), { timeout: left(ctx) });
  },
});

/** Switch to another tab by position, title or URL [A-13]. Waits for it to open. */
export const switchTabAction = defineAction({
  type: 'switchTab',
  params: z.object({ by: z.enum(['index', 'title', 'url']).default('index'), value: text }),
  ui: { label: 'actions.switchTab', icon: 'arrow-right-left', group: 'tabs' },
  async execute({ by, value }, ctx) {
    const deadline = Date.now() + left(ctx);
    for (;;) {
      const pages = await ctx.run.pages.pages(ctx.session);
      let found = by === 'index' ? pages[Number(value) - 1] : undefined;
      if (by !== 'index') {
        for (const p of pages) {
          const hay = by === 'url' ? p.url() : await p.title().catch(() => '');
          if (hay.toLowerCase().includes(value.toLowerCase())) {
            found = p;
            break;
          }
        }
      }
      if (found) {
        await ctx.run.pages.setActivePage(ctx.session, found);
        await found
          .waitForLoadState('domcontentloaded', { timeout: left(ctx) })
          .catch(() => undefined);
        return;
      }
      if (Date.now() > deadline - 150) {
        throw new EngineError('TAB_NOT_FOUND', `No tab with ${by} "${value}"`, {
          by,
          value,
          tabs: pages.length,
        });
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  },
});

/** Close the active tab (or the N-th); the previous tab becomes active [A-13]. */
export const closeTabAction = defineAction({
  type: 'closeTab',
  params: z.object({ index: z.number().int().positive().optional() }),
  ui: { label: 'actions.closeTab', icon: 'x', group: 'tabs' },
  async execute({ index }, ctx) {
    const pages = await ctx.run.pages.pages(ctx.session);
    const page = index === undefined ? await ctx.page() : pages[index - 1];
    if (!page)
      throw new EngineError('TAB_NOT_FOUND', `No tab number ${index}`, {
        by: 'index',
        value: index,
        tabs: pages.length,
      });
    await page.close();
    const rest = (await ctx.run.pages.pages(ctx.session)).filter((p) => p !== page);
    const next = rest.at(-1);
    if (next) await ctx.run.pages.setActivePage(ctx.session, next);
  },
});
