import { describe, expect, it } from 'vitest';
import { createMemoryServices } from './testing';

const state = {
  cookies: [{ name: 'sid', value: 'abc', domain: '127.0.0.1', path: '/' }],
  origins: [{ origin: 'http://127.0.0.1', localStorage: [{ name: 'token', value: 't' }] }],
};

describe('saved logins [F-02]', () => {
  it('saves encrypted, replaces by name, lists without the state, decrypts for runs', () => {
    const { services, defaultProjectId: p } = createMemoryServices();
    const exp = new Date('2026-11-17T08:00:00.000Z');
    const a = services.savedLogins.save(p, 'nhanVien', state, exp);
    const raw = services.savedLogins.repo.get(a.id).ciphertext.toString('utf8');
    expect(raw).not.toContain('abc');
    services.savedLogins.save(p, 'nhanVien', { ...state, cookies: [] }, exp);
    expect(services.savedLogins.list(p)).toEqual([
      { id: a.id, name: 'nhanVien', expiresAt: exp, updatedAt: expect.any(Date) },
    ]);
    expect(services.savedLogins.forRun(p)).toEqual({
      nhanVien: { state: { ...state, cookies: [] }, expiresAt: exp.toISOString() },
    });
    services.savedLogins.remove(a.id);
    expect(services.savedLogins.forRun(p)).toEqual({});
  });

  it('rejects bad names / states and needs OS encryption', () => {
    const { services, defaultProjectId: p } = createMemoryServices();
    expect(() => services.savedLogins.save(p, '1 x', state, new Date())).toThrow();
    expect(() => services.savedLogins.save(p, 'a', { cookies: 1 }, new Date())).toThrow();
    const off = createMemoryServices({
      isAvailable: () => false,
      encrypt: () => Buffer.alloc(0),
      decrypt: () => '',
    });
    expect(() =>
      off.services.savedLogins.save(off.defaultProjectId, 'a', state, new Date()),
    ).toThrow(expect.objectContaining({ code: 'SECRETS_UNAVAILABLE' }));
  });
});
