// biome-ignore-all lint/suspicious/noTemplateCurlyInString: electron-builder file name macros.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Target {
  target: string;
  arch: string[];
}
interface BuilderConfig {
  appId: string;
  productName: string;
  extraResources: { from: string; to: string }[];
  win: { target: Target[] };
  nsis: { oneClick: boolean; perMachine: boolean; allowElevation: boolean; artifactName: string };
  portable: { requestExecutionLevel: string; artifactName: string };
  dmg: { artifactName: string };
  mac: { target: Target[]; notarize: boolean };
  publish: { provider: string; owner: string; repo: string }[];
  dependencies?: unknown;
}

const require = createRequire(import.meta.url);
const load = (): BuilderConfig => {
  const path = require.resolve('../../electron-builder.config.js');
  delete require.cache[path];
  return require(path) as BuilderConfig;
};
const pkg = require('../../package.json') as {
  productName: string;
  version: string;
  dependencies: Record<string, string>;
};

describe('electron-builder config [N-10, N-11, N-13]', () => {
  const config = load();

  it('uses the brand app id', () => {
    expect(config.appId).toBe('app.kiemi.desktop');
    expect(config.productName).toBe('Kiemi');
    // Electron names the data folder after package.json: %APPDATA%\Kiemi, ~/Library/Application Support/Kiemi.
    expect(pkg.productName).toBe('Kiemi');
  });

  it('builds a per-user NSIS installer and a portable exe for Windows', () => {
    expect(config.win.target.map((t) => t.target)).toEqual(['nsis', 'portable']);
    expect(config.nsis).toMatchObject({ perMachine: false, allowElevation: false });
    expect(config.portable.requestExecutionLevel).toBe('user');
  });

  it('builds a universal dmg + zip (for updates) for macOS', () => {
    expect(config.mac.target).toEqual([
      { target: 'dmg', arch: ['universal'] },
      { target: 'zip', arch: ['universal'] },
    ]);
  });

  it('ships the sample site where the main process looks for it (ADR 0014)', () => {
    expect(config.extraResources).toContainEqual(
      expect.objectContaining({ from: '../demo-site/dist', to: 'sample-site' }),
    );
  });

  it('publishes to GitHub Releases, repo overridable by env', () => {
    expect(config.publish[0]).toMatchObject({ provider: 'github', repo: 'kiemi' });
    process.env.KIEMI_RELEASE_REPO = 'kiemi-releases';
    try {
      expect(load().publish[0]?.repo).toBe('kiemi-releases');
    } finally {
      delete process.env.KIEMI_RELEASE_REPO;
    }
  });

  it('names files without a version, so README download links never change', () => {
    // https://github.com/<owner>/<repo>/releases/latest/download/<name>
    expect(config.nsis.artifactName).toBe('Kiemi-Setup.${ext}');
    expect(config.portable.artifactName).toBe('Kiemi-Portable.${ext}');
    expect(config.dmg.artifactName).toBe('Kiemi-mac.${ext}');
  });

  it('notarizes only when Apple credentials are present', () => {
    expect(config.mac.notarize).toBe(false);
  });

  it('packages only what the main bundle requires at runtime', () => {
    // Everything else (React, workspace packages…) is bundled by electron-vite.
    expect(Object.keys(pkg.dependencies).some((d) => d.startsWith('@kiemi/'))).toBe(false);
    expect(pkg.dependencies).not.toHaveProperty('react');
    expect(pkg.dependencies).toHaveProperty('better-sqlite3');
    expect(pkg.dependencies).toHaveProperty('playwright-core');
  });
});
