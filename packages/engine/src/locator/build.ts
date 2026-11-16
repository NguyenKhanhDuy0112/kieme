import type { LocatorStrategy } from '@kiemi/schema';
import type { Frame, FrameLocator, Page, Locator as PwLocator } from 'playwright-core';
import { stableVariantOf } from './stable-id';

/** Anything elements can be searched in: a page, a frame, an iframe, or another element. */
export type LocatorRoot = Page | Frame | FrameLocator | PwLocator;

type AriaRole = Parameters<Page['getByRole']>[0];

/** Translates one stored strategy into a Playwright locator under `root` [C-01]. */
export function buildStrategy(root: LocatorRoot, strategy: LocatorStrategy): PwLocator {
  switch (strategy.kind) {
    case 'role':
      return root.getByRole(strategy.role as AriaRole, {
        ...(strategy.name === undefined ? {} : { name: strategy.name }),
        ...(strategy.exact === undefined ? {} : { exact: strategy.exact }),
      });
    case 'label':
      return root.getByLabel(strategy.value, exactOpt(strategy.exact));
    case 'placeholder':
      return root.getByPlaceholder(strategy.value, exactOpt(strategy.exact));
    case 'text':
      return root.getByText(strategy.value, exactOpt(strategy.exact));
    case 'testId':
      return root.getByTestId(strategy.value);
    case 'css':
      return root.locator(`css=${strategy.value}`);
    case 'xpath':
      return root.locator(`xpath=${strategy.value}`);
  }
}

function exactOpt(exact: boolean | undefined): { exact?: boolean } {
  return exact === undefined ? {} : { exact };
}

export interface StrategyVariant {
  locator: PwLocator;
  /** Matched only the stable part of a dynamic id [C-05]. */
  stableId: boolean;
}

/**
 * The strategy itself, then — for a css/xpath strategy pinned to a dynamic id —
 * a variant matching only the id's stable parts [C-05].
 */
export function strategyVariants(root: LocatorRoot, strategy: LocatorStrategy): StrategyVariant[] {
  const variants: StrategyVariant[] = [{ locator: buildStrategy(root, strategy), stableId: false }];
  if (strategy.kind === 'css' || strategy.kind === 'xpath') {
    const stable = stableVariantOf(strategy.kind, strategy.value);
    if (stable) variants.push({ locator: root.locator(`css=${stable}`), stableId: true });
  }
  return variants;
}
