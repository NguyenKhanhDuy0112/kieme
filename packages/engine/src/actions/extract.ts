import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';
import { target } from './_common';

/**
 * Save a value from the page into a variable [E-04]: element text, field
 * value, an attribute, or (part of) the URL / title via a regex.
 */
export const extractAction = defineAction({
  type: 'extract',
  params: z
    .object({
      target: target.optional(),
      from: z.enum(['text', 'value', 'attribute', 'url', 'title']).default('text'),
      attribute: z.string().min(1).optional(),
      /** Keep only the part matching this regex (first group if any). */
      regex: z.string().min(1).optional(),
      into: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    })
    .refine(
      (p) => p.from === 'url' || p.from === 'title' || p.target !== undefined,
      'target is required',
    )
    .refine((p) => p.from !== 'attribute' || p.attribute !== undefined, 'attribute is required'),
  ui: { label: 'actions.extract', icon: 'variable', group: 'data' },
  async execute(p, ctx) {
    let raw: string;
    if (p.from === 'url') raw = (await ctx.page()).url();
    else if (p.from === 'title') raw = await (await ctx.page()).title();
    else {
      const { locator } = await ctx.resolve(p.target as NonNullable<typeof p.target>, {
        state: p.from === 'text' ? 'visible' : 'attached',
      });
      if (p.from === 'attribute') raw = (await locator.getAttribute(p.attribute as string)) ?? '';
      else if (p.from === 'value')
        raw = await locator.inputValue().catch(async () => (await locator.textContent()) ?? '');
      else raw = (await locator.innerText()).trim();
    }
    let value = raw;
    if (p.regex) {
      let re: RegExp;
      try {
        re = new RegExp(p.regex, 'u');
      } catch {
        throw new EngineError('INVALID_PARAMS', `Invalid regex "${p.regex}"`, { regex: p.regex });
      }
      const m = re.exec(raw);
      if (!m)
        throw new EngineError('ACTION_FAILED', `"${raw}" does not match /${p.regex}/`, {
          value: raw,
          regex: p.regex,
        });
      value = m[1] ?? m[0];
    }
    ctx.vars.set(p.into, value);
    ctx.log(`${p.into} = ${value}`);
  },
});
