// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { hideSplash, SPLASH_FIRST_RUN_MS, SPLASH_MIN_MS, splashRemainingMs } from './splash';

describe('launch splash [U-18]', () => {
  it('never delays a slow start, avoids a flash on a fast one', () => {
    expect(splashRemainingMs(0, false)).toBe(SPLASH_MIN_MS);
    expect(splashRemainingMs(200, false)).toBe(SPLASH_MIN_MS - 200);
    expect(splashRemainingMs(2500, false)).toBe(0);
    // First launch: time for the hello wave.
    expect(splashRemainingMs(2500, true)).toBe(SPLASH_FIRST_RUN_MS);
  });

  it('shows the hello bubble on first launch, fades out and removes itself once', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML =
        '<div id="splash"><div class="splash-bubble"></div></div><div id="root"></div>';
      const done = hideSplash({ firstRun: true, hello: 'Xin chào!' });
      const again = hideSplash();
      const el = document.getElementById('splash');
      expect(el?.classList.contains('splash-first')).toBe(true);
      expect(el?.querySelector('.splash-bubble')?.textContent).toBe('Xin chào!');
      await vi.runAllTimersAsync();
      await Promise.all([done, again]);
      expect(document.getElementById('splash')).toBeNull();
      expect(document.getElementById('root')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
