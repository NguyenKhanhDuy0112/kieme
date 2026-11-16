import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { EngineError } from '../errors';
import { contextEmulation, type ViewportSettings } from './options';
import type { ContextProxy } from './proxy';

interface SessionState {
  context: BrowserContext;
  page: Page;
}

export interface SessionArtifact {
  session: string;
  kind: 'video' | 'trace';
  /** Absolute path on disk. */
  path: string;
}

export interface SessionPagesOptions {
  viewport?: ViewportSettings;
  proxy?: ContextProxy | undefined;
  /** Record a video per page into this folder [I-03]. */
  videoDir?: string | undefined;
  /** Record a Playwright trace per session into this folder [I-03]. */
  traceDir?: string | undefined;
  /** Called for every page of every session (first page, new tabs, popups). */
  onPage?: (session: string, page: Page) => void;
}

/**
 * One browser context (own cookies/storage) and active page per session,
 * created on first use [F-01, G-03]. New tabs/popups become the active page
 * automatically [A-13].
 */
export class SessionPages {
  readonly #browser: Browser | undefined;
  readonly #options: SessionPagesOptions;
  readonly #sessions = new Map<string, Promise<SessionState>>();

  constructor(browser: Browser | undefined, options: SessionPagesOptions = {}) {
    this.#browser = browser;
    this.#options = options;
  }

  get hasBrowser(): boolean {
    return this.#browser !== undefined;
  }

  /** Active page of `session`, creating its context on first use. */
  async page(session: string): Promise<Page> {
    const state = await this.#state(session);
    if (state.page.isClosed()) {
      // The active tab was closed (by the page or a step): fall back to the last open one.
      const open = state.context.pages().filter((p) => !p.isClosed());
      state.page = open.at(-1) ?? (await state.context.newPage());
    }
    return state.page;
  }

  async context(session: string): Promise<BrowserContext> {
    return (await this.#state(session)).context;
  }

  /** Open tabs of `session`, in opening order. */
  async pages(session: string): Promise<Page[]> {
    return (await this.#state(session)).context.pages().filter((p) => !p.isClosed());
  }

  /** Makes `page` the active page of `session` (switch tab). */
  async setActivePage(session: string, page: Page): Promise<void> {
    const state = await this.#state(session);
    state.page = page;
    await page.bringToFront().catch(() => undefined);
  }

  /** Sessions opened so far. */
  opened(): string[] {
    return [...this.#sessions.keys()];
  }

  isOpen(session: string): boolean {
    return this.#sessions.has(session);
  }

  #state(session: string): Promise<SessionState> {
    const browser = this.#browser;
    if (!browser) {
      return Promise.reject(new EngineError('NO_BROWSER', 'This run has no browser', { session }));
    }
    let state = this.#sessions.get(session);
    if (!state) {
      state = (async () => {
        const o = this.#options;
        const emulation = contextEmulation(o.viewport ?? {});
        const context = await browser.newContext({
          ...emulation,
          ...(o.proxy ? { proxy: o.proxy } : {}),
          ...(o.videoDir
            ? { recordVideo: { dir: join(o.videoDir, session), size: emulation.viewport } }
            : {}),
        });
        if (o.traceDir)
          await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const holder: { state?: SessionState } = {};
        context.on('page', (p) => {
          o.onPage?.(session, p);
          // A popup / new tab opened by the page becomes the active one [A-13].
          if (holder.state) holder.state.page = p;
        });
        const page = await context.newPage();
        holder.state = { context, page };
        return holder.state;
      })();
      this.#sessions.set(session, state);
      // Do not cache a failed creation.
      state.catch(() => this.#sessions.delete(session));
    }
    return state;
  }

  /** Closes every session's context, saving traces/videos. Never throws. */
  async closeAll(): Promise<SessionArtifact[]> {
    const entries = [...this.#sessions.entries()];
    this.#sessions.clear();
    const artifacts: SessionArtifact[] = [];
    await Promise.all(
      entries.map(async ([session, pending]) => {
        try {
          const { context } = await pending;
          const pages = context.pages();
          if (this.#options.traceDir) {
            const path = join(this.#options.traceDir, `trace-${session}.zip`);
            await context.tracing.stop({ path });
            artifacts.push({ session, kind: 'trace', path });
          }
          await context.close();
          if (this.#options.videoDir) {
            for (const p of pages) {
              const path = await p.video()?.path();
              if (path) artifacts.push({ session, kind: 'video', path });
            }
          }
        } catch {
          // Already closed or creation failed.
        }
      }),
    );
    return artifacts;
  }
}
