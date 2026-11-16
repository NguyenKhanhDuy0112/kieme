import { describe, expect, it } from 'vitest';
import { createMemoryServices } from './testing';

describe('settings [S-07]', () => {
  it('saving one setting keeps the others', () => {
    const { services } = createMemoryServices();
    services.settings.update({ language: 'en', theme: 'dark', onboardingDone: true });
    const after = services.settings.update({ tourDone: true });
    expect(after).toMatchObject({
      language: 'en',
      theme: 'dark',
      onboardingDone: true,
      tourDone: true,
      advancedMode: false,
    });
  });

  it('rejects invalid values', () => {
    const { services } = createMemoryServices();
    expect(() => services.settings.update({ defaultTimeoutSec: 0 })).toThrow();
  });
});

describe('settings patch schema', () => {
  it('adds no defaults for keys that were not sent', async () => {
    const { AppSettingsPatchSchema } = await import('./services/settings');
    expect(AppSettingsPatchSchema.parse({ tourDone: true })).toEqual({ tourDone: true });
  });
});
