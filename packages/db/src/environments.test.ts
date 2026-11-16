import { describe, expect, it } from 'vitest';
import { DbError } from './repo';
import { createMemoryServices, fakeCipher } from './testing';

describe('environments, variables, secrets [S-06, E-08, N-07]', () => {
  it('stores variables and replaces them', () => {
    const { services: s, defaultProjectId: projectId } = createMemoryServices();
    const env = s.environments.create({
      projectId,
      name: 'UAT',
      baseUrl: 'https://uat.example.com',
    });
    s.environments.setVariables(env.id, { portalUrl: 'https://p', user: 'an' });
    expect(s.environments.setVariables(env.id, { portalUrl: 'https://p2', lang: 'vi' })).toEqual({
      lang: 'vi',
      portalUrl: 'https://p2',
    });
    expect(() => s.environments.setVariables(env.id, { 'bad-name': 'x' })).toThrow(DbError);
    expect(() => s.environments.create({ projectId, name: 'uat' })).toThrow(/already exists/);
  });

  it('encrypts secrets, never returns values to the UI, decrypts for runs', () => {
    const { services: s, defaultProjectId: projectId } = createMemoryServices();
    const env = s.environments.create({
      projectId,
      name: 'Staging',
      proxy: { server: 'http://proxy:3128', username: 'u', passwordSecret: 'proxyPass' },
    });
    s.environments.setSecret(env.id, 'nvPass', 'P@ss-123');
    s.environments.setSecret(env.id, 'proxyPass', 'px');
    s.environments.setSecret(env.id, 'nvPass', 'P@ss-456'); // replace
    const raw = s.environments.secrets.list().map((r) => r.ciphertext.toString('utf8'));
    expect(raw.join()).not.toContain('P@ss');
    const view = s.environments.get(env.id);
    expect(view.secrets.map((x) => x.name)).toEqual(['nvPass', 'proxyPass']);
    expect(JSON.stringify(view)).not.toContain('P@ss');
    const run = s.environments.forRun(env.id);
    expect(run.secrets).toEqual({ nvPass: 'P@ss-456', proxyPass: 'px' });
    expect(run.env).toMatchObject({
      name: 'Staging',
      secretNames: ['nvPass', 'proxyPass'],
      proxy: { server: 'http://proxy:3128' },
    });
    s.environments.removeSecret(env.id, 'proxyPass');
    expect(s.environments.listSecrets(env.id).map((x) => x.name)).toEqual(['nvPass']);
  });

  it('refuses to store secrets without the OS keychain', () => {
    const { services: s, defaultProjectId: projectId } = createMemoryServices(fakeCipher(false));
    const env = s.environments.list(projectId)[0];
    expect(env).toBeDefined();
    let err: unknown;
    try {
      s.environments.setSecret(env?.id as string, 'x', 'y');
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'SECRETS_UNAVAILABLE' });
  });
});
