import {
  DEFAULT_LANGUAGE,
  I18N_NAMESPACE,
  isSupportedLanguage,
  type Language,
  translations,
} from '@kiemi/shared';
import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = 'kiemi.language';

function readStoredLanguage(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Creates and initialises an i18next instance with all Kiemi strings bundled (offline, sync).
 * The language preference is kept in localStorage until Settings (S-07) persists it in the DB.
 */
export function createI18n(language: Language = readStoredLanguage()): I18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ['vi', 'en'],
    defaultNS: I18N_NAMESPACE,
    ns: [I18N_NAMESPACE],
    resources: {
      vi: { [I18N_NAMESPACE]: translations.vi },
      en: { [I18N_NAMESPACE]: translations.en },
    },
    interpolation: { escapeValue: false }, // React already escapes.
    returnNull: false,
    initAsync: false,
  });
  instance.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, lng);
    } catch {
      // Storage unavailable — keep the in-memory choice.
    }
  });
  document.documentElement.lang = language;
  return instance;
}
