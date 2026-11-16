import type { Step } from '@kiemi/schema';
import type { BrowserContext, Disposable, Frame, Page } from 'playwright-core';
import { type CollectorOptions, type StepChange, StepCollector } from './collector';
import { PageEventSchema, type RecordedEvent, type TabRef } from './events';
import { injectedSource, RECORDER_BINDING } from './injected';

export interface RecorderOptions extends CollectorOptions {
  /** Opened in a new tab when the recording starts (recorded as the first "Mở trang" step). */
  startUrl?: string;
  /** Called after every event that changed the step list. */
  onChange?: (changes: StepChange[], steps: Step[]) => void;
  /**
   * A navigation within this time after a user action (click a link, submit a
   * form) or after the previous load (redirect) is caused by it and is not
   * recorded as its own step. Default 1500 ms.
   */
  navigationGraceMs?: number;
}

export interface Recorder {
  /** Steps recorded so far. */
  readonly steps: Step[];
  /** The tab opened for `startUrl`, if any. */
  readonly page: Page | undefined;
  /** Stops listening; already-open pages keep working normally. */
  stop(): Promise<Step[]>;
}

interface TabState {
  id: number;
  /** Opened by the page itself (link with target=_blank, window.open). */
  popup: boolean;
  /** Main-frame URL after the last navigation, '' before the first one. */
  url: string;
  lastActionAt: number;
  /** When the main frame last navigated (for redirect chains). */
  lastNavigatedAt: number;
}

const DEFAULT_GRACE_MS = 1500;

/**
 * Records what the tester does in `context` and turns it into steps [K-01, K-02]:
 * clicks, typing, choices, ticks, keys in every tab and iframe, plus page loads
 * the tester started (address bar, reload) and new tabs.
 */
export async function startRecorder(
  context: BrowserContext,
  options: RecorderOptions = {},
): Promise<Recorder> {
  const collector = new StepCollector(options);
  const grace = options.navigationGraceMs ?? DEFAULT_GRACE_MS;
  const tabs = new Map<Page, TabState>();
  const frames = new WeakMap<Frame, number>();
  let nextTab = 1;
  let nextFrame = 1;
  let stopped = false;
  let startPage: Page | undefined;

  const emit = (event: RecordedEvent) => {
    if (stopped) return;
    const changes = collector.push(event);
    if (changes.length) options.onChange?.(changes, collector.steps);
  };

  const tabRef = (page: Page): TabRef | undefined => {
    const state = tabs.get(page);
    if (!state) return undefined;
    const open = context.pages().filter((p) => tabs.has(p));
    return { id: state.id, index: open.indexOf(page) + 1 };
  };

  const frameId = (frame: Frame): number => {
    let id = frames.get(frame);
    if (id === undefined) {
      id = nextFrame++;
      frames.set(frame, id);
    }
    return id;
  };

  const onNavigated = (page: Page, frame: Frame) => {
    if (frame !== page.mainFrame()) return;
    const state = tabs.get(page);
    const url = frame.url();
    if (!state || url === 'about:blank' || url === '') return;
    const first = state.url === '';
    const previous = state.url;
    const since = Date.now() - Math.max(state.lastActionAt, state.lastNavigatedAt);
    state.url = url;
    state.lastNavigatedAt = Date.now();
    const tab = tabRef(page);
    if (!tab) return;
    if (first) {
      // A popup's first page comes from the click that opened it.
      if (state.popup) return;
      const noStepsYet = collector.steps.length === 0;
      emit(noStepsYet ? { kind: 'goto', tab, url } : { kind: 'newTab', tab, url });
      return;
    }
    // Caused by a recent action, or a redirect right after the previous load.
    if (since < grace) return;
    emit(url === previous ? { kind: 'reload', tab } : { kind: 'goto', tab, url });
  };

  const track = (page: Page, popup: boolean) => {
    if (tabs.has(page)) return;
    const current = page.url();
    tabs.set(page, {
      id: nextTab++,
      popup,
      url: current === 'about:blank' ? '' : current,
      lastActionAt: 0,
      lastNavigatedAt: 0,
    });
    page.on('framenavigated', (frame) => onNavigated(page, frame));
    page.on('close', () => tabs.delete(page));
  };

  const onPage = (page: Page) => {
    // Assume a popup until `opener()` says otherwise, so its first load is not recorded.
    track(page, true);
    page
      .opener()
      .then((opener) => {
        const state = tabs.get(page);
        if (state && opener === null) state.popup = false;
      })
      .catch(() => undefined);
  };

  const disposables: Disposable[] = [];
  disposables.push(
    await context.exposeBinding(RECORDER_BINDING, (source, payload: unknown) => {
      if (stopped) return;
      const parsed = PageEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const state = tabs.get(source.page);
      if (state) state.lastActionAt = Date.now();
      const tab = tabRef(source.page);
      if (!tab) return;
      emit({ ...parsed.data, tab, frame: frameId(source.frame) });
    }),
  );
  const source = injectedSource(RECORDER_BINDING);
  disposables.push(await context.addInitScript({ content: source }));

  for (const page of context.pages()) {
    track(page, false);
    // Pages already open before the recording: install in their current documents too.
    await Promise.all(page.frames().map((f) => f.evaluate(source).catch(() => undefined)));
  }
  context.on('page', onPage);

  if (options.startUrl) {
    startPage = await context.newPage();
    track(startPage, false);
    const state = tabs.get(startPage);
    if (state) state.popup = false;
    await startPage.goto(options.startUrl);
  }

  return {
    get steps() {
      return collector.steps;
    },
    get page() {
      return startPage;
    },
    async stop() {
      if (!stopped) {
        stopped = true;
        context.off('page', onPage);
        await Promise.all(disposables.map((d) => d.dispose().catch(() => undefined)));
      }
      return collector.steps;
    },
  };
}
