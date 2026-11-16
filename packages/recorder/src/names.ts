import type { Locator } from '@kiemi/schema';

/** "Mật khẩu đăng nhập" → "matKhauDangNhap": an identifier testers can read [K-05, M-02]. */
export function toIdentifier(text: string, fallback = 'value'): string {
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const id = words
    .map((w, i) =>
      i === 0 ? w[0]?.toLowerCase() + w.slice(1) : (w[0]?.toUpperCase() ?? '') + w.slice(1),
    )
    .join('');
  if (!id) return fallback;
  return /^[0-9]/.test(id) ? `_${id}` : id.slice(0, 40);
}

/** Human label of a recorded element: accessible name, label, placeholder, then id / name. */
export function elementLabel(target: unknown): string {
  const loc = target as Partial<Locator> | undefined;
  for (const s of loc?.strategies ?? []) {
    if (s.kind === 'role' && s.name) return s.name;
    if (s.kind === 'label' || s.kind === 'placeholder') return s.value;
  }
  const attrs = loc?.fingerprint?.attributes ?? {};
  return attrs.name ?? attrs.id ?? '';
}

/** Name proposed for the Secret replacing a typed password [K-05]. */
export function suggestSecretName(target: unknown, taken: readonly string[] = []): string {
  const base = toIdentifier(elementLabel(target), 'matKhau');
  let name = base;
  for (let n = 2; taken.includes(name); n++) name = `${base}${n}`;
  return name;
}

/** The step's typed value replaced by a reference to the Secret [K-05]. */
export const secretRef = (name: string): string => `{{secret.${name}}}`;
