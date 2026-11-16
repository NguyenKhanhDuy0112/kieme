/**
 * Launch splash [U-18]: painted by index.html before React; removed here once the app
 * is ready. Never delays a ready app beyond a short minimum (no flash), N-05.
 */

/** Shortest time the splash stays on screen, so it never flashes. */
export const SPLASH_MIN_MS = 500;
/** First launch: time for the owl to wave hello. */
export const SPLASH_FIRST_RUN_MS = 1400;
const FADE_MS = 320;

/** How much longer to keep the splash, given when the page started. */
export function splashRemainingMs(elapsedMs: number, firstRun: boolean): number {
  return Math.max(0, SPLASH_MIN_MS - elapsedMs) + (firstRun ? SPLASH_FIRST_RUN_MS : 0);
}

let hiding: Promise<void> | undefined;

/** Fades the splash out (once). `hello` is the bubble text shown on first launch. */
export function hideSplash(opts: { firstRun?: boolean; hello?: string } = {}): Promise<void> {
  hiding ??= (async () => {
    const el = document.getElementById('splash');
    if (!el) return;
    const firstRun = opts.firstRun === true;
    if (firstRun) {
      const bubble = el.querySelector('.splash-bubble');
      if (bubble && opts.hello) bubble.textContent = opts.hello;
      el.classList.add('splash-first');
    }
    await new Promise((r) => setTimeout(r, splashRemainingMs(performance.now(), firstRun)));
    el.classList.add('splash-hide');
    await new Promise((r) => setTimeout(r, FADE_MS));
    el.remove();
  })();
  return hiding;
}
