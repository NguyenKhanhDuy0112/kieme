/** At most this many reports per window session (an error in a render loop must not flood). */
const MAX_REPORTS = 20;

/**
 * Forwards uncaught window errors to main, which sends them only if the user opted in to
 * crash reports and after removing personal data [N-09].
 */
export function reportUncaughtErrors(
  target: Pick<Window, 'addEventListener'>,
  send: (e: { message: string; stack?: string }) => Promise<unknown>,
): void {
  let count = 0;
  const report = (reason: unknown) => {
    if (count >= MAX_REPORTS) return;
    count++;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const payload: { message: string; stack?: string } = { message: err.message.slice(0, 2000) };
    if (err.stack) payload.stack = err.stack.slice(0, 20_000);
    void send(payload).catch(() => undefined);
  };
  target.addEventListener('error', (e) =>
    report((e as ErrorEvent).error ?? (e as ErrorEvent).message),
  );
  target.addEventListener('unhandledrejection', (e) => report((e as PromiseRejectionEvent).reason));
}
