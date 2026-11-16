import { describe, expect, it } from 'vitest';
import { createMainWindowOptions } from './window-options';

describe('createMainWindowOptions', () => {
  it('enforces Electron security defaults', () => {
    const { webPreferences } = createMainWindowOptions('/tmp/preload.js');
    expect(webPreferences?.contextIsolation).toBe(true);
    expect(webPreferences?.sandbox).toBe(true);
    expect(webPreferences?.nodeIntegration).toBe(false);
    expect(webPreferences?.nodeIntegrationInWorker).toBe(false);
    expect(webPreferences?.webSecurity).toBe(true);
    expect(webPreferences?.preload).toBe('/tmp/preload.js');
  });
});
