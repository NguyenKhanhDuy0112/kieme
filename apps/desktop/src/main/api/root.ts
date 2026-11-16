import { appRouter } from './routers/app';
import {
  datasetsRouter,
  elementsRouter,
  environmentsRouter,
  foldersRouter,
  ioRouter,
  projectsRouter,
  sharedStepsRouter,
  suitesRouter,
  testCasesRouter,
} from './routers/data';
import { systemRouter } from './routers/system';
import { createCallerFactory, router } from './trpc';

export const rootRouter = router({
  app: appRouter,
  system: systemRouter,
  projects: projectsRouter,
  folders: foldersRouter,
  testCases: testCasesRouter,
  suites: suitesRouter,
  sharedSteps: sharedStepsRouter,
  elements: elementsRouter,
  environments: environmentsRouter,
  datasets: datasetsRouter,
  io: ioRouter,
});

export type AppRouter = typeof rootRouter;

export const createCaller = createCallerFactory(rootRouter);
