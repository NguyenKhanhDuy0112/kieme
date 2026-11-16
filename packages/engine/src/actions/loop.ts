import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { target } from './_common';

const MAX_ITERATIONS = 1000;

/**
 * Repeat steps [D-04]: N times, over every data row, or over every row of a
 * table on the page. Inside: `{{loop.index}}` (from 1), `{{loop.count}}`, data
 * columns / table cells by header (`{{loop.Tên}}`), `{{loop.text}}`, `{{loop.cells[0]}}`.
 */
export const loopAction = defineAction({
  type: 'loop',
  params: z
    .object({
      over: z.enum(['times', 'data', 'tableRows']).default('times'),
      times: z.coerce.number().int().nonnegative().max(MAX_ITERATIONS).optional(),
      target: target.optional(),
      steps: z.array(z.record(z.string(), z.unknown())).min(1),
    })
    .refine((p) => p.over !== 'times' || p.times !== undefined, 'times is required')
    .refine(
      (p) => p.over !== 'tableRows' || p.target !== undefined,
      'target (the table) is required',
    ),
  ui: { label: 'actions.loop', icon: 'repeat', group: 'flow' },
  rawParams: ['steps'],
  container: true,
  async execute(p, ctx) {
    let items: Record<string, unknown>[];
    if (p.over === 'times') {
      items = Array.from({ length: p.times ?? 0 }, () => ({}));
    } else if (p.over === 'data') {
      items = [...(ctx.run.dataset?.rows ?? [])];
    } else {
      const { locator } = await ctx.resolve(p.target as NonNullable<typeof p.target>);
      items = await locator.evaluate((el) => {
        const text = (e: Element) => ((e as HTMLElement).innerText ?? e.textContent ?? '').trim();
        const rows = [...el.querySelectorAll('tr, [role="row"]')];
        const isHeader = (r: Element) =>
          r.querySelector('td, [role="cell"], [role="gridcell"]') === null;
        const header = rows.find(isHeader);
        const names = header ? [...header.children].map(text) : [];
        return rows
          .filter((r) => !isHeader(r))
          .map((r) => {
            const cells = [...r.children].map(text);
            const item: Record<string, unknown> = { text: text(r), cells };
            names.forEach((n, i) => {
              if (n && !(n in item)) item[n] = cells[i] ?? '';
            });
            return item;
          });
      });
    }
    if (items.length > MAX_ITERATIONS) {
      throw new EngineError(
        'INVALID_PARAMS',
        `Too many iterations (${items.length} > ${MAX_ITERATIONS})`,
        { count: items.length },
      );
    }
    ctx.log(`Loop: ${items.length} iteration(s)`);
    for (const [i, item] of items.entries()) {
      await ctx.runSteps(p.steps, { loop: { ...item, index: i + 1, count: items.length } });
    }
  },
});
