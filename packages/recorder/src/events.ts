import { LocatorSchema } from '@kiemi/schema';
import { z } from 'zod';

/**
 * Element an in-page event happened on. `key` identifies the element within its
 * frame for the whole recording (used to merge repeated actions [K-02]).
 */
export const RecordedTargetSchema = z.object({
  key: z.string().min(1).max(64),
  locator: LocatorSchema,
});
export type RecordedTarget = z.infer<typeof RecordedTargetSchema>;

const MODIFIERS = ['Alt', 'Control', 'Meta', 'Shift'] as const;

/**
 * What the injected script sends through the binding. Payloads come from the
 * page under test, so they are untrusted and always parsed with this schema.
 */
export const PageEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('click'),
    target: RecordedTargetSchema,
    button: z.enum(['left', 'right']).default('left'),
    modifiers: z.array(z.enum(MODIFIERS)).max(4).default([]),
  }),
  z.object({ kind: z.literal('dblclick'), target: RecordedTargetSchema }),
  z.object({
    kind: z.literal('fill'),
    target: RecordedTargetSchema,
    value: z.string().max(100_000),
    /** Typed in a password field [K-05]. */
    secret: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('select'),
    target: RecordedTargetSchema,
    option: z.string().max(10_000),
  }),
  z.object({ kind: z.literal('check'), target: RecordedTargetSchema, checked: z.boolean() }),
  z.object({
    kind: z.literal('press'),
    keys: z.string().min(1).max(100),
    target: RecordedTargetSchema.optional(),
  }),
  /** "Thêm kiểm tra" on an element [K-03]. */
  z.object({
    kind: z.literal('assert'),
    target: RecordedTargetSchema,
    check: z.enum(['visible', 'text', 'value', 'checked']),
    value: z.string().max(10_000).optional(),
  }),
  /** "Lưu giá trị" of an element into a variable [K-03]. */
  z.object({
    kind: z.literal('extract'),
    target: RecordedTargetSchema,
    from: z.enum(['text', 'value']),
    into: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(64),
  }),
]);
export type PageEvent = z.infer<typeof PageEventSchema>;

/** Messages of the in-page UI that drive the recorder rather than add steps. */
export const UiEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('command'),
    command: z.enum(['assert', 'extract', 'saveLogin', 'stop']),
  }),
  /** Pick mode ended (menu answered, or Esc). */
  z.object({ kind: z.literal('pickDone'), cancelled: z.boolean().optional() }),
  /** An element chosen with Pick [C-06]. */
  z.object({ kind: z.literal('picked'), target: RecordedTargetSchema }),
  /** What appeared on the page after an action: candidate checks [M-01]. */
  z.object({
    kind: z.literal('suggest'),
    items: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('toast'), text: z.string().min(1).max(500) }),
          z.object({
            kind: z.enum(['row', 'visible']),
            text: z.string().min(1).max(500),
            target: RecordedTargetSchema,
          }),
        ]),
      )
      .max(5),
  }),
  /** ✓ / ✕ on a suggested check in the page [M-01]. */
  z.object({ kind: z.literal('suggestion'), id: z.string().min(1).max(64), accept: z.boolean() }),
  /** "Lưu đăng nhập" with the session name typed in the page [F-02]. */
  z.object({
    kind: z.literal('saveLogin'),
    name: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(64),
  }),
]);
export type UiEvent = z.infer<typeof UiEventSchema>;

/** A tab of the recorded browser context: stable id + 1-based position. */
export interface TabRef {
  id: number;
  index: number;
}

/**
 * Everything the step collector consumes: page events (with the tab and frame
 * they came from) and navigation events observed by the recorder.
 */
export type RecordedEvent =
  | (PageEvent & { tab: TabRef; frame: number })
  | { kind: 'goto'; tab: TabRef; url: string }
  | { kind: 'reload'; tab: TabRef }
  | { kind: 'newTab'; tab: TabRef; url: string }
  /** Login session saved from the toolbar [F-02]. */
  | { kind: 'saveSession'; tab: TabRef; name: string };
