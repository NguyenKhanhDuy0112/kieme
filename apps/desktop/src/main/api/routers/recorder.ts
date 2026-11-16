import { LocatorSchema } from '@kiemi/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { type RecorderManager, StartRecordingInputSchema } from '../../record/recorder-manager';
import { publicProcedure, router } from '../trpc';

const recordingId = z.object({ recordingId: z.string().min(1) });

function manager(ctx: { recorder?: RecorderManager | undefined }) {
  if (!ctx.recorder) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No recorder' });
  return ctx.recorder;
}

/** Record steps in a visible browser; Pick / Highlight elements [M5]. */
export const recorderRouter = router({
  start: publicProcedure
    .input(StartRecordingInputSchema)
    .mutation(({ ctx, input }) => manager(ctx).start(input)),

  stop: publicProcedure
    .input(recordingId)
    .mutation(({ ctx, input }) => ({ stopped: manager(ctx).stop(input.recordingId) })),

  /** The recording / inspect session in progress, if any. */
  current: publicProcedure.query(({ ctx }) => ctx.recorder?.current() ?? null),

  /** Waits for the tester to click an element; null if cancelled [C-06]. */
  pick: publicProcedure
    .input(recordingId)
    .mutation(async ({ ctx, input }) => ({ locator: await manager(ctx).pick(input.recordingId) })),

  highlight: publicProcedure
    .input(recordingId.extend({ locator: LocatorSchema }))
    .mutation(({ ctx, input }) => manager(ctx).highlight(input.recordingId, input.locator)),

  /** ✓ / ✕ on a suggested check [M-01]. */
  suggestion: publicProcedure
    .input(recordingId.extend({ id: z.string().min(1), accept: z.boolean() }))
    .mutation(({ ctx, input }) => ({
      ok: manager(ctx).suggestion(input.recordingId, input.id, input.accept),
    })),

  events: publicProcedure.input(recordingId).subscription(async function* ({ ctx, input, signal }) {
    yield* manager(ctx).events(input.recordingId, signal);
  }),
});

/** Saved login sessions of a project (names + expiry only, never cookies) [F-02]. */
export const savedLoginsRouter = router({
  list: publicProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(({ ctx, input }) => ctx.services.savedLogins.list(input.projectId)),
  remove: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ ctx, input }) => {
    ctx.services.savedLogins.remove(input.id);
    return { ok: true };
  }),
});
