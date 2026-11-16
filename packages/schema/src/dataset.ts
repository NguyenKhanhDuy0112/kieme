import { z } from 'zod';

/** A cell value from Excel/CSV or the manual table. Stored as text, resolved later. */
export const DataRowSchema = z.record(z.string(), z.string());
export type DataRow = z.infer<typeof DataRowSchema>;

/** Loaded dataset: each row = one run of the test [E-03]. */
export const DatasetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    columns: z.array(z.string().min(1)),
    rows: z.array(DataRowSchema),
  })
  .superRefine((ds, ctx) => {
    const seen = new Set<string>();
    for (const col of ds.columns) {
      if (seen.has(col)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate column "${col}"`, path: ['columns'] });
      }
      seen.add(col);
    }
    ds.rows.forEach((row, i) => {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          ctx.addIssue({ code: 'custom', message: `Unknown column "${key}"`, path: ['rows', i] });
        }
      }
    });
  });
export type Dataset = z.infer<typeof DatasetSchema>;

/** How a test case points at its data [E-03]. */
export const DatasetSourceSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.enum(['excel', 'csv']),
    /** Path relative to the test file / workspace. */
    file: z.string().min(1),
    sheet: z.string().optional(),
  }),
  z.object({
    source: z.literal('table'),
    columns: z.array(z.string().min(1)),
    rows: z.array(DataRowSchema),
  }),
  z.object({ source: z.literal('saved'), datasetId: z.string().min(1) }),
]);
export type DatasetSource = z.infer<typeof DatasetSourceSchema>;
