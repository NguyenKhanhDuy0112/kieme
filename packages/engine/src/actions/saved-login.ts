import { z } from 'zod';
import { defineAction } from '../define-action';
import { EngineError } from '../errors';

const loginName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Letters, digits or _');

/**
 * "Lưu đăng nhập": keeps the cookies + localStorage of this session under a
 * name so later tests can skip logging in, until it expires [F-02].
 */
export const saveSessionAction = defineAction({
  type: 'saveSession',
  params: z.object({
    name: loginName,
    /** How long the saved login can be reused. */
    ttlHours: z.number().positive().max(8760).default(8),
  }),
  ui: { label: 'actions.saveSession', icon: 'key-round', group: 'tabs' },
  async execute({ name, ttlHours }, ctx) {
    const state = await (await ctx.context()).storageState();
    const expiresAt = new Date(ctx.run.now().getTime() + ttlHours * 3_600_000).toISOString();
    ctx.run.savedLogins.save(name, { state, expiresAt });
    ctx.log(`Saved login "${name}" until ${expiresAt}`);
  },
});

/** "Dùng đăng nhập đã lưu": restores a saved login into this session [F-02]. */
export const useSessionAction = defineAction({
  type: 'useSession',
  params: z.object({ name: loginName }),
  ui: { label: 'actions.useSession', icon: 'log-in', group: 'tabs' },
  async execute({ name }, ctx) {
    const saved = ctx.run.savedLogins.get(name);
    if (!saved) {
      throw new EngineError('LOGIN_NOT_SAVED', `No saved login "${name}"`, { name });
    }
    if (Date.parse(saved.expiresAt) <= ctx.run.now().getTime()) {
      throw new EngineError('LOGIN_EXPIRED', `Saved login "${name}" expired`, {
        name,
        expiresAt: saved.expiresAt,
      });
    }
    const context = await ctx.context();
    await context.addCookies(saved.state.cookies);
    if (saved.state.origins.length) {
      // localStorage is per origin: fill it on every page of those origins (if not set yet).
      await context.addInitScript((origins) => {
        const o = origins.find((x) => x.origin === location.origin);
        if (!o) return;
        for (const item of o.localStorage) {
          try {
            if (localStorage.getItem(item.name) === null)
              localStorage.setItem(item.name, item.value);
          } catch {
            // storage blocked
          }
        }
      }, saved.state.origins);
    }
    ctx.log(`Using saved login "${name}"`);
  },
});
