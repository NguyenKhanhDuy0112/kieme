import type { Translation } from '../types';

/** English. Must have exactly the same keys as `vi.ts` (enforced by the type). */
export const en = {
  app: {
    name: 'Kiemi',
    slogan: 'Click once, test forever.',
    version: 'Version {{version}}',
  },
  common: {
    run: 'Run',
    record: 'Record',
    save: 'Save',
    cancel: 'Cancel',
    undo: 'Undo',
    loading: 'Loading…',
  },
  settings: {
    language: 'Language',
    languages: {
      vi: 'Tiếng Việt',
      en: 'English',
    },
  },
} as const satisfies Translation;
