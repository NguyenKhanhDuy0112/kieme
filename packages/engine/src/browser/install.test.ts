import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EngineError } from '../errors';
import { chromiumExecutablePath, installChromium, parseProgressLine } from './install';

describe('Chromium download [N-03]', () => {
  it('parses Playwright progress lines', () => {
    expect(
      parseProgressLine('|■■■■■■■■                                |  20% of 152.3 MiB'),
    ).toEqual({
      percent: 20,
      totalMiB: 152.3,
    });
    expect(parseProgressLine('Downloading Chrome for Testing 156 from https://…')).toBeUndefined();
  });

  it('re-roots the Chromium path inside the app browsers folder', () => {
    const p = chromiumExecutablePath(join('/data', 'browsers'));
    expect(p.startsWith(join('/data', 'browsers', 'chromium-'))).toBe(true);
  });

  it('streams progress and passes the browsers folder to the installer', async () => {
    const progress: number[] = [];
    let seen: { args: string[]; path: string | undefined } | undefined;
    const exe = await installChromium({
      browsersPath: '/data/browsers',
      onProgress: (p) => progress.push(p.percent),
      run: async (args, env, onLine) => {
        seen = { args, path: env.PLAYWRIGHT_BROWSERS_PATH };
        for (const pct of [0, 10, 10, 50, 100])
          onLine(`|■■| ${String(pct).padStart(3)}% of 150 MiB`);
        onLine('Chromium downloaded to /data/browsers/chromium-1');
        return 0;
      },
    });
    expect(seen).toEqual({ args: ['install', '--no-shell', 'chromium'], path: '/data/browsers' });
    expect(progress).toEqual([0, 10, 50, 100]);
    expect(exe).toBe(chromiumExecutablePath('/data/browsers'));
  });

  it('reports BROWSER_DOWNLOAD_FAILED with the last output lines', async () => {
    const err = await installChromium({
      browsersPath: '/x',
      run: async (_a, _e, onLine) => {
        onLine('Error: getaddrinfo ENOTFOUND cdn.playwright.dev');
        return 1;
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe('BROWSER_DOWNLOAD_FAILED');
    expect((err as EngineError).details?.output).toContain('ENOTFOUND');
  });
});
