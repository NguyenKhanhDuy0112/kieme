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
    expect(updateMode(true, {})).toBe('auto');
    expect(updateMode(true, { PORTABLE_EXECUTABLE_DIR: 'C:\\Tools' })).toBe('notify');
    expect(updateMode(false, {})).toBe('off');
    expect(updateMode(true, { KIEMI_DISABLE_UPDATES: '1' })).toBe('off');
  });
});
