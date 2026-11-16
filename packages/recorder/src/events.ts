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
]);
export type PageEvent = z.infer<typeof PageEventSchema>;

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
  | { kind: 'newTab'; tab: TabRef; url: string };
