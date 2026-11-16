import {
  CURRENT_SCHEMA_VERSION,
  parseTestCase,
  type TestCase,
  TestCaseSchema,
} from '@kiemi/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { DbError, newId, Repo, type RepoContext, validation } from '../repo';
import { testCases } from '../tables';

export const NewTestCaseSchema = z.object({
  projectId: z.string().min(1),
  folderId: z.string().min(1).nullish(),
  name: z.string().trim().min(1).max(300),
});

export type TestCaseRow = typeof testCases.$inferSelect;
/** List item without the (possibly large) content. */
export type TestCaseSummary = Omit<TestCaseRow, 'content'> & { stepCount: number };

export class TestCaseService {
  readonly repo: Repo<typeof testCases>;
  readonly #ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.#ctx = ctx;
    this.repo = new Repo(ctx, testCases, 'test case');
  }

  list(projectId: string, folderId?: string | null): TestCaseSummary[] {
    const filter =
      folderId === undefined
        ? eq(testCases.projectId, projectId)
        : and(
            eq(testCases.projectId, projectId),
            folderId === null ? isNull(testCases.folderId) : eq(testCases.folderId, folderId),
          );
    return this.repo
      .list(filter, testCases.name)
      .map(({ content, ...rest }) => ({ ...rest, stepCount: content.steps.length }));
  }

  get(id: string): TestCaseRow {
    return this.repo.get(id);
  }

  /** New empty test with a ready-to-use `.kiemi.json` document. */
  create(input: z.input<typeof NewTestCaseSchema>): TestCaseRow {
    const p = NewTestCaseSchema.safeParse(input);
    if (!p.success) throw validation('test case', p.error.issues);
    const id = newId();
    const content = TestCaseSchema.parse({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      name: p.data.name,
      steps: [],
    });
    return this.repo.create({
      id,
      projectId: p.data.projectId,
      folderId: p.data.folderId ?? null,
      ...this.#columns(content),
    });
  }

  /**
   * Saves a new version of the test document. Older documents are migrated;
   * the name/tags/description columns follow the document.
   */
  save(id: string, document: unknown, expectedVersion?: number): TestCaseRow {
    let content: TestCase;
    try {
      content = parseTestCase(document).testCase;
    } catch (err) {
      if (err instanceof z.ZodError) throw validation('test case', err.issues);
      throw new DbError('VALIDATION', err instanceof Error ? err.message : String(err), {
        entity: 'test case',
      });
    }
    if (content.id !== id) content = { ...content, id };
    return this.repo.update(id, this.#columns(content), expectedVersion);
  }

  rename(id: string, name: string, expectedVersion?: number): TestCaseRow {
    const row = this.get(id);
    return this.save(id, { ...row.content, name }, expectedVersion);
  }

  move(id: string, folderId: string | null): TestCaseRow {
    return this.repo.update(id, { folderId });
  }

  duplicate(id: string, name?: string): TestCaseRow {
    const src = this.get(id);
    const newIdValue = newId();
    const content: TestCase = {
      ...structuredClone(src.content),
      id: newIdValue,
      name: name ?? `${src.name} (bản sao)`,
    };
    return this.repo.create({
      id: newIdValue,
      projectId: src.projectId,
      folderId: src.folderId,
      ...this.#columns(content),
    });
  }

  /** Inserts an already-validated document (import) with a fresh id. */
  insertDocument(projectId: string, folderId: string | null, content: TestCase): TestCaseRow {
    const id = newId();
    return this.#ctx.db.transaction(() =>
      this.repo.create({ id, projectId, folderId, ...this.#columns({ ...content, id }) }),
    );
  }

  remove(id: string): void {
    this.repo.remove(id);
  }

  #columns(content: TestCase) {
    return {
      name: content.name,
      description: content.description ?? null,
      tags: content.tags,
      content,
      schemaVersion: content.schemaVersion,
    };
  }
}
