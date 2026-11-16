import { isNull } from 'drizzle-orm';
import type { KiemiDb } from '../database';
import { newId } from '../repo';
import { environments, projects, settings, workspaces } from '../tables';

export interface SeedResult {
  workspaceId: string;
  projectId: string;
  created: boolean;
}

/**
 * First start: create the default workspace, a first project and a default
 * environment so testers can start right away [M2-01]. Idempotent.
 */
export function ensureDefaultWorkspace(
  db: KiemiDb,
  now: () => Date = () => new Date(),
): SeedResult {
  const existing = db.select().from(workspaces).where(isNull(workspaces.deletedAt)).limit(1).get();
  if (existing) {
    const project = db.select().from(projects).where(isNull(projects.deletedAt)).limit(1).get();
    return { workspaceId: existing.id, projectId: project?.id ?? '', created: false };
  }
  const t = now();
  const workspaceId = newId();
  const projectId = newId();
  const meta = (id: string) => ({
    id,
    workspaceId,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    version: 1,
  });
  db.transaction((tx) => {
    tx.insert(workspaces)
      .values({ ...meta(workspaceId), name: 'Không gian của tôi' })
      .run();
    tx.insert(projects)
      .values({ ...meta(projectId), name: 'Dự án đầu tiên', description: null })
      .run();
    tx.insert(environments)
      .values({
        ...meta(newId()),
        projectId,
        name: 'Mặc định',
        baseUrl: null,
        proxy: null,
        sortOrder: 0,
      })
      .run();
    tx.insert(settings)
      .values({ ...meta(newId()), key: 'language', value: 'vi' })
      .run();
  });
  return { workspaceId, projectId, created: true };
}
