import { LocatorSchema } from '@kiemi/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Patch, Repo, type RepoContext, validation } from '../repo';
import { elements } from '../tables';

export const ElementInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  locator: LocatorSchema,
  pageUrl: z.string().nullish(),
});

/** Project element library (picked elements with locator strategies) [C-01, C-02]. */
export class ElementService {
  readonly repo: Repo<typeof elements>;
  constructor(ctx: RepoContext) {
    this.repo = new Repo(ctx, elements, 'element');
  }
  list(projectId: string) {
    return this.repo.list(eq(elements.projectId, projectId), elements.name);
  }
  get(id: string) {
    return this.repo.get(id);
  }
  create(input: z.input<typeof ElementInputSchema>) {
    const p = ElementInputSchema.safeParse(input);
    if (!p.success) throw validation('element', p.error.issues);
    return this.repo.create({ ...p.data, pageUrl: p.data.pageUrl ?? null });
  }
  update(
    id: string,
    input: Patch<Omit<z.input<typeof ElementInputSchema>, 'projectId'>>,
    expectedVersion?: number,
  ) {
    const p = ElementInputSchema.omit({ projectId: true }).partial().safeParse(input);
    if (!p.success) throw validation('element', p.error.issues);
    return this.repo.update(id, p.data, expectedVersion);
  }
  remove(id: string) {
    this.repo.remove(id);
  }
}
