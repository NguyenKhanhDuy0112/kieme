import type { BrowserWindowConstructorOptions } from 'electron';

/**
 * Security-hardened options for every Kiemi window (CLAUDE.md §5.7).
 * Kept free of runtime Electron imports so it can be unit-tested.
 */
export function createMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Kiemi',
    // Same colour as the launch splash: no white flash before it paints [U-18].
    backgroundColor: '#1F2A5C',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
    },
  };
}
