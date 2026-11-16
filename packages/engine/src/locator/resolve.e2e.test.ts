import { type DemoServer, startDemoServer } from '@kiemi/demo-site/server';
import type { Locator, LocatorScope } from '@kiemi/schema';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchTestBrowser } from '../testing/browser';
import { resolveLocator } from './resolve';

/** e2e on the demo-site WebForms page: ids change on every load and every postback. */
let browser: Browser;
let server: DemoServer;
let page: Page;

beforeAll(async () => {
  [browser, server] = await Promise.all([launchTestBrowser(), startDemoServer()]);
  page = await browser.newPage();
}, 60_000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const opts = { timeoutMs: 3000, pollIntervalMs: 50 };

describe('demo-site WebForms [C-01, C-03, C-04, C-05]', () => {
  it('finds fields by recorded dynamic ids across postbacks and saves a row', async () => {
    await page.goto(`${server.url}/webforms.aspx`);
    // Simulate a recording: take the ids as they were on this load.
    const recordedName = await page.locator('input[type=text]').getAttribute('id');
    const recordedSave = await page.locator('input[type=submit]').getAttribute('name');
    expect(recordedName).toMatch(/^ctl00_MainContent_ctl\d+_txtHoTen$/);

    const nameField: Locator = {
      strategies: [
        { kind: 'css', value: `#${recordedName}` },
        { kind: 'label', value: 'Họ tên' },
      ],
    };
    const saveButton: Locator = {
      strategies: [{ kind: 'css', value: `input[name="${recordedSave}"]` }],
    };

    const ids = new Set([recordedName]);
    for (const person of ['Phạm Hoa', 'Lê Minh', 'Trần Nam']) {
      // Each postback re-renders with a new random `ctlNN`.
      const field = await resolveLocator(page, nameField, opts);
      expect(field.strategyIndex).toBe(0);
      await field.locator.fill(person);
      const save = await resolveLocator(page, saveButton, opts);
      await Promise.all([page.waitForURL('**/webforms.aspx'), save.locator.click()]);
      await expect.poll(() => page.locator('[role=status]').textContent()).toContain(person);
      ids.add(await page.locator('input[type=text]').getAttribute('id'));
    }
    // ids really changed between loads (random ctlNN; 4 loads, same id 4 times is ~1e-6).
    expect(ids.size).toBeGreaterThan(1);
  });

  it('locates saved rows by context and position', async () => {
    const rowCell = (scope: Locator['scope'], nth?: Locator['nth']): Locator => ({
      strategies: [{ kind: 'role', role: 'cell' }],
      scope,
      nth: nth ?? 'first',
    });
    const grid: LocatorScope = {
      kind: 'within',
      strategies: [{ kind: 'css', value: '[id$="_gvNhanVien"]' }],
    };

    const lm = await resolveLocator(page, rowCell([grid, { kind: 'row', text: 'Lê Minh' }]), opts);
    expect(await lm.locator.textContent()).toBe('2');

    const last = await resolveLocator(
      page,
      { strategies: [{ kind: 'role', role: 'row' }], scope: [grid], nth: 'last' },
      opts,
    );
    expect(await last.locator.textContent()).toContain('Trần Nam');

    const label = await resolveLocator(
      page,
      {
        strategies: [{ kind: 'role', role: 'combobox' }],
        scope: [{ kind: 'near', text: 'Tỉnh/Thành', position: 'below' }],
      },
      opts,
    );
    expect(await label.locator.getAttribute('id')).toMatch(/_ddlTinh$/);
  });
});
