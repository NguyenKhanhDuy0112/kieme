import type { Browser, LaunchOptions } from 'playwright-core';
import { chromium } from 'playwright-core';
import { EngineError } from '../errors';
import { type BrowserKind, detectInstalledBrowsers, type InstalledBrowser } from './detect';
import {
  chromiumExecutablePath,
  type DownloadProgress,
  installChromium,
  isChromiumInstalled,
} from './install';
import { type LaunchSettingsInput, LaunchSettingsSchema } from './options';

export interface LaunchBrowserOptions {
  settings?: LaunchSettingsInput;
  /** Where downloaded Chromium lives (app data dir). Required to fall back to Chromium. */
  browsersPath?: string;
  /** Download progress for the "Đang tải trình duyệt…" bar [N-03]. */
  onDownloadProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface LaunchedBrowser {
  browser: Browser;
  kind: BrowserKind;
  executablePath: string;
  /** Chromium had to be downloaded for this launch. */
  downloaded: boolean;
}

/** Test seams. */
export interface LaunchDeps {
  detect: () => InstalledBrowser[];
  launch: (options: LaunchOptions) => Promise<Browser>;
  isChromiumInstalled: (browsersPath: string) => boolean;
  installChromium: typeof installChromium;
}

const defaultDeps: LaunchDeps = {
  detect: () => detectInstalledBrowsers(),
  launch: (o) => chromium.launch(o),
  isChromiumInstalled,
  installChromium,
};

/**
 * Launches the browser for a run [N-03, G-01, G-05]: the chosen Edge/Chrome, or
 * with `auto` the first one installed, else Playwright's Chromium (downloaded on
 * first use, with progress).
 */
export async function launchBrowser(
  options: LaunchBrowserOptions = {},
  deps: LaunchDeps = defaultDeps,
): Promise<LaunchedBrowser> {
  const settings = LaunchSettingsSchema.parse(options.settings ?? {});
  const base: LaunchOptions = {
    headless: settings.headless,
    ...(settings.slowMoMs === undefined ? {} : { slowMo: settings.slowMoMs }),
  };

  let target: { kind: BrowserKind; executablePath: string } | undefined;
  if (settings.browser !== 'chromium') {
    const installed = deps.detect();
    target =
      settings.browser === 'auto'
        ? installed[0]
        : installed.find((b) => b.kind === settings.browser);
    if (!target && settings.browser !== 'auto') {
      throw new EngineError('BROWSER_NOT_FOUND', `${settings.browser} is not installed`, {
        browser: settings.browser,
      });
    }
  }

  let downloaded = false;
  if (!target) {
    if (options.browsersPath === undefined) {
      throw new EngineError(
        'BROWSER_NOT_FOUND',
        'No Edge/Chrome installed and no download folder set',
        {
          browser: settings.browser,
        },
      );
    }
    if (!deps.isChromiumInstalled(options.browsersPath)) {
      await deps.installChromium({
        browsersPath: options.browsersPath,
        ...(options.onDownloadProgress ? { onProgress: options.onDownloadProgress } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      downloaded = true;
    }
    target = { kind: 'chromium', executablePath: chromiumExecutablePath(options.browsersPath) };
  }

  try {
    // Full Chromium/Chrome in new headless mode — no separate headless shell needed.
    const browser = await deps.launch({ ...base, executablePath: target.executablePath });
    return { browser, kind: target.kind, executablePath: target.executablePath, downloaded };
  } catch (err) {
    throw new EngineError('BROWSER_LAUNCH_FAILED', `Could not start ${target.kind}`, {
      browser: target.kind,
      reason: err instanceof Error ? err.message.split('\n')[0] : String(err),
    });
  }
}
