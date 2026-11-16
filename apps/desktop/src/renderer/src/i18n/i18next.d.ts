import type { vi } from '@kiemi/shared';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof vi };
  }
}
