import type { Locator, LocatorScope, LocatorStrategy, NearPosition, Nth } from '@kiemi/schema';
import type { ElementHandle, Locator as PwLocator } from 'playwright-core';
import { EngineError } from '../errors';
import { type LocatorRoot, strategyVariants } from './build';

export interface ResolveOptions {
  /** How long to keep retrying before giving up (usually the step timeout). */
  timeoutMs: number;
  signal?: AbortSignal;
  /**
   * `visible` (default): only visible elements count — what a tester sees.
   * `attached`: hidden elements count too (e.g. a hidden `<input type="file">`).
   */
  state?: 'visible' | 'attached';
  /** Delay between attempts while waiting for the element. */
  pollIntervalMs?: number;
  /** Human-readable element name for error details, e.g. "Nút Lưu". */
  name?: string;
}

export interface ResolvedLocator {
  /** Playwright locator pinned to exactly one element. */
  locator: PwLocator;
  /** Strategy that matched, and its position in `strategies` (0 = preferred). */
  strategy: LocatorStrategy;
  strategyIndex: number;
  /** Matched only the stable part of a dynamic id [C-05]. */
  stableId: boolean;
  /** How many elements the strategy matched before `nth` was applied. */
  matchCount: number;
}

const DEFAULT_POLL_MS = 100;
const NEAR_DISTANCE_PX = 50;

type NearScope = Extract<LocatorScope, { kind: 'near' }>;

interface Attempt {
  found?: ResolvedLocator;
  /** Some strategy matched several elements and nothing disambiguated it. */
  ambiguous?: { strategyIndex: number; count: number };
  /** A `within`/`row` scope or `near` anchor is not on the page (yet). */
  scopeMissing?: boolean;
  lastError?: string;
}

/**
 * Finds the element a stored locator points at [C-01, C-03, C-04, C-05].
 *
 * Every attempt tries the strategies in order and takes the first one that
 * pins exactly one element (after scope and `nth`). Strategies matching
 * several elements are skipped as ambiguous. Attempts repeat until
 * `timeoutMs`, so elements that appear late are still found.
 */
export async function resolveLocator(
  root: LocatorRoot,
  locator: Locator,
  options: ResolveOptions,
): Promise<ResolvedLocator> {
  const { timeoutMs, signal } = options;
  const pollMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  let last: Attempt = {};

  for (;;) {
    throwIfAborted(signal);
    last = await attempt(root, locator, options.state ?? 'visible');
    if (last.found) return last.found;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(pollMs, remaining), signal);
  }

  const details: Record<string, unknown> = {
    strategy: locator.strategies[0],
    strategies: locator.strategies.length,
    timeoutMs,
  };
  if (options.name !== undefined) details.name = options.name;
  if (last.scopeMissing) details.scopeMissing = true;
  if (last.lastError !== undefined) details.lastError = last.lastError;

  if (last.ambiguous) {
    const strategy = locator.strategies[last.ambiguous.strategyIndex];
    throw new EngineError(
      'ELEMENT_AMBIGUOUS',
      `${describe(options.name, strategy)} matches ${last.ambiguous.count} elements`,
      { ...details, strategy, count: last.ambiguous.count },
    );
  }
  throw new EngineError(
    'ELEMENT_NOT_FOUND',
    `${describe(options.name, locator.strategies[0])} not found after ${timeoutMs} ms`,
    details,
  );
}

async function attempt(
  root: LocatorRoot,
  locator: Locator,
  state: 'visible' | 'attached',
): Promise<Attempt> {
  const result: Attempt = {};
  let scoped: { root: LocatorRoot; near: NearScope[] } | undefined;
  try {
    scoped = await applyScopes(root, locator.scope ?? []);
  } catch (err) {
    // Navigation in progress, detached frame… — retry on the next attempt.
    result.lastError = errorMessage(err);
    return result;
  }
  if (!scoped) {
    result.scopeMissing = true;
    return result;
  }

  for (const [strategyIndex, strategy] of locator.strategies.entries()) {
    for (const variant of strategyVariants(scoped.root, strategy)) {
      try {
        const candidates =
          state === 'visible' ? variant.locator.filter({ visible: true }) : variant.locator;
        const count = await candidates.count();
        if (count === 0) continue;

        let order: number[] | undefined;
        if (scoped.near.length > 0) {
          order = await orderByNear(scoped.root, candidates, scoped.near);
          if (order === undefined) {
            result.scopeMissing = true;
            continue;
          }
          if (order.length === 0) continue;
        }

        const index = pick(locator.nth, order ?? count);
        if (index === 'ambiguous') {
          if (!result.ambiguous) result.ambiguous = { strategyIndex, count };
          continue;
        }
        if (index === undefined) continue; // fewer matches than the requested position (yet)
        result.found = {
          locator: candidates.nth(index),
          strategy,
          strategyIndex,
          stableId: variant.stableId,
          matchCount: count,
        };
        return result;
      } catch (err) {
        // Invalid selector or page changing under us: try the next strategy.
        result.lastError = errorMessage(err);
      }
    }
  }
  return result;
}

/** Applies `within` / `row` scopes in order; `near` scopes are kept for ordering. */
async function applyScopes(
  root: LocatorRoot,
  scopes: readonly LocatorScope[],
): Promise<{ root: LocatorRoot; near: NearScope[] } | undefined> {
  let current = root;
  const near: NearScope[] = [];
  for (const scope of scopes) {
    if (scope.kind === 'near') {
      near.push(scope);
      continue;
    }
    if (scope.kind === 'row') {
      const text = cssString(scope.text);
      const cell = scope.exact ? `:text-is(${text})` : `:has-text(${text})`;
      const rows = current.locator(`css=:is(tr, [role="row"]):has(${cell})`);
      const count = await rows.count();
      if (count === 0) return undefined;
      current = rows;
      continue;
    }
    // within: first strategy that finds the region wins; `nth` picks among several regions.
    let region: PwLocator | undefined;
    for (const strategy of scope.strategies) {
      for (const variant of strategyVariants(current, strategy)) {
        const count = await variant.locator.count();
        if (count === 0) continue;
        if (scope.nth === undefined) {
          region = variant.locator;
        } else {
          const index = pick(scope.nth, count);
          if (index === undefined || index === 'ambiguous') continue;
          region = variant.locator.nth(index);
        }
        break;
      }
      if (region) break;
    }
    if (!region) return undefined;
    current = region;
  }
  return { root: current, near };
}

/**
 * Indexes of `candidates` that satisfy every `near` scope, closest first.
 * `undefined` when an anchor text is not on the page.
 */
async function orderByNear(
  root: LocatorRoot,
  candidates: PwLocator,
  scopes: readonly NearScope[],
): Promise<number[] | undefined> {
  const handles: ElementHandle[] = [];
  try {
    const anchors: { anchor: ElementHandle; position: NearPosition }[] = [];
    for (const scope of scopes) {
      const anchor = root
        .getByText(scope.text, scope.exact === undefined ? {} : { exact: scope.exact })
        .filter({ visible: true })
        .first();
      if ((await anchor.count()) === 0) return undefined;
      const handle = await anchor.elementHandle({ timeout: 1000 });
      if (!handle) return undefined;
      handles.push(handle);
      anchors.push({ anchor: handle, position: scope.position });
    }
    return await candidates.evaluateAll(
      (els, arg) => {
        const scored: { i: number; score: number }[] = [];
        els.forEach((el, i) => {
          const c = el.getBoundingClientRect();
          if (c.width === 0 && c.height === 0) return;
          let total = 0;
          for (const { anchor, position } of arg.anchors) {
            const target = anchor as unknown as Element;
            if (el === target || el.contains(target)) return;
            const a = target.getBoundingClientRect();
            const dx = Math.max(0, a.left - c.right, c.left - a.right);
            const dy = Math.max(0, a.top - c.bottom, c.top - a.bottom);
            const distance = Math.hypot(dx, dy);
            const tolerance = 2;
            let ok: boolean;
            if (position === 'below') ok = c.top >= a.bottom - tolerance;
            else if (position === 'above') ok = c.bottom <= a.top + tolerance;
            else if (position === 'rightOf') ok = c.left >= a.right - tolerance;
            else if (position === 'leftOf') ok = c.right <= a.left + tolerance;
            else ok = distance <= arg.maxNear;
            if (!ok) return;
            total += distance;
          }
          scored.push({ i, score: total });
        });
        scored.sort((x, y) => x.score - y.score || x.i - y.i);
        return scored.map((s) => s.i);
      },
      { anchors, maxNear: NEAR_DISTANCE_PX },
    );
  } finally {
    await Promise.all(handles.map((h) => h.dispose().catch(() => undefined)));
  }
}

/**
 * Index to use among the matches [C-04]. `order` is either the match count or
 * an explicit ordering (closest first, for `near`). Without `nth`, a plain match
 * must be unique, while a `near` match takes the closest.
 */
function pick(
  nth: Nth | undefined,
  order: number | readonly number[],
): number | undefined | 'ambiguous' {
  const list = typeof order === 'number' ? undefined : order;
  const count = list ? list.length : (order as number);
  let position: number;
  if (nth === undefined) {
    if (list) position = 0;
    else if (count === 1) position = 0;
    else return 'ambiguous';
  } else if (nth === 'first') position = 0;
  else if (nth === 'last') position = count - 1;
  else position = nth - 1;
  if (position < 0 || position >= count) return undefined;
  return list ? list[position] : position;
}

function describe(name: string | undefined, strategy: LocatorStrategy | undefined): string {
  if (name !== undefined) return `Element "${name}"`;
  if (!strategy) return 'Element';
  switch (strategy.kind) {
    case 'role':
      return `Element ${strategy.role}${strategy.name === undefined ? '' : ` "${strategy.name}"`}`;
    default:
      return `Element ${strategy.kind} "${strategy.value}"`;
  }
}

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new EngineError('RUN_CANCELLED', 'Run cancelled');
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }
    function onAbort() {
      clearTimeout(timer);
      reject(new EngineError('RUN_CANCELLED', 'Run cancelled'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
