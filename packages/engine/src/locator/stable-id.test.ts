import { describe, expect, it } from 'vitest';
import { isDynamicId, isVolatileToken, stableIdSelector, stableVariantOf } from './stable-id';

describe('dynamic ids [C-05]', () => {
  it('detects volatile tokens', () => {
    for (const t of ['ctl00', 'ctl42', '123456', '8f3a2c91', 'a1b2c3d4e5f6', 'x9k2m4p7q1z8']) {
      expect(isVolatileToken(t), t).toBe(true);
    }
    for (const t of ['txtHoTen', 'MainContent', 'email', 'v2', 'h1', 'step3']) {
      expect(isVolatileToken(t), t).toBe(false);
    }
  });

  it('keeps the stable parts of a WebForms id', () => {
    expect(stableIdSelector('ctl00_MainContent_ctl42_txtHoTen')).toBe(
      '[id*="_MainContent_"][id$="_txtHoTen"]',
    );
    expect(stableIdSelector('ctl00$MainContent$ctl42$txtHoTen', 'name')).toBe(
      '[name*="$MainContent$"][name$="$txtHoTen"]',
    );
  });

  it('keeps prefix / suffix of generated ids', () => {
    expect(stableIdSelector('input-8f3a2c91')).toBe('[id^="input-"]');
    expect(stableIdSelector('field_123456_email')).toBe('[id^="field_"][id$="_email"]');
  });

  it('leaves stable or fully random ids alone', () => {
    expect(isDynamicId('btnSave')).toBe(false);
    expect(isDynamicId('user-email')).toBe(false);
    expect(isDynamicId('8f3a2c91')).toBe(false);
    expect(isDynamicId('ctl00_ctl42')).toBe(false);
    expect(stableIdSelector('save-button')).toBeUndefined();
  });

  it('escapes quotes in values', () => {
    expect(stableIdSelector('ab"cd_123456')).toBe('[id^="ab\\"cd_"]');
  });

  it('derives a stable variant from simple css and xpath strategies', () => {
    expect(stableVariantOf('css', '#ctl00_MainContent_ctl42_txtHoTen')).toBe(
      '[id*="_MainContent_"][id$="_txtHoTen"]',
    );
    expect(stableVariantOf('css', 'input[name="ctl00$MainContent$ctl42$txtHoTen"]')).toBe(
      'input[name*="$MainContent$"][name$="$txtHoTen"]',
    );
    expect(stableVariantOf('css', "[id='input-8f3a2c91']")).toBe('[id^="input-"]');
    expect(stableVariantOf('xpath', "//select[@id='ctl00_MainContent_ctl42_ddlTinh']")).toBe(
      'select[id*="_MainContent_"][id$="_ddlTinh"]',
    );
    expect(stableVariantOf('css', '#btnSave')).toBeUndefined();
    expect(stableVariantOf('css', 'form #ctl00_x_ctl42_y')).toBeUndefined();
  });
});
