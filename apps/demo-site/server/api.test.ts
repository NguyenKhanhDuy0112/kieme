import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleRequest } from './api';
import { DemoStore } from './store';

const SYNC_MS = 300;
let server: Server;
let base = '';

beforeAll(async () => {
  const store = new DemoStore({ syncDelayMs: SYNC_MS });
  server = createServer((req, res) => {
    void handleRequest(store, req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end('not handled');
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function login(username: string): Promise<string> {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password: '123456' }),
  });
  expect(res.status).toBe(200);
  return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

const call = (path: string, cookie: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } });

describe('demo API', () => {
  it('rejects wrong credentials and anonymous access', async () => {
    const bad = await fetch(`${base}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ username: 'nhanvien', password: 'x' }),
    });
    expect(bad.status).toBe(401);
    expect((await call('/api/requests', '')).status).toBe(401);
  });

  it('employee creates a request; manager sees it only after the sync delay and approves it', async () => {
    const emp = await login('nhanvien');
    const mgr = await login('quanly');

    const invalid = await call('/api/requests', emp, {
      method: 'POST',
      body: JSON.stringify({ type: 'om' }),
    });
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as { errors: object }).errors).toHaveProperty('reason');

    const created = await call('/api/requests', emp, {
      method: 'POST',
      body: JSON.stringify({ type: 'om', fromDate: '2026-11-20', days: 2, reason: 'Đi khám bệnh' }),
    });
    expect(created.status).toBe(201);
    const { request } = (await created.json()) as { request: { id: string; code: string } };
    expect(request.code).toMatch(/^DN-\d{4}$/);

    const listFor = async (cookie: string) =>
      ((await (await call('/api/requests', cookie)).json()) as { items: { code: string }[] }).items;
    expect((await listFor(emp)).map((r) => r.code)).toContain(request.code);
    expect(await listFor(mgr)).toHaveLength(0);

    await new Promise((r) => setTimeout(r, SYNC_MS + 50));
    expect((await listFor(mgr)).map((r) => r.code)).toContain(request.code);

    expect(
      (await call(`/api/requests/${request.id}/approve`, emp, { method: 'POST' })).status,
    ).toBe(404);
    const approved = await call(`/api/requests/${request.id}/approve`, mgr, { method: 'POST' });
    expect(((await approved.json()) as { request: { status: string } }).request.status).toBe(
      'da-duyet',
    );
  });

  it('forbids managers from creating requests', async () => {
    const mgr = await login('quanly');
    const res = await call('/api/requests', mgr, { method: 'POST', body: '{}' });
    expect(res.status).toBe(403);
  });

  it('serves paginated products and the WebForms page', async () => {
    const res = await fetch(`${base}/api/products?page=2&pageSize=20`);
    expect(await res.json()).toMatchObject({ page: 2, pageSize: 20, totalPages: 3 });
    const wf = await fetch(`${base}/webforms.aspx`);
    expect(await wf.text()).toContain('__VIEWSTATE');
  });

  it('leaves non-API paths to Vite', async () => {
    expect(await (await fetch(`${base}/form.html`)).text()).toBe('not handled');
  });
});
