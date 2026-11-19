// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyReduceMotion, applyStoredReduceMotion } from './motion';

afterEach(() => {
  document.documentElement.removeAttribute('data-reduce-motion');
  localStorage.clear();
});

describe('reduce motion [U-17, U-13]', () => {
  it('sets and clears the flag, and remembers it for the next start', () => {
    const root = document.documentElement;
    applyReduceMotion(true);
    expect(root.hasAttribute('data-reduce-motion')).toBe(true);
    root.removeAttribute('data-reduce-motion');
    applyStoredReduceMotion();
    expect(root.hasAttribute('data-reduce-motion')).toBe(true);
    applyReduceMotion(false);
    expect(root.hasAttribute('data-reduce-motion')).toBe(false);
  });

  it('every stylesheet stops its animations for both the OS setting and the switch', () => {
    for (const file of [
      join(__dirname, '../motion.css'),
      join(__dirname, '../../public/splash.css'),
    ]) {
      const css = readFileSync(file, 'utf8');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('html[data-reduce-motion]');
    }
    // Only transform / opacity / box-shadow are animated in the app stylesheet (N-05).
    const motion = readFileSync(join(__dirname, '../motion.css'), 'utf8');
    for (const prop of ['width', 'height', 'top', 'left', 'margin'])
      expect(motion).not.toMatch(new RegExp(`@keyframes[^}]*\\b${prop}\\s*:`));
  });
});
