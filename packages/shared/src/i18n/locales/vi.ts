/**
 * Vietnamese — the source of truth for every UI string.
 * Add keys here first; `en.ts` is type-checked to have exactly the same keys.
 * Keep wording friendly for non-coders (CLAUDE.md §5.8, SPEC U-05).
 */
export const vi = {
  app: {
    name: 'Kiemi',
    slogan: 'Bấm một lần, kiểm mãi mãi.',
    version: 'Phiên bản {{version}}',
  },
  common: {
    run: 'Chạy',
    record: 'Ghi lại',
    save: 'Lưu',
    cancel: 'Hủy',
    undo: 'Hoàn tác',
    loading: 'Đang tải…',
  },
  settings: {
    language: 'Ngôn ngữ',
    languages: {
      vi: 'Tiếng Việt',
      en: 'English',
    },
  },
} as const;
