import { buildStrategy, EngineError, resolveLocator } from '@kiemi/engine';
import type { Locator, Step } from '@kiemi/schema';
import { vi } from '@kiemi/shared';
import type { BrowserContext, Disposable, Frame, Page } from 'playwright-core';
import { type CollectorOptions, type StepChange, StepCollector } from './collector';
import {
  PageEventSchema,
  type RecordedEvent,
  type RecordedTarget,
  type TabRef,
  UiEventSchema,
} from './events';
import { type InjectedConfig, injectedSource, RECORDER_BINDING } from './injected';

/** Storage state of a browser context (cookies + localStorage), as Playwright returns it. */
export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export interface RecorderOptions extends CollectorOptions {
  /** Opened in a new tab when the recording starts (recorded as the first "Mở trang" step). */
  startUrl?: string;
  /** Called after every event that changed the step list. */
  onChange?: (changes: StepChange[], steps: Step[]) => void;
  /** The tester pressed "Dừng" on the in-page toolbar [K-03]. */
  onStopRequest?: () => void;
  /** The tester saved the login session from the toolbar [F-02]. */
  onSaveLogin?: (name: string, state: StorageState) => void | Promise<void>;
  /**
   * A navigation within this time after a user action (click a link, submit a
   * form) or after the previous load (redirect) is caused by it and is not
   * recorded as its own step. Default 1500 ms.
   */
  navigationGraceMs?: number;
  /** In-page strings (`recorder.*` of `@kiemi/shared`). Default Vietnamese. */
  strings?: Record<string, string>;
  /** Floating toolbar in the page [K-03]. Default true. */
  toolbar?: boolean;
  /** `false` = only Pick / Highlight, no steps (e.g. picking from the editor). Default true. */
  capture?: boolean;
}

export interface HighlightResult {
  /** Elements the locator points at: 0 = not found, >1 = ambiguous [C-06]. */
  count: number;
  /** Strategy that matched (0 = preferred), when found. */
  strategyIndex?: number;
}

export interface Recorder {
  /** Steps recorded so far. */
  readonly steps: Step[];
  /** The tab opened for `startUrl`, if any. */
  readonly page: Page | undefined;
  /** Tab the tester used last. */
  activePage(): Page | undefined;
  /** Lets the tester click an element; resolves with its locator, or null on Esc [C-06]. */
  pick(): Promise<Locator | null>;
  /** Shows where a locator points on the active tab and how many elements match [C-06]. */
  highlight(locator: Locator, label?: string): Promise<HighlightResult>;
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

type PageApi = {
  setPick(purpose: 'pick' | 'assert' | 'extract' | null): void;
  setSteps(count: number): void;
  askLogin(): void;
  highlight(els: Element[] | null, label?: string): void;
  teardown(): void;
};
/** `window` inside page functions (they run in the page: no Node-side helpers). */
type W = { __kiemiRecorder?: PageApi };

const DEFAULT_GRACE_MS = 1500;

/**
 * Records what the tester does in `context` and turns it into steps [K-01, K-02]:
 * clicks, typing, choices, ticks, keys in every tab and iframe, page loads the
 * tester started (address bar, reload) and new tabs — plus checks and saved
 * values added from the floating toolbar [K-03], and Pick / Highlight [C-06].
 */
export async function startRecorder(
  context: BrowserContext,
  options: RecorderOptions = {},
): Promise<Recorder> {
  const collector = new StepCollector(options);
  const grace = options.navigationGraceMs ?? DEFAULT_GRACE_MS;
  const strings: Record<string, string> = options.strings ?? { ...vi.recorder };
  const config: InjectedConfig = {
    strings,
    toolbar: options.toolbar ?? true,
    capture: options.capture ?? true,
  };
  const tabs = new Map<Page, TabState>();
  const frames = new WeakMap<Frame, number>();
  let nextTab = 1;
  let nextFrame = 1;
  let stopped = false;
  let startPage: Page | undefined;
  let lastPage: Page | undefined;
  let pending: ((t: RecordedTarget | null) => void) | undefined;

  const livePages = () => context.pages().filter((p) => tabs.has(p) && !p.isClosed());
  const eachFrame = async (fn: (f: Frame) => Promise<unknown>, pages = livePages()) => {
    await Promise.all(pages.flatMap((p) => p.frames().map((f) => fn(f).catch(() => undefined))));
  };
  const setPick = (purpose: 'pick' | 'assert' | 'extract' | null) =>
    eachFrame((f) =>
      f.evaluate((p) => (window as unknown as W).__kiemiRecorder?.setPick(p), purpose),
    );

  const emit = (event: RecordedEvent) => {
    if (stopped || !config.capture) return;
    const changes = collector.push(event);
    if (!changes.length) return;
    options.onChange?.(changes, collector.steps);
    const count = collector.steps.length;
    void Promise.all(
      livePages().map((p) =>
        p.mainFrame().evaluate((n) => (window as unknown as W).__kiemiRecorder?.setSteps(n), count),
      ),
    ).catch(() => undefined);
  };

  const tabRef = (page: Page): TabRef | undefined => {
    const state = tabs.get(page);
    if (!state) return undefined;
    return { id: state.id, index: livePages().indexOf(page) + 1 };
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
    lastPage = page;
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

  /** Toolbar / pick messages; false when the payload is a recorded action instead. */
  const onUi = async (page: Page, payload: unknown): Promise<boolean> => {
    const parsed = UiEventSchema.safeParse(payload);
    if (!parsed.success) return false;
    const e = parsed.data;
    switch (e.kind) {
      case 'command':
        if (e.command === 'stop') options.onStopRequest?.();
        else if (e.command === 'saveLogin')
          await page
            .mainFrame()
            .evaluate(() => (window as unknown as W).__kiemiRecorder?.askLogin());
        else await setPick(e.command);
        return true;
      case 'pickDone':
        await setPick(null);
        if (e.cancelled && pending) {
          pending(null);
          pending = undefined;
        }
        return true;
      case 'picked':
        await setPick(null);
        pending?.(e.target);
        pending = undefined;
        return true;
      case 'saveLogin': {
        const tab = tabRef(page);
        const state = await context.storageState();
        await options.onSaveLogin?.(e.name, state);
        if (tab) emit({ kind: 'saveSession', tab, name: e.name });
        return true;
      }
    }
  };

  const disposables: Disposable[] = [];
  disposables.push(
    await context.exposeBinding(RECORDER_BINDING, async (source, payload: unknown) => {
      if (stopped) return;
      lastPage = source.page;
      if (await onUi(source.page, payload)) return;
      const parsed = PageEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const state = tabs.get(source.page);
      if (state) state.lastActionAt = Date.now();
      const tab = tabRef(source.page);
      if (!tab) return;
      emit({ ...parsed.data, tab, frame: frameId(source.frame) });
    }),
  );
  const source = injectedSource(config, RECORDER_BINDING);
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

  const active = (): Page | undefined => {
    if (lastPage && !lastPage.isClosed()) return lastPage;
    return livePages().at(-1);
  };

  return {
    get steps() {
      return collector.steps;
    },
    get page() {
      return startPage;
    },
    activePage: active,
    async pick() {
      pending?.(null);
      const picked = new Promise<RecordedTarget | null>((resolve) => {
        pending = resolve;
      });
      await active()
        ?.bringToFront()
        .catch(() => undefined);
      await setPick('pick');
      return (await picked)?.locator ?? null;
    },
    async highlight(locator, label = strings.picked ?? '') {
      const page = active();
      if (!page) return { count: 0 };
      await eachFrame(
        (f) => f.evaluate(() => (window as unknown as W).__kiemiRecorder?.highlight(null)),
        [page],
      );
      try {
        const r = await resolveLocator(() => page.frames(), locator, { timeoutMs: 1500 });
        await r.locator.evaluate(
          (el, l) => (window as unknown as W).__kiemiRecorder?.highlight([el], l),
          label,
        );
        return { count: 1, strategyIndex: r.strategyIndex };
      } catch (err) {
        if (!(err instanceof EngineError) || err.code !== 'ELEMENT_AMBIGUOUS') return { count: 0 };
      }
      // Ambiguous: show every match of the first strategy that matches several.
      for (const strategy of locator.strategies) {
        let total = 0;
        const hits: Frame[] = [];
        for (const frame of page.frames()) {
          const n = await buildStrategy(frame, strategy)
            .count()
            .catch(() => 0);
          if (n) hits.push(frame);
          total += n;
        }
        if (total > 1) {
          const text = (strings.matches ?? '{{count}}').replace('{{count}}', String(total));
          for (const frame of hits) {
            await buildStrategy(frame, strategy)
              .evaluateAll(
                (els, l) => (window as unknown as W).__kiemiRecorder?.highlight(els, l),
                text,
              )
              .catch(() => undefined);
          }
          return { count: total };
        }
      }
      return { count: 0 };
    },
    async stop() {
      if (!stopped) {
        stopped = true;
        pending?.(null);
        pending = undefined;
        context.off('page', onPage);
        await eachFrame((f) =>
          f.evaluate(() => (window as unknown as W).__kiemiRecorder?.teardown()),
        );
        await Promise.all(disposables.map((d) => d.dispose().catch(() => undefined)));
      }
      return collector.steps;
    },
  };
}
