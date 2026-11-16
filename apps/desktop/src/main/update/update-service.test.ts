import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  releaseNotesText,
  type UpdateInfoLike,
  type UpdaterLike,
  UpdateService,
  type UpdateState,
} from './update-service';

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  checkForUpdates = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

const info = (version: string, releaseNotes?: UpdateInfoLike['releaseNotes']) => ({
  version,
  releaseNotes,
});
const PAGE = 'https://github.com/o/r/releases/latest';

describe('UpdateService [N-12]', () => {
  it('installed app: downloads in the background, then offers a restart', async () => {
    const u = new FakeUpdater();
    const svc = new UpdateService({ updater: u, mode: 'auto', releasePageUrl: PAGE });
    expect(u.autoDownload).toBe(true);
    expect(svc.state()).toEqual({ status: 'idle' });
    await svc.check();
    expect(u.checkForUpdates).toHaveBeenCalledOnce();
    u.emit('checking-for-update');
    u.emit('update-available', info('1.2.0'));
    u.emit('download-progress', { percent: 42.4 });
    expect(svc.state()).toEqual({ status: 'downloading', version: '1.2.0', percent: 42 });
    u.emit('update-downloaded', info('1.2.0', '<ul><li>Thêm A</li><li>Sửa B</li></ul>'));
    expect(svc.state()).toEqual({ status: 'ready', version: '1.2.0', notes: '• Thêm A\n• Sửa B' });
    expect(svc.install()).toBe(true);
    expect(u.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('portable: never downloads, only tells that a new version exists', () => {
    const u = new FakeUpdater();
    const svc = new UpdateService({ updater: u, mode: 'notify', releasePageUrl: PAGE });
    expect(u.autoDownload).toBe(false);
    expect(u.autoInstallOnAppQuit).toBe(false);
    u.emit('update-available', info('1.2.0', 'Ghi chú'));
    expect(svc.state()).toEqual({
      status: 'available',
      version: '1.2.0',
      notes: 'Ghi chú',
      url: PAGE,
    });
    expect(svc.install()).toBe(false);
    expect(u.quitAndInstall).not.toHaveBeenCalled();
  });

  it('development: off, never checks', async () => {
    const u = new FakeUpdater();
    const svc = new UpdateService({ updater: u, mode: 'off', releasePageUrl: PAGE });
    expect((await svc.check()).status).toBe('off');
    expect(u.checkForUpdates).not.toHaveBeenCalled();
  });

  it('offline: check fails quietly; a downloaded update survives later errors', async () => {
    const u = new FakeUpdater();
    u.checkForUpdates.mockRejectedValueOnce(new Error('net::ERR_INTERNET_DISCONNECTED'));
    const svc = new UpdateService({ updater: u, mode: 'auto', releasePageUrl: PAGE });
    expect(await svc.check()).toEqual({
      status: 'error',
      message: 'net::ERR_INTERNET_DISCONNECTED',
    });
    u.emit('update-downloaded', info('2.0.0'));
    u.emit('error', new Error('later'));
    expect(svc.state().status).toBe('ready');
    // No second download while one is ready.
    await svc.check();
    expect(u.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('checks shortly after start and then periodically', () => {
    vi.useFakeTimers();
    try {
      const u = new FakeUpdater();
      const svc = new UpdateService({
        updater: u,
        mode: 'auto',
        releasePageUrl: PAGE,
        firstCheckDelayMs: 1000,
        intervalMs: 5000,
      });
      svc.start();
      expect(u.checkForUpdates).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(u.checkForUpdates).toHaveBeenCalledTimes(1);
      u.emit('update-not-available');
      vi.advanceTimersByTime(5000);
      expect(u.checkForUpdates).toHaveBeenCalledTimes(2);
      svc.stop();
      vi.advanceTimersByTime(50_000);
      expect(u.checkForUpdates).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('streams the current state then every change', async () => {
    const u = new FakeUpdater();
    const svc = new UpdateService({ updater: u, mode: 'auto', releasePageUrl: PAGE });
    const ac = new AbortController();
    const seen: UpdateState['status'][] = [];
    const done = (async () => {
      for await (const s of svc.events(ac.signal)) {
        seen.push(s.status);
        if (s.status === 'ready') ac.abort();
      }
    })();
    await Promise.resolve();
    u.emit('update-available', info('1.0.1'));
    u.emit('update-downloaded', info('1.0.1'));
    await done;
    expect(seen).toEqual(['idle', 'downloading', 'ready']);
  });
});

describe('releaseNotesText', () => {
  it('turns GitHub HTML into readable text', () => {
    expect(
      releaseNotesText('<h3>Minor Changes</h3><ul><li>Thêm &quot;Có gì mới&quot;</li></ul>'),
    ).toBe('Minor Changes\n• Thêm "Có gì mới"');
    expect(releaseNotesText([{ version: '1', note: '<p>A</p>' }])).toBe('A');
    expect(releaseNotesText(null)).toBe('');
  });
});
