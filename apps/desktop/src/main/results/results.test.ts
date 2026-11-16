// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { artifactUrl, parseArtifactUrl, resolveInside } from './artifact-path';
import { TraceServer } from './trace-server';

describe('artifact URLs [S-04]', () => {
  it('round-trips run id and path', () => {
    const url = artifactUrl('r 1', 'case-1/step 2-failed.png');
    expect(url).toBe('kiemi-artifact://run/r%201/case-1/step%202-failed.png');
    expect(parseArtifactUrl(url)).toEqual({ runId: 'r 1', path: 'case-1/step 2-failed.png' });
    expect(parseArtifactUrl('https://x/run/a/b')).toBeUndefined();
    expect(parseArtifactUrl('kiemi-artifact://run/only')).toBeUndefined();
  });

  it('never resolves outside the run folder', () => {
    expect(resolveInside('/runs/r1', 'shot.png')).toBe('/runs/r1/shot.png');
    expect(resolveInside('/runs/r1', '../r2/shot.png')).toBeUndefined();
    expect(resolveInside('/runs/r1', '/etc/passwd')).toBeUndefined();
    expect(resolveInside('', 'shot.png')).toBeUndefined();
  });
});

describe('trace viewer server [I-03]', () => {
  let server: TraceServer | undefined;
  afterEach(async () => server?.close());

  it('serves the viewer app and only allowed trace files', async () => {
    server = new TraceServer();
    const dir = mkdtempSync(join(tmpdir(), 'kiemi-trace-'));
    const trace = join(dir, 'trace.zip');
    writeFileSync(trace, 'zip');
    writeFileSync(join(dir, 'secret.txt'), 'no');
    const url = new URL(await server.urlFor(trace));
    expect(url.pathname).toBe('/trace/index.html');
    expect(url.searchParams.get('trace')).toBe(`file?path=${encodeURIComponent(trace)}`);
    const base = `${url.protocol}//${url.host}/trace`;
    // The viewer resolves `file?path=` against /trace/index.html.
    expect(new URL(url.searchParams.get('trace') as string, url).pathname).toBe('/trace/file');
    const index = await fetch(`${base}/index.html`);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('<html');
    expect((await fetch(`${base}/sw.bundle.js`)).status).toBe(200);
    const file = await fetch(`${base}/file?path=${encodeURIComponent(trace)}`);
    expect(await file.text()).toBe('zip');
    const denied = await fetch(`${base}/file?path=${encodeURIComponent(join(dir, 'secret.txt'))}`);
    expect(denied.status).toBe(404);
    expect((await fetch(`${base}/..%2F..%2Fpackage.json`)).status).toBe(404);
  });
});
