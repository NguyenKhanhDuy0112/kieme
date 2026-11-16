import { describe, expect, it } from 'vitest';
import { normalizeUrl, placeCard } from './pure';

describe('normalizeUrl', () => {
  it('adds https:// and keeps full addresses', () => {
    expect(normalizeUrl('  ten-mien.vn ')).toBe('https://ten-mien.vn/');
    expect(normalizeUrl('http://localhost:3000/login')).toBe('http://localhost:3000/login');
    expect(normalizeUrl('https://uat.cong-ty.vn/a?b=1')).toBe('https://uat.cong-ty.vn/a?b=1');
  });
  it('rejects what is not a web address', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('xin chào')).toBeNull();
    expect(normalizeUrl('abc')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('placeCard', () => {
  const view = { width: 1200, height: 800 };
  const rect = (top: number, left: number, w = 100, h = 32) => ({
    top,
    left,
    bottom: top + h,
    right: left + w,
    width: w,
  });
  it('goes below the target, centered, inside the window', () => {
    expect(placeCard(rect(100, 500), view, 150)).toEqual({ top: 144, left: 390 });
    // right edge
    expect(placeCard(rect(10, 1150, 40), view, 150).left).toBe(1200 - 320 - 12);
    // left edge
    expect(placeCard(rect(10, 0, 40), view, 150).left).toBe(12);
  });
  it('goes above when there is no room below', () => {
    expect(placeCard(rect(700, 500), view, 150)).toEqual({ top: 700 - 12 - 150, left: 390 });
  });
});
