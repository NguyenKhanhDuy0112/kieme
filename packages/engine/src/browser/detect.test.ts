import { describe, expect, it } from 'vitest';
import { type DetectEnv, detectInstalledBrowsers, preferredOrder } from './detect';

const fakeEnv = (
  platform: NodeJS.Platform,
  present: string[],
  env: DetectEnv['env'] = {},
): DetectEnv => ({
  platform,
  env,
  home: '/Users/tester',
  exists: (p) => present.includes(p),
});

describe('detectInstalledBrowsers [N-03, G-01]', () => {
  it('prefers Edge on Windows and finds per-user installs', () => {
    const env = {
      PROGRAMFILES: 'C:\\Program Files',
      'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\t\\AppData\\Local',
    };
    const found = detectInstalledBrowsers(
      fakeEnv(
        'win32',
        [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Users\\t\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        ],
        env,
      ),
    );
    expect(found).toEqual([
      {
        kind: 'msedge',
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      },
      {
        kind: 'chrome',
        executablePath: 'C:\\Users\\t\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      },
    ]);
  });

  it('prefers Chrome on macOS and checks ~/Applications', () => {
    const found = detectInstalledBrowsers(
      fakeEnv('darwin', [
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Users/tester/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ]),
    );
    expect(found.map((b) => b.kind)).toEqual(['chrome', 'msedge']);
    expect(found[0]?.executablePath).toContain('/Users/tester/Applications/');
  });

  it('returns nothing when no browser is installed', () => {
    expect(detectInstalledBrowsers(fakeEnv('darwin', []))).toEqual([]);
    expect(detectInstalledBrowsers(fakeEnv('linux', []))).toEqual([]);
  });

  it('orders by platform', () => {
    expect(preferredOrder('win32')).toEqual(['msedge', 'chrome']);
    expect(preferredOrder('darwin')).toEqual(['chrome', 'msedge']);
  });

  it('finds at least one browser on this machine (dev / CI)', () => {
    expect(detectInstalledBrowsers().length).toBeGreaterThan(0);
  });
});
