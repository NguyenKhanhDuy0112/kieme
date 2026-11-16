import { TRPCError } from '@trpc/server';
import type { UpdateState } from '../../update/update-service';
import { publicProcedure, router } from '../trpc';

const OFF: UpdateState = { status: 'off' };

/** App updates [N-09, N-12]. Without an update service (dev, tests) everything is `off`. */
export const updatesRouter = router({
  state: publicProcedure.query(({ ctx }) => ctx.updates?.state() ?? OFF),

  events: publicProcedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.updates) {
      yield OFF;
      return;
    }
    yield* ctx.updates.events(signal);
  }),

  /** "Kiểm tra cập nhật" in Settings. */
  check: publicProcedure.mutation(({ ctx }) => ctx.updates?.check() ?? OFF),

  /** "Khởi động lại để cập nhật". */
  install: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.updates?.install())
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No downloaded update' });
    return true;
  }),

  /** Portable: open the release page in the OS browser to download the new exe. */
  openDownloadPage: publicProcedure.mutation(({ ctx }) => {
    const s = ctx.updates?.state();
    if (s?.status !== 'available' || !ctx.desktop)
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No update to download' });
    ctx.desktop.openExternal(s.url);
    return true;
  }),
});
