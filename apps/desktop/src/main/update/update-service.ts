/**
 * Automatic updates from GitHub Releases [N-09, N-12].
 * Installed app: check on start, download in the background, then offer
 * "Khởi động lại để cập nhật". Portable exe: only tell the user a new version exists.
 * Free of Electron imports: the real `electron-updater` is injected.
 */

/** What the renderer shows. `error` is kept quiet (offline is normal). */
export type UpdateState =
  | { status: 'off' }
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string; notes: string }
  | { status: 'available'; version: string; notes: string; url: string }
  | { status: 'error'; message: string };

/** Subset of electron-updater's `AppUpdater` we use. */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: 'checking-for-update' | 'update-not-available', cb: () => void): unknown;
  on(event: 'update-available' | 'update-downloaded', cb: (info: UpdateInfoLike) => void): unknown;
  on(event: 'download-progress', cb: (p: { percent: number }) => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateInfoLike {
  version: string;
  releaseNotes?: string | { version: string; note: string | null }[] | null;
}

export type UpdateMode = 'auto' | 'notify' | 'off';

export interface UpdateServiceOptions {
  updater?: UpdaterLike;
  /** `auto` = installed app, `notify` = portable, `off` = development. */
  mode: UpdateMode;
  /** Opened by "Tải bản mới" in notify mode. */
  releasePageUrl: string;
  /** Time between checks while the app stays open. */
  intervalMs?: number;
  /** Delay of the first check so it never slows the start [N-05]. */
  firstCheckDelayMs?: number;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

/** GitHub sends release notes as HTML; the dialog shows plain text. */
export function releaseNotesText(notes: UpdateInfoLike['releaseNotes']): string {
  if (!notes) return '';
  const html = Array.isArray(notes) ? notes.map((n) => n.note ?? '').join('\n') : notes;
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/\s*(p|li|h\d|ul|ol|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .trim();
}

export class UpdateService {
  private current: UpdateState;
  private readonly listeners = new Set<(s: UpdateState) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly options: UpdateServiceOptions) {
    const { updater, mode } = options;
    this.current = { status: mode === 'off' || !updater ? 'off' : 'idle' };
    if (!updater || mode === 'off') return;
    updater.autoDownload = mode === 'auto';
    updater.autoInstallOnAppQuit = mode === 'auto';
    updater.on('checking-for-update', () => this.set({ status: 'checking' }));
    updater.on('update-not-available', () => this.set({ status: 'upToDate' }));
    updater.on('update-available', (info) => {
      if (mode === 'notify') {
        this.set({
          status: 'available',
          version: info.version,
          notes: releaseNotesText(info.releaseNotes),
          url: options.releasePageUrl,
        });
      } else {
        this.set({ status: 'downloading', version: info.version, percent: 0 });
      }
    });
    updater.on('download-progress', (p) => {
      const s = this.current;
      if (s.status === 'downloading') this.set({ ...s, percent: Math.round(p.percent) });
    });
    updater.on('update-downloaded', (info) =>
      this.set({
        status: 'ready',
        version: info.version,
        notes: releaseNotesText(info.releaseNotes),
      }),
    );
    updater.on('error', (err) => {
      // A downloaded update stays installable even if a later check fails.
      if (this.current.status !== 'ready') this.set({ status: 'error', message: err.message });
    });
  }

  state(): UpdateState {
    return this.current;
  }

  /** First check shortly after start, then every `intervalMs`. */
  start(): void {
    if (this.current.status === 'off') return;
    const { firstCheckDelayMs = 10_000, intervalMs = 4 * 60 * 60 * 1000 } = this.options;
    const loop = () => {
      void this.check();
      this.timers.push(setTimeout(loop, intervalMs));
    };
    this.timers.push(setTimeout(loop, firstCheckDelayMs));
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Checks now (also "Kiểm tra cập nhật" in Settings). */
  async check(): Promise<UpdateState> {
    const { updater } = this.options;
    const busy = ['checking', 'downloading', 'ready'].includes(this.current.status);
    if (!updater || this.current.status === 'off' || busy) return this.current;
    try {
      await updater.checkForUpdates();
    } catch (err) {
      if (this.current.status !== 'ready')
        this.set({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    return this.current;
  }

  /** "Khởi động lại để cập nhật": data in userData is untouched. */
  install(): boolean {
    if (this.current.status !== 'ready' || !this.options.updater) return false;
    this.options.updater.quitAndInstall(false, true);
    return true;
  }

  /** Current state, then every change, until `signal` aborts. */
  async *events(signal?: AbortSignal): AsyncGenerator<UpdateState> {
    const queue: UpdateState[] = [this.current];
    let wake: (() => void) | undefined;
    const listener = (s: UpdateState) => {
      queue.push(s);
      wake?.();
    };
    this.listeners.add(listener);
    const onAbort = () => wake?.();
    signal?.addEventListener('abort', onAbort);
    try {
      while (!signal?.aborted) {
        const next = queue.shift();
        if (next) {
          yield next;
          continue;
        }
        await new Promise<void>((r) => {
          wake = r;
        });
        wake = undefined;
      }
    } finally {
      this.listeners.delete(listener);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private set(state: UpdateState): void {
    this.current = state;
    for (const l of this.listeners) l(state);
  }
}
