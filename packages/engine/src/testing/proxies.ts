import { createServer as createHttpServer, request as httpRequest, type Server } from 'node:http';
import { type AddressInfo, connect, createServer as createNetServer, type Socket } from 'node:net';

/**
 * Test-only proxies. `hosts` maps names that only exist "behind" the proxy to
 * real addresses, which proves DNS is resolved by the proxy [G-06].
 */
export interface TestProxy {
  readonly url: string;
  /** Host names the browser asked the proxy for. */
  readonly seen: string[];
  close(): Promise<void>;
}

type HostMap = Record<string, string>;

const target = (hosts: HostMap, host: string) => hosts[host] ?? host;

function listen(
  server: Server | ReturnType<typeof createNetServer>,
  scheme: string,
  seen: string[],
): Promise<TestProxy> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `${scheme}://127.0.0.1:${port}`,
        seen,
        close: () =>
          new Promise<void>((r) => {
            if ('closeAllConnections' in server) server.closeAllConnections();
            server.close(() => r());
          }),
      });
    });
  });
}

/** Minimal HTTP forward proxy (absolute-URI GET/POST and CONNECT), optional Basic auth. */
export function startHttpProxy(
  options: { hosts?: HostMap; auth?: { username: string; password: string } } = {},
): Promise<TestProxy> {
  const hosts = options.hosts ?? {};
  const seen: string[] = [];
  const expected = options.auth
    ? `Basic ${Buffer.from(`${options.auth.username}:${options.auth.password}`).toString('base64')}`
    : undefined;
  const sockets = new Set<Socket>();

  const server = createHttpServer((req, res) => {
    if (expected && req.headers['proxy-authorization'] !== expected) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="kiemi-test"' });
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/');
    seen.push(url.hostname);
    const { 'proxy-authorization': _auth, ...headers } = req.headers;
    const upstream = httpRequest(
      {
        host: target(hosts, url.hostname),
        port: url.port || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  server.on('connect', (req, client: Socket) => {
    const [host = '', port = '443'] = (req.url ?? '').split(':');
    seen.push(host);
    const up = connect(Number(port), target(hosts, host), () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      up.pipe(client);
      client.pipe(up);
    });
    up.on('error', () => client.destroy());
    client.on('error', () => up.destroy());
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return listen(server, 'http', seen);
}

/** Minimal SOCKS5 proxy (no auth, CONNECT only) that resolves names itself. */
export function startSocks5Proxy(options: { hosts?: HostMap } = {}): Promise<TestProxy> {
  const hosts = options.hosts ?? {};
  const seen: string[] = [];
  const server = createNetServer((client) => {
    client.on('error', () => client.destroy());
    client.once('data', (greeting: Buffer) => {
      if (greeting[0] !== 5) {
        client.destroy();
        return;
      }
      client.write(Buffer.from([5, 0])); // no authentication
      client.once('data', (req: Buffer) => {
        const atyp = req[3];
        let host: string;
        let offset: number;
        if (atyp === 3) {
          const len = req[4] ?? 0;
          host = req.subarray(5, 5 + len).toString('utf8');
          offset = 5 + len;
        } else if (atyp === 1) {
          host = [...req.subarray(4, 8)].join('.');
          offset = 8;
        } else {
          client.destroy();
          return;
        }
        const port = req.readUInt16BE(offset);
        seen.push(host);
        const up = connect(port, target(hosts, host), () => {
          client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
          up.pipe(client);
          client.pipe(up);
        });
        up.on('error', () => {
          client.end(Buffer.from([5, 4, 0, 1, 0, 0, 0, 0, 0, 0]));
        });
      });
    });
  });
  return listen(server, 'socks5', seen);
}
