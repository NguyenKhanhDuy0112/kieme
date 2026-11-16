import type { RunError } from '@kiemi/schema';

/**
 * Stable engine error codes. The UI turns `code` + `details` into a localised,
 * plain-language message; `message` is an English fallback for logs.
 */
export const ENGINE_ERROR_CODES = [
  'UNKNOWN_ACTION',
  'INVALID_PARAMS',
  'STEP_TIMEOUT',
  'STEP_FAILED',
  'RUN_CANCELLED',
  'ELEMENT_NOT_FOUND',
  'ELEMENT_AMBIGUOUS',
  'BROWSER_NOT_FOUND',
  'BROWSER_DOWNLOAD_FAILED',
  'BROWSER_LAUNCH_FAILED',
  'UNKNOWN_DEVICE',
  'NO_BROWSER',
  'ENGINE_ERROR',
] as const;
export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: EngineErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.details = details;
  }
}

/** Converts anything thrown by an action into a serialisable `RunError`. */
export function toRunError(err: unknown, fallback: EngineErrorCode = 'STEP_FAILED'): RunError {
  if (err instanceof EngineError) {
    return err.details === undefined
      ? { code: err.code, message: err.message }
      : { code: err.code, message: err.message, details: err.details };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: fallback, message };
}
