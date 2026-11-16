import { describe, expect, it, vi } from 'vitest';
import { reportUncaughtErrors } from './report-errors';

describe('reportUncaughtErrors [N-09]', () => {
  it('forwards uncaught errors and rejections, at most 20', () => {
    const target = new EventTarget();
    const send = vi.fn(async () => true);
    reportUncaughtErrors(target as unknown as Window, send);
    const error = Object.assign(new Event('error'), { error: new Error('boom') });
    target.dispatchEvent(error);
    const rejection = Object.assign(new Event('unhandledrejection'), { reason: 'nope' });
    target.dispatchEvent(rejection);
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'boom' }));
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'nope' }));
    for (let i = 0; i < 30; i++) target.dispatchEvent(error);
    expect(send).toHaveBeenCalledTimes(20);
  });
});
