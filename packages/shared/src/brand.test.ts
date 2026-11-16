import { describe, expect, it } from 'vitest';
import { BRAND, isKiemiTestFile } from './brand';

describe('isKiemiTestFile', () => {
  it('accepts .kiemi.json files case-insensitively', () => {
    expect(isKiemiTestFile('login.kiemi.json')).toBe(true);
    expect(isKiemiTestFile('LOGIN.KIEMI.JSON')).toBe(true);
  });

  it('rejects other files', () => {
    expect(isKiemiTestFile('login.json')).toBe(false);
    expect(isKiemiTestFile('kiemi.json.bak')).toBe(false);
  });
});

describe('BRAND', () => {
  it('exposes the product app id', () => {
    expect(BRAND.appId).toBe('app.kiemi.desktop');
  });
});
