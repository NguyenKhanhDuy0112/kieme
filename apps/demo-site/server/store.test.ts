import { describe, expect, it } from 'vitest';
import { DemoStore, USERS, type User } from './store';

const user = (name: string): User => {
  const u = USERS.find((x) => x.username === name);
  if (!u) throw new Error(name);
  return u;
};
const valid = { type: 'om', fromDate: '2026-11-20', days: '2', reason: 'Bị sốt cao' };

function makeStore(syncDelayMs = 5000) {
  let t = 1_000_000;
  const store = new DemoStore({ syncDelayMs, now: () => t });
  return { store, advance: (ms: number) => (t += ms) };
}

describe('DemoStore', () => {
  it('logs in with correct password only', () => {
    const { store } = makeStore();
    expect(store.login('nhanvien', 'sai')).toBeNull();
    const ok = store.login('quanly', '123456');
    expect(ok?.user.role).toBe('quanly');
    expect(store.userByToken(ok?.token)?.username).toBe('quanly');
    store.logout(ok?.token ?? '');
    expect(store.userByToken(ok?.token)).toBeNull();
  });

  it('validates every field', () => {
    const { store } = makeStore();
    expect(store.validate({})).toEqual({
      type: expect.any(String),
      fromDate: expect.any(String),
      days: expect.any(String),
      reason: expect.any(String),
    });
    expect(store.validate({ ...valid, days: '31' }).days).toBe('Số ngày phải từ 1 đến 30');
    expect(store.validate({ ...valid, days: '1.5' }).days).toBe('Số ngày phải là số nguyên');
    expect(store.validate({ ...valid, reason: 'abc' }).reason).toBe('Lý do tối thiểu 5 ký tự');
    expect(store.validate(valid)).toEqual({});
  });

  it('creates sequential codes and hides new requests from managers until synced', () => {
    const { store, advance } = makeStore(5000);
    const a = store.createRequest(user('nhanvien'), valid);
    const b = store.createRequest(user('nhanvien'), valid);
    expect(a.ok && a.request.code).toBe('DN-0001');
    expect(b.ok && b.request.code).toBe('DN-0002');

    expect(store.listRequests(user('nhanvien'))).toHaveLength(2);
    expect(store.listRequests(user('nhanvien2'))).toHaveLength(0);
    expect(store.listRequests(user('quanly'))).toHaveLength(0);
    advance(4999);
    expect(store.listRequests(user('quanly'))).toHaveLength(0);
    advance(1);
    expect(store.listRequests(user('quanly')).map((r) => r.code)).toEqual(['DN-0002', 'DN-0001']);
  });

  it('only lets managers change status, and only for synced requests', () => {
    const { store, advance } = makeStore(1000);
    const r = store.createRequest(user('nhanvien'), valid);
    if (!r.ok) throw new Error('create failed');
    expect(store.setStatus(user('quanly'), r.request.id, 'da-duyet')).toBeNull();
    advance(1000);
    expect(store.setStatus(user('nhanvien'), r.request.id, 'da-duyet')).toBeNull();
    expect(store.setStatus(user('quanly'), r.request.id, 'da-duyet')?.status).toBe('da-duyet');
  });

  it('deletes by code for the owner but not other employees', () => {
    const { store } = makeStore();
    store.createRequest(user('nhanvien'), valid);
    expect(store.deleteRequest(user('nhanvien2'), 'DN-0001')).toBe(false);
    expect(store.deleteRequest(user('nhanvien'), 'DN-0001')).toBe(true);
  });

  it('paginates and searches products', () => {
    const { store } = makeStore();
    const p1 = store.listProducts({ page: 1, pageSize: 10 });
    expect(p1).toMatchObject({ page: 1, total: 47, totalPages: 5 });
    expect(p1.items).toHaveLength(10);
    const last = store.listProducts({ page: 99, pageSize: 10 });
    expect(last.page).toBe(5);
    expect(last.items).toHaveLength(7);
    const found = store.listProducts({ page: 1, pageSize: 10, q: 'sp04' });
    expect(found.items.map((p) => p.sku)).toEqual([
      'SP040',
      'SP041',
      'SP042',
      'SP043',
      'SP044',
      'SP045',
      'SP046',
      'SP047',
    ]);
  });

  it('reset clears requests and sessions', () => {
    const { store } = makeStore();
    const s = store.login('nhanvien', '123456');
    store.createRequest(user('nhanvien'), valid);
    store.reset();
    expect(store.userByToken(s?.token)).toBeNull();
    expect(store.listRequests(user('nhanvien'))).toHaveLength(0);
  });
});
