import type { Browser, BrowserContext, Page } from 'playwright-core';
import { EngineError } from '../errors';
import { contextEmulation, type ViewportSettings } from './options';

interface SessionState {
  context: BrowserContext;
  page: Page;
}

/**
 * One browser context (own cookies/storage) and active page per session,
 * created on first use [F-01, G-03].
 */
export class SessionPages {
  readonly #browser: Browser | undefined;
  readonly #viewport: ViewportSettings;
  readonly #sessions = new Map<string, Promise<SessionState>>();

  constructor(browser: Browser | undefined, viewport: ViewportSettings = {}) {
    this.#browser = browser;
    this.#viewport = viewport;
  }

  /** Active page of `session`, creating its context on first use. */
  async page(session: string): Promise<Page> {
    return (await this.#state(session)).page;
  }

  async context(session: string): Promise<BrowserContext> {
    return (await this.#state(session)).context;
  }

  /** Makes `page` the active page of `session` (new tab / popup). */
  async setActivePage(session: string, page: Page): Promise<void> {
    const state = await this.#state(session);
    state.page = page;
  }

  /** Sessions opened so far. */
  opened(): string[] {
    return [...this.#sessions.keys()];
  }

  #state(session: string): Promise<SessionState> {
    const browser = this.#browser;
    if (!browser) {
      return Promise.reject(new EngineError('NO_BROWSER', 'This run has no browser', { session }));
    }
    let state = this.#sessions.get(session);
    if (!state) {
      state = (async () => {
        const context = await browser.newContext(contextEmulation(this.#viewport));
        return { context, page: await context.newPage() };
      })();
      this.#sessions.set(session, state);
      // Do not cache a failed creation.
      state.catch(() => this.#sessions.delete(session));
    }
    return state;
  }

  /** Closes every session's context. Never throws. */
  async closeAll(): Promise<void> {
    const states = [...this.#sessions.values()];
    this.#sessions.clear();
    await Promise.all(
      states.map(async (s) => {
        try {
          await (await s).context.close();
        } catch {
          // Already closed or creation failed.
        }
      }),
    );
  }
}
