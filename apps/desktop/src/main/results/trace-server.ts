import { createReadStream, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.zip': 'application/zip',
};

/** Folder of Playwright's trace viewer web app (ships with playwright-core). */
export function traceViewerFolder(): string {
  const req = createRequire(__filename);
  return join(dirname(req.resolve('playwright-core/package.json')), 'lib', 'vite', 'traceViewer');
}

/**
 * Local HTTP server for Playwright's trace viewer [I-03, S-04]: serves the
 * viewer app and only the trace files that were explicitly allowed.
 * Bound to 127.0.0.1 (a secure context, so the viewer's service worker works).
 */
export class TraceServer {
  readonly #folder: string;
  readonly #allowed = new Set<string>();
  #server: Server | undefined;
  #port = 0;

  constructor(folder = traceViewerFolder()) {
    this.#folder = normalize(folder);
  }

  /** URL of the viewer opening `file`. */
  async urlFor(file: string): Promise<string> {
    this.#allowed.add(normalize(file));
    await this.#listen();
    // Same layout as Playwright's own server: the app under /trace/, and the
    // trace given as a relative `file?path=` URL resolved to /trace/file.
    const trace = `file?path=${encodeURIComponent(normalize(file))}`;
    return `http://127.0.0.1:${this.#port}/trace/index.html?trace=${encodeURIComponent(trace)}`;
  }

  async close(): Promise<void> {
    const s = this.#server;
    this.#server = undefined;
    if (s) await new Promise<void>((r) => s.close(() => r()));
  }

  async #listen(): Promise<void> {
    if (this.#server) return;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      let file: string | undefined;
      if (url.pathname.startsWith('/trace/file')) {
        const p = url.searchParams.get('path');
        file = p && this.#allowed.has(normalize(p)) ? normalize(p) : undefined;
      } else {
        const path = url.pathname.replace(/^\/trace(?=\/|$)/, '');
        const rel = path === '' || path === '/' ? 'index.html' : path.slice(1);
        const abs = normalize(join(this.#folder, ...rel.split('/')));
        file = abs.startsWith(this.#folder + sep) ? abs : undefined;
      }
      try {
        if (!file || !statSync(file).isFile()) throw new Error('not found');
      } catch {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(file).pipe(res);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    this.#server = server;
    this.#port = (server.address() as AddressInfo).port;
  }
}
