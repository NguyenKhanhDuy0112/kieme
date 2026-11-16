import { z } from 'zod';

/**
 * Locator strategy kinds in default priority order [C-01]:
 * role+name → label → placeholder → text → testId → css → xpath.
 */
export const LOCATOR_STRATEGY_KINDS = [
  'role',
  'label',
  'placeholder',
  'text',
  'testId',
  'css',
  'xpath',
] as const;

export const LocatorStrategyKindSchema = z.enum(LOCATOR_STRATEGY_KINDS);
export type LocatorStrategyKind = z.infer<typeof LocatorStrategyKindSchema>;

const nonEmpty = z.string().min(1);

export const LocatorStrategySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('role'),
    /** ARIA role, e.g. `button`, `textbox`. */
    role: nonEmpty,
    /** Accessible name. Optional: some roles (e.g. `main`) are unique without it. */
    name: z.string().optional(),
    exact: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('label'), value: nonEmpty, exact: z.boolean().optional() }),
  z.object({ kind: z.literal('placeholder'), value: nonEmpty, exact: z.boolean().optional() }),
  z.object({ kind: z.literal('text'), value: nonEmpty, exact: z.boolean().optional() }),
  z.object({ kind: z.literal('testId'), value: nonEmpty }),
  z.object({ kind: z.literal('css'), value: nonEmpty }),
  z.object({ kind: z.literal('xpath'), value: nonEmpty }),
]);
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>;

/** Element fingerprint used for self-healing later [C-02]. */
export const FingerprintSchema = z.object({
  tag: nonEmpty,
  text: z.string().optional(),
  /** Attributes captured at record time (id, name, class, type, aria-*, data-*…). */
  attributes: z.record(z.string(), z.string()).default({}),
  /** Nearby context: associated label, preceding text, parent landmark… */
  neighbors: z.array(z.string()).default([]),
  /** Bounding box in CSS pixels at record time. */
  box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    })
    .optional(),
});
export type Fingerprint = z.infer<typeof FingerprintSchema>;

/** Ordered strategies (first = preferred). Tried one by one until one matches [C-01]. */
export const LocatorSchema = z.object({
  strategies: z.array(LocatorStrategySchema).min(1),
  fingerprint: FingerprintSchema.optional(),
});
export type Locator = z.infer<typeof LocatorSchema>;

/** Element ref key, e.g. `el_btnSave`. Usable as an object key and in UI. */
export const ElementRefSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, 'Element ref must be letters, digits, `_` or `-`');

/** A named, reusable element stored in the test's element map. */
export const ElementSchema = LocatorSchema.extend({
  /** Human-readable name shown to testers, e.g. "Nút Lưu". */
  name: nonEmpty,
});
export type Element = z.infer<typeof ElementSchema>;

/** What a step points at: a reference to a stored element, or an inline locator. */
export const TargetSchema = z.union([
  z.object({ ref: ElementRefSchema }).strict(),
  LocatorSchema.strict(),
]);
export type Target = z.infer<typeof TargetSchema>;
