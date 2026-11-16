// @vitest-environment node
import { createMemoryServices } from '@kiemi/db';
import { describe, expect, it, vi } from 'vitest';
import { createTestRunManager } from '../run/testing';
import { createCaller } from './root';

describe('crash reports opt-in [N-09]', () => {
  it('is off by default, the switch reaches the reporter, window errors are forwarded', async () => {
    const { services, defaultProjectId } = createMemoryServices();
    const crashReports = { setEnabled: vi.fn(), reportRendererError: vi.fn() };
    const c = createCaller({
      appVersion: '1',
      platform: 'win32',
      services,
      defaultProjectId,
      runs: createTestRunManager(services),
      crashReports,
    });
    expect((await c.system.settings()).crashReports).toBe(false);
    await c.system.updateSettings({ theme: 'dark' });
    expect(crashReports.setEnabled).not.toHaveBeenCalled();
    expect((await c.system.updateSettings({ crashReports: true })).crashReports).toBe(true);
    expect(crashReports.setEnabled).toHaveBeenCalledWith(true);
    await c.app.reportError({ message: 'boom', stack: 'at x' });
    expect(crashReports.reportRendererError).toHaveBeenCalledWith({
      message: 'boom',
      stack: 'at x',
    });
  });
});
