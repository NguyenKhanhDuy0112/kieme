import { appRouter } from './routers/app';
import { createCallerFactory, router } from './trpc';

export const rootRouter = router({
  app: appRouter,
});

export type AppRouter = typeof rootRouter;

export const createCaller = createCallerFactory(rootRouter);
