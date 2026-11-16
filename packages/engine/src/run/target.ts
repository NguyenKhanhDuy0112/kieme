import {
  ElementRefSchema,
  type Locator,
  LocatorSchema,
  NthSchema,
  type TestCase,
} from '@kiemi/schema';
import { z } from 'zod';
import { EngineError } from '../errors';

/**
 * What an action param may point at: a stored element (`{ ref }`), an inline
 * locator (`{ strategies }`), or shorthands typed by hand / used in conditions:
 * `{ text }`, `{ label }`, `{ placeholder }`, `{ role, name }`, `{ testId }`, `{ css }`.
 */
export const TargetParamSchema = z.union([
  z.object({ ref: ElementRefSchema }).strict(),
  LocatorSchema.strict(),
  z
    .object({ text: z.string().min(1), exact: z.boolean().optional(), nth: NthSchema.optional() })
    .strict(),
  z
    .object({ label: z.string().min(1), exact: z.boolean().optional(), nth: NthSchema.optional() })
    .strict(),
  z.object({ placeholder: z.string().min(1), nth: NthSchema.optional() }).strict(),
  z
    .object({
      role: z.string().min(1),
      name: z.string().optional(),
      exact: z.boolean().optional(),
      nth: NthSchema.optional(),
    })
    .strict(),
  z.object({ testId: z.string().min(1), nth: NthSchema.optional() }).strict(),
  z.object({ css: z.string().min(1), nth: NthSchema.optional() }).strict(),
]);
export type TargetParam = z.infer<typeof TargetParamSchema>;

export interface ResolvedTarget {
  locator: Locator;
  /** Element name for messages, e.g. "Nút Lưu". */
  name?: string;
}

/** Turns a target param into a full locator (elements map lookup, shorthands). */
export function toLocator(target: TargetParam, elements: TestCase['elements']): ResolvedTarget {
  const nth = 'nth' in target && target.nth !== undefined ? { nth: target.nth } : {};
  if ('ref' in target) {
    const el = elements[target.ref];
    if (!el)
      throw new EngineError('INVALID_PARAMS', `Unknown element "${target.ref}"`, {
        ref: target.ref,
      });
    const { name, ...locator } = el;
    return { locator, name };
  }
  if ('strategies' in target) return { locator: target };
  if ('text' in target) {
    return {
      locator: {
        strategies: [
          {
            kind: 'text',
            value: target.text,
            ...(target.exact === undefined ? {} : { exact: target.exact }),
          },
        ],
        ...nth,
      },
      name: target.text,
    };
  }
  if ('label' in target) {
    return {
      locator: {
        strategies: [
          {
            kind: 'label',
            value: target.label,
            ...(target.exact === undefined ? {} : { exact: target.exact }),
          },
        ],
        ...nth,
      },
      name: target.label,
    };
  }
  if ('placeholder' in target) {
    return {
      locator: { strategies: [{ kind: 'placeholder', value: target.placeholder }], ...nth },
      name: target.placeholder,
    };
  }
  if ('role' in target) {
    return {
      locator: {
        strategies: [
          {
            kind: 'role',
            role: target.role,
            ...(target.name === undefined ? {} : { name: target.name }),
            ...(target.exact === undefined ? {} : { exact: target.exact }),
          },
        ],
        ...nth,
      },
      ...(target.name === undefined ? {} : { name: target.name }),
    };
  }
  if ('testId' in target)
    return { locator: { strategies: [{ kind: 'testId', value: target.testId }], ...nth } };
  return { locator: { strategies: [{ kind: 'css', value: target.css }], ...nth } };
}
