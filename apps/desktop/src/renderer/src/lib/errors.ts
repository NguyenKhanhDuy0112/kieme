import { describeRunError, type Translate } from '@kiemi/shared';
import { TRPCClientError } from '@trpc/client';

interface ErrorData {
  kiemiCode?: string;
  details?: Record<string, unknown> | null;
}

/**
 * Plain-language message for any error from main (U-05, N-06): data-layer
 * codes first, then engine codes, then a generic message.
 */
export function errorMessage(err: unknown, t: Translate): string {
  if (err instanceof TRPCClientError) {
    const data = (err.data ?? {}) as ErrorData;
    if (data.kiemiCode) {
      const key = `ui.dbErrors.${data.kiemiCode}`;
      const msg = t(key);
      if (msg !== key) return msg;
    }
    if (
      data.kiemiCode === undefined &&
      typeof (err.data as { code?: string } | undefined)?.code === 'string'
    ) {
      const code = (err.data as { code: string }).code;
      if (code === 'BAD_REQUEST') return t('ui.dbErrors.VALIDATION');
      if (code === 'NOT_FOUND') return t('ui.dbErrors.NOT_FOUND');
      if (code === 'CONFLICT') return t('ui.dbErrors.VERSION_CONFLICT');
    }
  }
  const e = err as { code?: unknown; message?: unknown; details?: unknown };
  if (typeof e?.code === 'string' && typeof e.message === 'string') {
    return describeRunError(
      {
        code: e.code,
        message: e.message,
        details: (e.details ?? undefined) as Record<string, unknown> | undefined,
      },
      t,
    ).message;
  }
  return t('ui.dbErrors.unknown');
}

/** True when the error is an optimistic-lock conflict (someone saved in between). */
export function isConflict(err: unknown): boolean {
  return (
    err instanceof TRPCClientError &&
    (err.data as ErrorData | undefined)?.kiemiCode === 'VERSION_CONFLICT'
  );
}
