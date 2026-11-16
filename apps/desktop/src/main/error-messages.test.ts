import { DB_ERROR_CODES } from '@kiemi/db';
import { ENGINE_ERROR_CODES } from '@kiemi/engine';
import { en, vi } from '@kiemi/shared';
import { describe, expect, it } from 'vitest';

/**
 * Every error the engine or the data layer can raise has a plain-language message
 * (and, for engine errors, a hint) in both languages (N-06, M6-03).
 */
describe('error messages cover every error code', () => {
  it('engine codes', () => {
    for (const lang of [vi, en]) {
      const codes = lang.errors.codes as Record<string, { message: string; hint: string }>;
      const missing = ENGINE_ERROR_CODES.filter((c) => !codes[c]?.message || !codes[c]?.hint);
      expect(missing).toEqual([]);
    }
    expect(Object.keys(vi.errors.codes).sort()).toEqual([...ENGINE_ERROR_CODES].sort());
  });

  it('data-layer codes', () => {
    for (const lang of [vi, en]) {
      const msgs = lang.ui.dbErrors as Record<string, string>;
      expect(DB_ERROR_CODES.filter((c) => !msgs[c])).toEqual([]);
    }
  });
});
