import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type SampleSite, startSampleSite, staticFile } from './sample-site';

describe('staticFile', () => {
  it('stays inside the folder', () => {
    const dir = join(tmpdir(), 'site');
    expect(staticFile(dir, '/')).toBe(join(dir, 'index.html'));
    expect(staticFile(dir, '/login.html?next=/x')).toBe(join(dir, 'login.html'));
    expect(staticFile(dir, '/frames/')).toBe(join(dir, 'frames', 'index.html'));
    expect(staticFile(dir, '/../secret.txt')).toBe(join(dir, 'secret.txt'));
    expect(staticFile(dir, '/%2e%2e/%2e%2e/etc/passwd')?.startsWith(dir)).toBe(true);
    expect(staticFile(dir, '/a%00b')).toBeUndefined();
  });
});

describe('startSampleSite', () => {
  let dir: string;
  let site: SampleSite;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kiemi-sample-'));
    await writeFile(join(dir, 'index.html'), '<h1>Trang mẫu</h1>');
    site = await startSampleSite({ dir, syncDelayMs: 0 });
  });
  afterAll(async () => {
    await site.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('serves the built pages and the API', async () => {
    const page = await fetch(`${site.url}/`);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('Trang mẫu');
    expect((await fetch(`${site.url}/missing.html`)).status).toBe(404);
    const login = await fetch(`${site.url}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ username: 'nhanvien', password: '123456' }),
    });
    expect(login.status).toBe(200);
  });

  it('falls back to a free port when the preferred one is taken', async () => {
    const blocker = createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    const port = (blocker.address() as AddressInfo).port;
    const other = await startSampleSite({ dir, port });
    try {
      expect(other.url).not.toBe(`http://127.0.0.1:${port}`);
      expect((await fetch(`${other.url}/`)).status).toBe(200);
    } finally {
      await other.close();
      await new Promise<void>((r) => blocker.close(() => r()));
    }
  });
});
