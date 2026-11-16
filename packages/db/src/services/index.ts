import type { RepoContext } from '../repo';
import { DatasetService } from './datasets';
import { ElementService } from './elements';
import { EnvironmentService, type SecretCipher } from './environments';
import { FolderService, ProjectService } from './projects';
import { SharedStepService } from './shared-steps';
import { SuiteService } from './suites';
import { TestCaseService } from './test-cases';

export * from './datasets';
export * from './elements';
export * from './environments';
export * from './projects';
export * from './shared-steps';
export * from './suites';
export * from './test-cases';
export * from './workspace';

export interface Services {
  readonly ctx: RepoContext;
  readonly projects: ProjectService;
  readonly folders: FolderService;
  readonly testCases: TestCaseService;
  readonly suites: SuiteService;
  readonly sharedSteps: SharedStepService;
  readonly elements: ElementService;
  readonly environments: EnvironmentService;
  readonly datasets: DatasetService;
}

/** All data services of one workspace. */
export function createServices(ctx: RepoContext, cipher: SecretCipher): Services {
  return {
    ctx,
    projects: new ProjectService(ctx),
    folders: new FolderService(ctx),
    testCases: new TestCaseService(ctx),
    suites: new SuiteService(ctx),
    sharedSteps: new SharedStepService(ctx),
    elements: new ElementService(ctx),
    environments: new EnvironmentService(ctx, cipher),
    datasets: new DatasetService(ctx),
  };
}
