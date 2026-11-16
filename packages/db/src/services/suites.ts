import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Patch, Repo, type RepoContext, validation } from '../repo';
import { suiteItems, suites } from '../tables';

export const SuiteInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  variables: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string()).default({}),
  environmentId: z.string().min(1).nullish(),
});
export const SuiteItemInputSchema = z.object({
  testCaseId: z.string().min(1),
  datasetId: z.string().min(1).nullish(),
  enabled: z.boolean().default(true),
});

export class SuiteService {
  readonly repo: Repo<typeof suites>;
  readonly items: Repo<typeof suiteItems>;
  readonly #ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.#ctx = ctx;
    this.repo = new Repo(ctx, suites, 'suite');
    this.items = new Repo(ctx, suiteItems, 'suite item');
  }
  list(projectId: string) {
    return this.repo.list(eq(suites.projectId, projectId), suites.name);
  }
  get(id: string) {
    return { ...this.repo.get(id), items: this.listItems(id) };
  }
  create(input: z.input<typeof SuiteInputSchema>) {
    const p = SuiteInputSchema.safeParse(input);
    if (!p.success) throw validation('suite', p.error.issues);
    return this.repo.create({
      ...p.data,
      description: p.data.description ?? null,
      environmentId: p.data.environmentId ?? null,
    });
  }
  update(
    id: string,
    input: Patch<Omit<z.input<typeof SuiteInputSchema>, 'projectId'>>,
    expectedVersion?: number,
  ) {
    const p = SuiteInputSchema.omit({ projectId: true }).partial().safeParse(input);
    if (!p.success) throw validation('suite', p.error.issues);
    return this.repo.update(id, p.data, expectedVersion);
  }
  listItems(suiteId: string) {
    return this.items.list(eq(suiteItems.suiteId, suiteId), suiteItems.sortOrder);
  }
  /** Replaces the ordered list of tests in the suite. */
  setItems(suiteId: string, items: z.input<typeof SuiteItemInputSchema>[]) {
    this.repo.get(suiteId);
    const parsed = z.array(SuiteItemInputSchema).safeParse(items);
    if (!parsed.success) throw validation('suite', parsed.error.issues);
    this.#ctx.db.transaction(() => {
      for (const old of this.items.list(and(eq(suiteItems.suiteId, suiteId))))
        this.items.remove(old.id);
      for (const [i, it] of parsed.data.entries()) {
        this.items.create({
          suiteId,
          testCaseId: it.testCaseId,
          datasetId: it.datasetId ?? null,
          enabled: it.enabled,
          sortOrder: i,
        });
      }
    });
    return this.listItems(suiteId);
  }
  remove(id: string) {
    this.#ctx.db.transaction(() => {
      for (const it of this.listItems(id)) this.items.remove(it.id);
      this.repo.remove(id);
    });
  }
}
