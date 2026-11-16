import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { left, target, text } from './_common';

/** Upload files (fixed paths or from test data) [A-11]. */
export const uploadAction = defineAction({
  type: 'upload',
  params: z.object({ target, files: z.union([text, z.array(text).min(1)]) }),
  ui: { label: 'actions.upload', icon: 'upload', group: 'input' },
  async execute({ target: t, files }, ctx) {
    const list = (Array.isArray(files) ? files : [files]).map((f) =>
      isAbsolute(f) || !ctx.run.filesDir ? f : resolve(ctx.run.filesDir, f),
    );
    for (const f of list) {
      if (!existsSync(f))
        throw new EngineError('FILE_NOT_FOUND', `File not found: ${f}`, { file: f });
    }
    const { locator } = await ctx.resolve(t, { state: 'attached' });
    const isFileInput = await locator.evaluate(
      (el) => el instanceof HTMLInputElement && el.type === 'file',
    );
    if (isFileInput) {
      await locator.setInputFiles(list, { timeout: left(ctx) });
      return;
    }
    // A button that opens the file dialog.
    const page = await ctx.page();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: left(ctx) }),
      locator.click({ timeout: left(ctx) }),
    ]);
    await chooser.setFiles(list);
  },
});
