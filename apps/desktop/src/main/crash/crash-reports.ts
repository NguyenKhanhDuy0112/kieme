import * as Sentry from '@sentry/electron/main';
import { createScrubber } from './scrub';

export interface CrashReportsOptions {
  /** Sentry DSN baked in at build time (`MAIN_VITE_SENTRY_DSN`); none = never report. */
  dsn: string | undefined;
  release: string;
  homeDir: string;
}

/**
 * Opt-in crash reports [N-09]. Off by default; the SDK is only started when the user
 * agreed before this launch. Turning it off stops sending at once; turning it on
 * takes effect at the next launch (the SDK must start before the app is ready).
 */
export class CrashReports {
  private enabled = false;
  private started = false;

  constructor(private readonly options: CrashReportsOptions) {}

  /** Must run before `app.whenReady()`. */
  start(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled || !this.options.dsn || this.started) return;
    const scrub = createScrubber(this.options.homeDir);
    Sentry.init({
      dsn: this.options.dsn,
      release: `kiemi@${this.options.release}`,
      dataCollection: { userInfo: false, httpBodies: [] },
      // Do not inject Sentry's preload into our sandboxed windows.
      getSessions: () => [],
      beforeSend: (event) => (this.enabled ? scrub(event) : null),
      beforeSendTransaction: () => null,
      // Breadcrumbs could hold page addresses or typed values.
      beforeBreadcrumb: () => null,
      tracesSampleRate: 0,
    });
    this.started = true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Errors caught in the window, forwarded through IPC. */
  reportRendererError(error: { message: string; stack?: string | undefined }): void {
    if (!this.started || !this.enabled) return;
    const err = new Error(error.message);
    err.name = 'RendererError';
    if (error.stack) err.stack = error.stack;
    Sentry.captureException(err);
  }
}
