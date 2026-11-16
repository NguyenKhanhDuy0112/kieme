import { describe, expect, it } from 'vitest';
import { createScrubber, type ScrubbableEvent } from './scrub';

describe('crash report scrubbing [N-09]', () => {
  it('removes personal data and keeps what helps fixing the bug', () => {
    const scrub = createScrubber('/Users/an.nguyen');
    const event: ScrubbableEvent = {
      message: 'Cannot open /Users/an.nguyen/Library/kiemi.db for an.nguyen@cty.vn',
      user: { id: 'x', ip_address: '1.2.3.4' },
      server_name: 'MAY-CUA-AN',
      breadcrumbs: [{ message: 'navigate https://noibo.cty.vn/luong?id=7' }],
      extra: { password: 'secret' },
      contexts: {
        os: { name: 'macOS', version: '15.1', kernel_version: 'x' },
        device: { name: 'MacBook của An' },
        app: { app_version: '1.0.0', app_name: 'Kiemi', app_memory: 1 },
      },
      exception: {
        values: [
          {
            value: 'fetch failed: https://noibo.cty.vn/api/login?user=an',
            stacktrace: {
              frames: [
                {
                  filename:
                    '/Users/an.nguyen/Apps/Kiemi.app/Contents/Resources/app.asar/out/main/index.js',
                  abs_path: '/Users/an.nguyen/Apps/x.js',
                  vars: { password: 'secret' },
                  context_line: 'const password = "secret"',
                },
              ],
            },
          },
        ],
      },
    };
    const out = scrub(event);
    const json = JSON.stringify(out);
    for (const leak of ['an.nguyen', 'MAY-CUA-AN', 'noibo.cty.vn', 'secret', '1.2.3.4', 'của An'])
      expect(json).not.toContain(leak);
    expect(out.message).toBe('Cannot open ~/Library/kiemi.db for <email>');
    expect(out.exception?.values?.[0]?.value).toBe('fetch failed: <url>');
    expect(out.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      '~/Apps/Kiemi.app/Contents/Resources/app.asar/out/main/index.js',
    );
    expect(out.contexts).toEqual({
      os: { name: 'macOS', version: '15.1' },
      app: { app_version: '1.0.0' },
    });
  });

  it('handles Windows home folders in both slash styles', () => {
    const scrub = createScrubber('C:\\Users\\Binh');
    const out = scrub({
      message: 'EPERM C:\\Users\\Binh\\AppData\\Roaming\\Kiemi and C:/Users/Binh/x',
    });
    expect(out.message).toBe('EPERM ~\\AppData\\Roaming\\Kiemi and ~/x');
  });
});
