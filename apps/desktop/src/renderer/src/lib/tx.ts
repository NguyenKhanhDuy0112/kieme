import { useTranslation } from 'react-i18next';

/**
 * Translation for keys built at run time (action types, enum values, error
 * codes). Falls back to `fallback` (or the key's last part) when missing.
 */
export function useTx() {
  const { t, i18n } = useTranslation();
  return (key: string, vars?: Record<string, unknown>, fallback?: string): string => {
    if (i18n.exists(key)) return String(t(key as never, vars as never));
    return fallback ?? key.split('.').pop() ?? key;
  };
}
