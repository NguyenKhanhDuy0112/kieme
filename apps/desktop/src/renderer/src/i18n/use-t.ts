import { isSupportedLanguage, type Language } from '@kiemi/shared';
import { useTranslation } from 'react-i18next';

/**
 * Kiemi's translation hook. Keys are type-checked against `vi.ts`.
 * @example const { t } = useT(); t('common.run')
 */
export function useT() {
  const { t, i18n } = useTranslation();
  const language: Language = isSupportedLanguage(i18n.language) ? i18n.language : 'vi';
  const setLanguage = (lng: Language) => i18n.changeLanguage(lng);
  return { t, language, setLanguage };
}
