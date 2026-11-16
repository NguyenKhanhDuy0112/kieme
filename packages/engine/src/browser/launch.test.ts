import type { Browser, LaunchOptions } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { EngineError } from '../errors';
import type { InstalledBrowser } from './detect';
import { chromiumExecutablePath } from './install';
import { type LaunchDeps, launchBrowser } from './launch';

const fakeBrowser = {} as Browser;

function deps(installed: InstalledBrowser[], chromiumThere = false) {
  const calls = { launch: [] as LaunchOptions[], installs: 0 };
  const d: LaunchDeps = {
    detect: () => installed,
    launch: async (o) => {
      calls.launch.push(o);
      return fakeBrowser;
    },
    isChromiumInstalled: () => chromiumThere,
    installChromium: async (o) => {
      calls.installs++;
      o.onProgress?.({ percent: 100 });
      return chromiumExecutablePath(o.browsersPath);
    },
  };
  return { d, calls };
}

const edge = { kind: 'msedge', executablePath: 'C:\\edge.exe' } as const;
const chrome = { kind: 'chrome', executablePath: '/chrome' } as const;

describe('launchBrowser [N-03, G-01, G-05]', () => {
  it('auto picks the first installed browser, headless by default', async () => {
    const { d, calls } = deps([edge, chrome]);
    const r = await launchBrowser({}, d);
    expect(r).toMatchObject({ kind: 'msedge', executablePath: 'C:\\edge.exe', downloaded: false });
    expect(calls.launch[0]).toEqual({ headless: true, executablePath: 'C:\\edge.exe' });
  });

  it('honours an explicit browser, headed mode and slowMo', async () => {
    const { d, calls } = deps([edge, chrome]);
    const r = await launchBrowser(
      { settings: { browser: 'chrome', headless: false, slowMoMs: 200 } },
      d,
    );
    expect(r.kind).toBe('chrome');
    expect(calls.launch[0]).toEqual({ headless: false, slowMo: 200, executablePath: '/chrome' });
  });

  it('fails when the chosen browser is missing', async () => {
    const { d } = deps([chrome]);
    const err = await launchBrowser({ settings: { browser: 'msedge' } }, d).catch(
      (e: unknown) => e,
    );
    expect((err as EngineError).code).toBe('BROWSER_NOT_FOUND');
  });

  it('downloads Chromium with progress when nothing is installed', async () => {
    const { d, calls } = deps([]);
    const progress: number[] = [];
    const r = await launchBrowser(
      { browsersPath: '/data/browsers', onDownloadProgress: (p) => progress.push(p.percent) },
      d,
    );
    expect(r).toMatchObject({ kind: 'chromium', downloaded: true });
    expect(r.executablePath).toBe(chromiumExecutablePath('/data/browsers'));
    expect(calls.installs).toBe(1);
    expect(progress).toEqual([100]);
  });

  it('reuses an already downloaded Chromium', async () => {
    const { d, calls } = deps([edge], true);
    const r = await launchBrowser({ settings: { browser: 'chromium' }, browsersPath: '/b' }, d);
    expect(r).toMatchObject({ kind: 'chromium', downloaded: false });
    expect(calls.installs).toBe(0);
  });

  it('needs a download folder for the fallback', async () => {
    const { d } = deps([]);
    const err = await launchBrowser({}, d).catch((e: unknown) => e);
    expect((err as EngineError).code).toBe('BROWSER_NOT_FOUND');
  });

  it('wraps launch failures', async () => {
    const { d } = deps([chrome]);
    d.launch = async () => {
      throw new Error('spawn EACCES\nmore');
    };
    const err = await launchBrowser({}, d).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err).toMatchObject({
      code: 'BROWSER_LAUNCH_FAILED',
      details: { browser: 'chrome', reason: 'spawn EACCES' },
    });
  });

  it('launches a real installed browser headless', async () => {
    const r = await launchBrowser({ settings: { headless: true } });
    try {
      expect(['chrome', 'msedge']).toContain(r.kind);
      const page = await r.browser.newPage();
      await page.setContent('<p>ok</p>');
      expect(await page.textContent('p')).toBe('ok');
    } finally {
      await r.browser.close();
    }
  });
});
