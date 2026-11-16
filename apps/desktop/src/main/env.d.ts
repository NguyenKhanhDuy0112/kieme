/** Build-time values injected by electron-vite (`MAIN_VITE_*` environment variables). */
interface ImportMetaEnv {
  /** Sentry DSN for opt-in crash reports [N-09]; set only in release builds. */
  readonly MAIN_VITE_SENTRY_DSN?: string;
  /** `1` when the release build is code-signed (decides macOS auto-update) [N-12, N-14]. */
  readonly MAIN_VITE_CODE_SIGNED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
