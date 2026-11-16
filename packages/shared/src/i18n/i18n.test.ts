import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  en,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  translations,
  vi,
} from '.';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const viFlat = flatten(vi);
  const enFlat = flatten(en);

  it('vi and en have exactly the same keys', () => {
    expect([...enFlat.keys()].sort()).toEqual([...viFlat.keys()].sort());
  });

  it('has no empty strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [key, value] of flatten(translations[lang])) {
        expect(value.trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('uses the same {{placeholders}} in every language', () => {
    for (const [key, viValue] of viFlat) {
      expect(placeholders(enFlat.get(key) ?? ''), key).toEqual(placeholders(viValue));
    }
  });
});

describe('languages', () => {
  it('defaults to Vietnamese', () => {
    expect(DEFAULT_LANGUAGE).toBe('vi');
  });

  it('recognises supported languages only', () => {
    expect(isSupportedLanguage('vi')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
  });
});

describe('M5 UI strings sit at the top of `ui` [K-01, C-06, M-02, M-03, F-02]', () => {
  it.each([
    ['vi', vi],
    ['en', en],
  ] as const)('%s', (_lang, t) => {
    expect(t.ui.record.start).toBeTruthy();
    expect(t.ui.toData.menu).toBeTruthy();
    expect(t.ui.variants.menu).toBeTruthy();
    expect(t.ui.logins.title).toBeTruthy();
    expect(t.recorder.addCheck).toBeTruthy();
  });
});
