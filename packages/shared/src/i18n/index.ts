import { en } from './locales/en';
import { vi } from './locales/vi';
import type { Language, Translation } from './types';

export {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type Language,
  SUPPORTED_LANGUAGES,
  type Translation,
} from './types';
export { en, vi };

/** i18next namespace that holds all Kiemi strings. */
export const I18N_NAMESPACE = 'translation';

export const translations: Record<Language, Translation> = { vi, en };
