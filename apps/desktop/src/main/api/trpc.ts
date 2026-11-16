import type { Services } from '@kiemi/db';
import { DbError } from '@kiemi/db';
import { initTRPC, TRPCError } from '@trpc/server';
import type { RunManager } from '../run/run-manager';

/** Per-request context supplied by the main process. Must stay free of Electron imports. */
export interface ApiContext {
  appVersion: string;
  platform: string;
  /** Data services of the current workspace. */
  services: Services;
  /** Project created on first start (default selection in the UI). */
  defaultProjectId: string;
  /** Starts runs in the engine utility process [M4-01]. */
  runs: RunManager;
}

const DB_TO_TRPC = {
  NOT_FOUND: 'NOT_FOUND',
  VERSION_CONFLICT: 'CONFLICT',
  VALIDATION: 'BAD_REQUEST',
  NAME_TAKEN: 'CONFLICT',
  SECRETS_UNAVAILABLE: 'PRECONDITION_FAILED',
  IMPORT_FAILED: 'BAD_REQUEST',
} as const;

const t = initTRPC.context<ApiContext>().create({
  isServer: true,
  // The renderer translates `data.kiemiCode` + `data.details` into plain Vietnamese.
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    return {
      ...shape,
      data: {
        ...shape.data,
        ...(cause instanceof DbError
          ? { kiemiCode: cause.code, details: cause.details ?? null }
          : {}),
      },
    };
  },
});

/** Converts data-layer errors into tRPC errors (code + original cause). */
const dbErrors = t.middleware(async ({ next }) => {
  const res = await next();
  if (!res.ok && res.error.cause instanceof DbError) {
    const cause = res.error.cause;
    throw new TRPCError({ code: DB_TO_TRPC[cause.code], message: cause.message, cause });
  }
  return res;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(dbErrors);
export const createCallerFactory = t.createCallerFactory;
