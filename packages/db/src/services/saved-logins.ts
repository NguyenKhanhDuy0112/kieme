import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DbError, Repo, type RepoContext, validation } from '../repo';
import { savedLogins } from '../tables';
import type { SecretCipher } from './environments';

export const SavedLoginNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Name must be letters, digits or _')
  .max(64);

/** Playwright storage state: cookies + localStorage per origin. */
export const StorageStateSchema = z.object({
  cookies: z.array(z.record(z.string(), z.unknown())),
  origins: z.array(
    z.object({
      origin: z.string(),
      localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
});
export type StorageStateData = z.infer<typeof StorageStateSchema>;

export interface SavedLoginInfo {
  id: string;
  name: string;
  expiresAt: Date;
  updatedAt: Date;
}

/** A saved login handed to the engine (decrypted, in memory only). */
export interface SavedLoginForRun {
  state: StorageStateData;
  /** ISO time after which the engine refuses to use it. */
  expiresAt: string;
}

/** Login sessions saved by tests or while recording, reused until they expire [F-02]. */
export class SavedLoginService {
  readonly repo: Repo<typeof savedLogins>;
  readonly #cipher: SecretCipher;

  constructor(ctx: RepoContext, cipher: SecretCipher) {
    this.repo = new Repo(ctx, savedLogins, 'savedLogin');
    this.#cipher = cipher;
  }

  list(projectId: string): SavedLoginInfo[] {
    return this.repo
      .list(eq(savedLogins.projectId, projectId), savedLogins.name)
      .map((r) => ({ id: r.id, name: r.name, expiresAt: r.expiresAt, updatedAt: r.updatedAt }));
  }

  /** Stores (or replaces) the login `name` of a project, encrypted. */
  save(projectId: string, name: string, state: unknown, expiresAt: Date): SavedLoginInfo {
    const n = SavedLoginNameSchema.safeParse(name);
    if (!n.success) throw validation('savedLogin', n.error.issues);
    const st = StorageStateSchema.safeParse(state);
    if (!st.success) throw validation('savedLogin', st.error.issues);
    if (!this.#cipher.isAvailable())
      throw new DbError('SECRETS_UNAVAILABLE', 'OS encryption is not available', {
        entity: 'savedLogin',
      });
    const ciphertext = this.#cipher.encrypt(JSON.stringify(st.data));
    const cur = this.repo.list(
      and(eq(savedLogins.projectId, projectId), eq(savedLogins.name, n.data)),
    )[0];
    const row = cur
      ? this.repo.update(cur.id, { ciphertext, expiresAt })
      : this.repo.create({ projectId, name: n.data, ciphertext, expiresAt });
    return { id: row.id, name: row.name, expiresAt: row.expiresAt, updatedAt: row.updatedAt };
  }

  remove(id: string): void {
    this.repo.remove(id);
  }

  /** Engine input: every saved login of the project, decrypted (unreadable ones are left out). */
  forRun(projectId: string): Record<string, SavedLoginForRun> {
    const out: Record<string, SavedLoginForRun> = {};
    if (!this.#cipher.isAvailable()) return out;
    for (const r of this.repo.list(eq(savedLogins.projectId, projectId))) {
      try {
        const state = StorageStateSchema.parse(JSON.parse(this.#cipher.decrypt(r.ciphertext)));
        out[r.name] = { state, expiresAt: r.expiresAt.toISOString() };
      } catch {
        // Encrypted on another machine / corrupted: the test asks to log in again.
      }
    }
    return out;
  }
}
