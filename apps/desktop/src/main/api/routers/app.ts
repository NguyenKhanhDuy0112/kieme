import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const appRouter = router({
  /** Basic app information for the renderer (version, OS). */
  info: publicProcedure.query(({ ctx }) => ({
    name: 'Kiemi',
    version: ctx.appVersion,
    platform: ctx.platform,
    defaultProjectId: ctx.defaultProjectId,
  })),

  /** Sample procedure with Zod-validated input; proves the IPC round trip. */
  echo: publicProcedure
    .input(z.object({ message: z.string().trim().min(1).max(200) }))
    .mutation(({ input }) => ({ message: input.message, receivedAt: new Date().toISOString() })),
});
