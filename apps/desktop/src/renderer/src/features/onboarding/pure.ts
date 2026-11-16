/** Pure helpers of the onboarding (no IPC), unit-tested. */

/** Accepts what testers type: adds `https://` when missing; null if it is not a web address. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) return null;
    return u.href;
  } catch {
    return null;
  }
}

export const CARD_W = 320;
const GAP = 12;

/** Where the card goes next to the target, kept inside the window. */
export function placeCard(
  target: { top: number; left: number; bottom: number; right: number; width: number },
  view: { width: number; height: number },
  cardHeight: number,
): { top: number; left: number } {
  const below = target.bottom + GAP;
  const top =
    below + cardHeight <= view.height ? below : Math.max(GAP, target.top - GAP - cardHeight);
  const centered = target.left + target.width / 2 - CARD_W / 2;
  const left = Math.min(Math.max(GAP, centered), view.width - CARD_W - GAP);
  return { top, left };
}
