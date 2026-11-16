import { initTRPC } from '@trpc/server';

/** Per-request context supplied by the main process. Must stay free of Electron imports. */
export interface ApiContext {
  appVersion: string;
  platform: string;
}

const t = initTRPC.context<ApiContext>().create({ isServer: true });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
