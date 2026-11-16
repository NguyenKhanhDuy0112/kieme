import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix } from 'node:path';

/** Browsers Kiemi can drive [G-01]. `chromium` = Playwright's downloaded build. */
export const BROWSER_KINDS = ['msedge', 'chrome', 'chromium'] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

export interface InstalledBrowser {
  kind: Exclude<BrowserKind, 'chromium'>;
  executablePath: string;
}

export interface DetectEnv {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  home: string;
  exists(path: string): boolean;
}

const defaultEnv = (): DetectEnv => ({
  platform: process.platform,
  env: process.env,
  home: homedir(),
  exists: existsSync,
});

/** Standard install locations of Edge and Chrome per OS. */
function candidates(e: DetectEnv): Record<InstalledBrowser['kind'], string[]> {
  if (e.platform === 'win32') {
    const roots = [e.env.PROGRAMFILES, e.env['PROGRAMFILES(X86)'], e.env.LOCALAPPDATA].filter(
      (r): r is string => !!r,
    );
    // Windows paths are joined with `\` regardless of the host running the code.
    const win = (...p: string[]) => p.join('\\');
    return {
      msedge: roots.map((r) => win(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
      chrome: roots.map((r) => win(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    };
  }
  if (e.platform === 'darwin') {
    const apps = ['/Applications', posix.join(e.home, 'Applications')];
    return {
      msedge: apps.map((a) => `${a}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`),
      chrome: apps.map((a) => `${a}/Google Chrome.app/Contents/MacOS/Google Chrome`),
    };
  }
  return {
    msedge: [
      '/opt/microsoft/msedge/msedge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/microsoft-edge',
    ],
    chrome: [
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
    ],
  };
}

/** Preferred order on this OS: Edge first on Windows (always present), Chrome first elsewhere. */
export function preferredOrder(platform: NodeJS.Platform): InstalledBrowser['kind'][] {
  return platform === 'win32' ? ['msedge', 'chrome'] : ['chrome', 'msedge'];
}

/** Lists Edge/Chrome installed on this machine, in preferred order [N-03, G-01]. */
export function detectInstalledBrowsers(env: DetectEnv = defaultEnv()): InstalledBrowser[] {
  const all = candidates(env);
  const found: InstalledBrowser[] = [];
  for (const kind of preferredOrder(env.platform)) {
    const path = all[kind].find((p) => env.exists(p));
    if (path) found.push({ kind, executablePath: path });
  }
  return found;
}
