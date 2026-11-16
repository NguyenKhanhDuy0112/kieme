import { openDatabase } from './database';
import {
  createServices,
  ensureDefaultWorkspace,
  type SecretCipher,
  type Services,
} from './services';

/** Reversible fake for tests: NOT encryption. */
export const fakeCipher = (available = true): SecretCipher => ({
  isAvailable: () => available,
  encrypt: (plain) => Buffer.from(`enc:${Buffer.from(plain, 'utf8').toString('base64')}`, 'utf8'),
  decrypt: (cipher) =>
    Buffer.from(cipher.toString('utf8').replace(/^enc:/, ''), 'base64').toString('utf8'),
});

/** In-memory database with the default workspace — for tests. */
export function createMemoryServices(cipher: SecretCipher = fakeCipher()): {
  services: Services;
  defaultProjectId: string;
} {
  const db = openDatabase({ path: ':memory:' });
  const seed = ensureDefaultWorkspace(db);
  return {
    services: createServices({ db, workspaceId: seed.workspaceId }, cipher),
    defaultProjectId: seed.projectId,
  };
}
