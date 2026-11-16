// biome-ignore-all lint/suspicious/noTemplateCurlyInString: electron-builder expands ${version}, ${ext}, ${arch} itself.
// Packaging for Windows (NSIS per-user + portable) and macOS (dmg) [N-10, N-11, N-13].
// Code signing is driven only by environment variables (ADR 0015):
//   Windows: CSC_LINK / CSC_KEY_PASSWORD (or WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD)
//   macOS:   CSC_LINK / CSC_KEY_PASSWORD + APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER
// Without them the build is unsigned (fine for local testing).

/** GitHub repository whose Releases host installers and update metadata [N-11, N-12]. */
const releaseOwner = process.env.KIEMI_RELEASE_OWNER || 'NguyenKhanhDuy0112';
const releaseRepo = process.env.KIEMI_RELEASE_REPO || 'kieme';

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.kiemi.desktop',
  productName: 'Kiemi',
  copyright: 'Copyright © Kiemi',
  directories: { output: 'release', buildResources: 'build' },
  files: [
    'out/**/*',
    'package.json',
    // better-sqlite3 ships prebuilds for every OS; keep only what we package.
    '!node_modules/better-sqlite3/{deps,src}/**',
    '!node_modules/better-sqlite3/prebuilds/linux*',
  ],
  // Runtime deps that Electron's asar cannot serve: Playwright forks Node scripts
  // (Chromium download) and reads its own files from disk.
  asarUnpack: ['node_modules/playwright-core/**'],
  // Built demo site = target of the sample tests, works offline [L-01, ADR 0014].
  extraResources: [{ from: '../demo-site/dist', to: 'sample-site', filter: ['**/*'] }],
  // better-sqlite3 uses N-API prebuilds that load in Electron as-is (ADR 0008).
  npmRebuild: false,
  publish: [{ provider: 'github', owner: releaseOwner, repo: releaseRepo, releaseType: 'draft' }],
  win: {
    icon: 'build/icon.png',
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
  },
  nsis: {
    // Per-user install: no administrator rights needed [N-13].
    oneClick: true,
    perMachine: false,
    allowElevation: false,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    shortcutName: 'Kiemi',
    // No version in the name: the README links to releases/latest/download/<name>.
    artifactName: 'Kiemi-Setup.${ext}',
  },
  // One .exe, no install, no admin — for machines only reachable over RDP [N-10].
  portable: {
    requestExecutionLevel: 'user',
    artifactName: 'Kiemi-Portable.${ext}',
  },
  mac: {
    icon: 'build/icon.png',
    category: 'public.app-category.developer-tools',
    // zip is what electron-updater installs on macOS; dmg is for first install.
    target: [
      { target: 'dmg', arch: ['universal'] },
      { target: 'zip', arch: ['universal'] },
    ],
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // Notarizes only when the APPLE_* variables are set.
    notarize: Boolean(process.env.APPLE_API_KEY || process.env.APPLE_ID),
  },
  dmg: { artifactName: 'Kiemi-mac.${ext}' },
};
