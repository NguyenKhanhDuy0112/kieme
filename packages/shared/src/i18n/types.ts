import type { vi } from './locales/vi';

/** Same shape as the Vietnamese source, with every leaf widened to `string`. */
export type TranslationShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};

export type Translation = TranslationShape<typeof vi>;

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'vi';

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
