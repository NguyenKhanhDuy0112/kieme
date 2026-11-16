/** Build-time values injected by electron-vite (`MAIN_VITE_*` environment variables). */
interface ImportMetaEnv {
  /** Sentry DSN for opt-in crash reports [N-09]; set only in release builds. */
  readonly MAIN_VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
