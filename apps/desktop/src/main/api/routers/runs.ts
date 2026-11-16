import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

/** Run a test in the engine process and follow it live [M4-01, N-05]. */
export const runsRouter = router({
  start: publicProcedure
    .input(
      z.object({
        testCaseId: z.string().min(1),
        environmentId: z.string().min(1).nullable().optional(),
        rowIndex: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.runs.start(input)),

  cancel: publicProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(({ ctx, input }) => ({ cancelled: ctx.runs.cancel(input.runId) })),

  /** Stored run with its cases (for the screen after a reload). */
  get: publicProcedure.input(z.object({ runId: z.string().min(1) })).query(({ ctx, input }) => {
    const run = ctx.services.runs.get(input.runId);
    return {
      ...run,
      running: ctx.runs.isRunning(run.id),
      cases: ctx.services.runs.listCases(run.id),
    };
  }),

  /** Past + live events of one run; ends when the run ends. */
  events: publicProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .subscription(async function* ({ ctx, input, signal }) {
      yield* ctx.runs.events(input.runId, signal);
    }),
});
