/** "Giảm chuyển động" [U-17, U-13]: `html[data-reduce-motion]` switches every animation off. */

const KEY = 'kiemi.reduceMotion';

export function applyReduceMotion(on: boolean, root: HTMLElement = document.documentElement): void {
  if (on) root.setAttribute('data-reduce-motion', '');
  else root.removeAttribute('data-reduce-motion');
  try {
    // Remembered so the next start applies it before settings load (the splash).
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable: the setting from the database still applies.
  }
}

/** Applies the remembered choice at start-up, before React and the database answer. */
export function applyStoredReduceMotion(root: HTMLElement = document.documentElement): void {
  try {
    if (localStorage.getItem(KEY) === '1') root.setAttribute('data-reduce-motion', '');
  } catch {
    // Ignore: falls back to the OS setting until settings load.
  }
}
