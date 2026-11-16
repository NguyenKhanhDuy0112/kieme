import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { DbError, type Patch, Repo, type RepoContext, validation } from '../repo';
import { folders, projects, testCases } from '../tables';

const name = z.string().trim().min(1).max(200);
export const ProjectInputSchema = z.object({ name, description: z.string().max(2000).nullish() });
export const FolderInputSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullish(),
  name,
});

export class ProjectService {
  readonly repo: Repo<typeof projects>;
  constructor(ctx: RepoContext) {
    this.repo = new Repo(ctx, projects, 'project');
  }
  list() {
    return this.repo.list(undefined, projects.name);
  }
  get(id: string) {
    return this.repo.get(id);
  }
  create(input: z.input<typeof ProjectInputSchema>) {
    const p = ProjectInputSchema.safeParse(input);
    if (!p.success) throw validation('project', p.error.issues);
    return this.repo.create({ name: p.data.name, description: p.data.description ?? null });
  }
  update(id: string, input: Patch<z.input<typeof ProjectInputSchema>>, expectedVersion?: number) {
    const p = ProjectInputSchema.partial().safeParse(input);
    if (!p.success) throw validation('project', p.error.issues);
    return this.repo.update(id, p.data, expectedVersion);
  }
  remove(id: string) {
    this.repo.remove(id);
  }
}

export class FolderService {
  readonly repo: Repo<typeof folders>;
  readonly #ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.#ctx = ctx;
    this.repo = new Repo(ctx, folders, 'folder');
  }
  list(projectId: string) {
    return this.repo.list(eq(folders.projectId, projectId), folders.sortOrder);
  }
  create(input: z.input<typeof FolderInputSchema>) {
    const p = FolderInputSchema.safeParse(input);
    if (!p.success) throw validation('folder', p.error.issues);
    if (p.data.parentId) this.repo.get(p.data.parentId);
    const siblings = this.list(p.data.projectId).filter(
      (f) => (f.parentId ?? null) === (p.data.parentId ?? null),
    );
    return this.repo.create({
      projectId: p.data.projectId,
      parentId: p.data.parentId ?? null,
      name: p.data.name,
      sortOrder: siblings.length,
    });
  }
  rename(id: string, newName: string, expectedVersion?: number) {
    const n = name.safeParse(newName);
    if (!n.success) throw validation('folder', n.error.issues);
    return this.repo.update(id, { name: n.data }, expectedVersion);
  }
  /** Move under another folder (or the root); refuses to move into itself / a descendant. */
  move(id: string, parentId: string | null, sortOrder?: number) {
    const folder = this.repo.get(id);
    if (parentId) {
      let cur: string | null = parentId;
      while (cur) {
        if (cur === id)
          throw new DbError('VALIDATION', 'A folder cannot be moved into itself', { id, parentId });
        cur = this.repo.get(cur).parentId;
      }
    }
    return this.repo.update(folder.id, {
      parentId,
      ...(sortOrder === undefined ? {} : { sortOrder }),
    });
  }
  /** Soft-deletes the folder, its sub-folders and the tests inside. */
  remove(id: string) {
    const all = this.list(this.repo.get(id).projectId);
    const doomed = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) {
        if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) {
          doomed.add(f.id);
          grew = true;
        }
      }
    }
    const tests = new Repo(this.#ctx, testCases, 'test case');
    this.#ctx.db.transaction(() => {
      for (const fid of doomed) {
        for (const t of tests.list(and(eq(testCases.folderId, fid), isNull(testCases.deletedAt))))
          tests.remove(t.id);
        this.repo.remove(fid);
      }
    });
  }
}
