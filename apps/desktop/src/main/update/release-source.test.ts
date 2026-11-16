import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { RELEASE_SOURCE, updateMode } from './release-source';

describe('release source [N-12]', () => {
  it('matches the repository electron-builder publishes to', () => {
    const config = createRequire(import.meta.url)('../../../electron-builder.config.js') as {
      publish: { owner: string; repo: string }[];
    };
    expect(config.publish[0]).toMatchObject(RELEASE_SOURCE);
  });

  it('auto-updates installed apps, only notifies the portable exe, off in dev', () => {
    const win = { platform: 'win32', signed: false } as const;
    expect(updateMode(true, {}, win)).toBe('auto');
    expect(updateMode(true, { PORTABLE_EXECUTABLE_DIR: 'C:\\Tools' }, win)).toBe('notify');
    expect(updateMode(false, {}, win)).toBe('off');
    expect(updateMode(true, { KIEMI_DISABLE_UPDATES: '1' }, win)).toBe('off');
  });

  it('unsigned macOS app only notifies; signed one auto-updates [N-12, N-14]', () => {
    expect(updateMode(true, {}, { platform: 'darwin', signed: false })).toBe('notify');
    expect(updateMode(true, {}, { platform: 'darwin', signed: true })).toBe('auto');
  });
});
