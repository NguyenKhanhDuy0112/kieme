import { type DemoSite, startDemoSite } from '@kiemi/demo-site/server';
import { createDefaultRegistry, runTestCase } from '@kiemi/engine';
import { type Step, type StepInput, TestCaseSchema } from '@kiemi/schema';
import { type Browser, type BrowserContext, chromium } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type Recorder, startRecorder } from './recorder';

let browser: Browser;
let site: DemoSite;
let context: BrowserContext | undefined;

async function launch(): Promise<Browser> {
  for (const channel of ['chrome', 'msedge', undefined] as const) {
    try {
      return await chromium.launch(channel ? { channel, headless: true } : { headless: true });
    } catch {
      // try the next browser
    }
  }
  throw new Error('No browser available for recorder tests');
}

beforeAll(async () => {
  [browser, site] = await Promise.all([launch(), startDemoSite()]);
});
afterAll(async () => {
  await browser?.close();
  await site?.close();
});
afterEach(async () => {
  await context?.close();
  context = undefined;
});

async function record(path: string, grace?: number): Promise<Recorder> {
  await fetch(`${site.url}/api/reset`, { method: 'POST' });
  context = await browser.newContext();
  return startRecorder(context, {
    startUrl: `${site.url}${path}`,
    baseUrl: site.url,
    ...(grace === undefined ? {} : { navigationGraceMs: grace }),
  });
}

/** Waits until the recorder has `n` steps (events arrive asynchronously). */
async function steps(rec: Recorder, n: number): Promise<Step[]> {
  await expect
    .poll(() => rec.steps.length, { timeout: 5000 })
    .toBe(n)
    .catch((e) => {
      console.log(JSON.stringify(rec.steps, null, 1)); // shows what was recorded
      throw e;
    });
  await new Promise((r) => setTimeout(r, 150)); // let trailing merges land
  expect(rec.steps).toHaveLength(n);
  return rec.steps;
}

const brief = (list: Step[]) =>
  list.map((s) => {
    const { target: _t, ...rest } = s.params;
    return `${s.action} ${JSON.stringify(rest)}`;
  });

/** Replays recorded steps (+ checks) with the engine on a fresh context. */
async function replay(recorded: Step[], checks: StepInput[] = []) {
  await fetch(`${site.url}/api/reset`, { method: 'POST' });
  const testCase = TestCaseSchema.parse({
    schemaVersion: 1,
    id: '0193a5b2-7c4e-7d1a-9f3b-2c8e4a6d1f11',
    name: 'recorded',
    steps: [...recorded, ...checks.map((s, i) => ({ ...s, id: `check${i + 1}` }))],
  });
  const result = await runTestCase(
    {
      runId: `replay-${Date.now()}`,
      testCase,
      env: { id: 'demo', name: 'Demo', baseUrl: site.url, variables: {}, secretNames: [] },
    },
    { registry: createDefaultRegistry(), browser },
  );
  const failed = result.steps
    .map((s, i) => `${i + 1} ${s.status}${s.error ? ` ${s.error.code} ${s.error.message}` : ''}`)
    .filter((s) => !s.includes('passed'));
  expect(failed).toEqual([]);
  expect(result.status).toBe('passed');
}

const check = (action: string, params: Record<string, unknown>): StepInput => ({
  id: 'x',
  action,
  params,
});

describe('recorder [K-01, K-02]', () => {
  it('records typing, choices, ticks and keys on a form and replays them', async () => {
    const rec = await record('/login.html');
    const page = rec.page;
    if (!page) throw new Error('no page');
    await page.locator('#username').pressSequentially('nhanvien');
    await page.locator('#password').pressSequentially('123456');
    await page.locator('#password').press('Enter');
    await page.waitForURL('**/form.html');
    await page.locator('#reason').click();
    await page.locator('#reason').pressSequentially('Đi khám bệnh');
    await page.locator('#days').pressSequentially('3');
    await page.locator('#days').press('Backspace');
    await page.locator('#days').pressSequentially('2');
    // A real choice (type-ahead) — `selectOption` fires untrusted events, which are not recorded.
    await page.locator('#department').focus();
    await page.keyboard.press('k');
    await page.getByText('Khẩn cấp').click();
    await page.getByText('SMS').click();
    await page.locator('#from-date').press('Escape');

    const list = await steps(rec, 10);
    expect(brief(list)).toEqual([
      'goto {"url":"/login.html"}',
      'fill {"value":"nhanvien"}',
      'fill {"value":"123456"}',
      'press {"keys":"Enter"}',
      'fill {"value":"Đi khám bệnh"}',
      'fill {"value":"2"}',
      'select {"by":"label","option":"Kế toán"}',
      'check {"checked":true}',
      'check {"checked":true}',
      'press {"keys":"Escape"}',
    ]);

    await replay(list, [
      check('assertValue', { target: { css: '#reason' }, value: 'Đi khám bệnh' }),
      check('assertValue', { target: { css: '#days' }, value: '2' }),
      check('assertState', { target: { css: '#urgent' }, state: 'checked' }),
      check('assertState', { target: { css: 'input[value=sms]' }, state: 'checked' }),
    ]);
  });

  it('records actions inside nested iframes', async () => {
    const rec = await record('/iframe.html');
    const frame = rec.page?.frameLocator('#outer-frame');
    if (!frame) throw new Error('no page');
    await frame.locator('#inner-name').pressSequentially('An');
    await frame.getByRole('button', { name: 'Chào' }).click();

    const list = await steps(rec, 3);
    expect(brief(list)).toEqual([
      'goto {"url":"/iframe.html"}',
      'fill {"value":"An"}',
      'click {"variant":"single"}',
    ]);
    await replay(list, [
      check('assertText', { target: { css: '#inner-result' }, value: 'Xin chào, An!' }),
    ]);
  });

  it('records a new tab opened by a link and switches to it', async () => {
    const rec = await record('/dialogs.html');
    const page = rec.page;
    if (!page) throw new Error('no page');
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.locator('#link-new-tab').click(),
    ]);
    await popup.waitForLoadState();
    await popup.locator('#popup-note').pressSequentially('ghi chú');

    const list = await steps(rec, 4);
    expect(brief(list)).toEqual([
      'goto {"url":"/dialogs.html"}',
      'click {"variant":"single"}',
      'switchTab {"by":"index","value":"2"}',
      'fill {"value":"ghi chú"}',
    ]);
    await replay(list, [
      check('assertValue', { target: { css: '#popup-note' }, value: 'ghi chú' }),
    ]);
  });

  it('records loads the tester started, but not those caused by a click', async () => {
    const rec = await record('/index.html', 300);
    const page = rec.page;
    if (!page) throw new Error('no page');
    await page.locator('a[href="/login.html"]').first().click();
    await page.waitForURL('**/login.html');
    await new Promise((r) => setTimeout(r, 400));
    await page.goto(`${site.url}/table.html`);
    await new Promise((r) => setTimeout(r, 400));
    await page.reload();
    await page
      .locator('#username')
      .waitFor({ state: 'detached' })
      .catch(() => undefined);

    const list = await steps(rec, 4);
    expect(brief(list)).toEqual([
      'goto {"url":"/index.html"}',
      'click {"variant":"single"}',
      'goto {"url":"/table.html"}',
      'navigate {"to":"reload"}',
    ]);
  });

  it('records a double click as one step and Enter in a field', async () => {
    const rec = await record('/login.html');
    const page = rec.page;
    if (!page) throw new Error('no page');
    await page.locator('h1').dblclick();
    await page.locator('#username').pressSequentially('nhanvien');
    await page.locator('#username').press('Enter');

    const list = await steps(rec, 4);
    expect(brief(list)).toEqual([
      'goto {"url":"/login.html"}',
      'click {"variant":"double"}',
      'fill {"value":"nhanvien"}',
      'press {"keys":"Enter"}',
    ]);
  });

  it('stops recording on stop()', async () => {
    const rec = await record('/login.html');
    await steps(rec, 1);
    await rec.stop();
    await rec.page?.locator('#username').pressSequentially('x');
    await new Promise((r) => setTimeout(r, 300));
    expect(rec.steps).toHaveLength(1);
  });
});
