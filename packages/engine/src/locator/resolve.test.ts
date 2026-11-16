import type { Locator } from '@kiemi/schema';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EngineError } from '../errors';
import { launchTestBrowser } from '../testing/browser';
import { resolveLocator } from './resolve';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launchTestBrowser();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});
beforeEach(async () => {
  page = await browser.newPage();
  return () => page.close();
});

const opts = { timeoutMs: 1500, pollIntervalMs: 20 };

async function resolveText(loc: Locator, options = opts) {
  const r = await resolveLocator(page, loc, options);
  return { ...r, text: (await r.locator.textContent())?.trim() };
}

async function rejection(loc: Locator, options = { ...opts, timeoutMs: 300 }) {
  const err = await resolveLocator(page, loc, options).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(EngineError);
  return err as EngineError;
}

describe('strategies in priority order [C-01]', () => {
  it('uses the first strategy that matches', async () => {
    await page.setContent(`<button data-testid="save">Lưu</button>`);
    const r = await resolveText({
      strategies: [
        { kind: 'role', role: 'button', name: 'Lưu' },
        { kind: 'testId', value: 'save' },
      ],
    });
    expect(r).toMatchObject({ strategyIndex: 0, text: 'Lưu', matchCount: 1 });
  });

  it('falls back when earlier strategies no longer match', async () => {
    await page.setContent(`<button data-testid="save">Ghi lại</button>`);
    const r = await resolveText({
      strategies: [
        { kind: 'role', role: 'button', name: 'Lưu' },
        { kind: 'text', value: 'Lưu' },
        { kind: 'testId', value: 'save' },
      ],
    });
    expect(r).toMatchObject({ strategyIndex: 2, text: 'Ghi lại' });
  });

  it('supports every strategy kind', async () => {
    await page.setContent(`
      <label for="n">Họ tên</label><input id="n" placeholder="Nhập họ tên" />
      <p>Xin chào</p><span data-testid="tid">T</span><b class="c">C</b><i id="x">X</i>`);
    const cases: [Locator['strategies'][number], string][] = [
      [{ kind: 'role', role: 'textbox', name: 'Họ tên' }, 'n'],
      [{ kind: 'label', value: 'Họ tên' }, 'n'],
      [{ kind: 'placeholder', value: 'Nhập họ tên' }, 'n'],
      [{ kind: 'text', value: 'Xin chào', exact: true }, 'P'],
      [{ kind: 'testId', value: 'tid' }, 'SPAN'],
      [{ kind: 'css', value: 'b.c' }, 'B'],
      [{ kind: 'xpath', value: "//i[@id='x']" }, 'I'],
    ];
    for (const [strategy, expected] of cases) {
      const r = await resolveLocator(page, { strategies: [strategy] }, opts);
      const got = await r.locator.evaluate((el) => (el.id === 'n' ? el.id : el.tagName));
      expect(got, strategy.kind).toBe(expected);
    }
  });

  it('skips a strategy that matches several elements', async () => {
    await page.setContent(`<button>Lưu</button><button id="b2">Lưu</button>`);
    const r = await resolveLocator(
      page,
      {
        strategies: [
          { kind: 'text', value: 'Lưu' },
          { kind: 'css', value: '#b2' },
        ],
      },
      opts,
    );
    expect(r.strategyIndex).toBe(1);
  });

  it('ignores hidden elements by default', async () => {
    await page.setContent(`<button style="display:none">Lưu</button><button>Lưu</button>`);
    const r = await resolveLocator(page, { strategies: [{ kind: 'text', value: 'Lưu' }] }, opts);
    expect(r.matchCount).toBe(1);
    expect(await r.locator.isVisible()).toBe(true);
  });

  it('can include hidden elements with state=attached', async () => {
    await page.setContent(`<input type="file" id="up" style="display:none" />`);
    const r = await resolveLocator(
      page,
      { strategies: [{ kind: 'css', value: '#up' }] },
      { ...opts, state: 'attached' },
    );
    expect(r.matchCount).toBe(1);
  });

  it('waits for elements that appear later', async () => {
    await page.setContent(`<div id="root"></div>
      <script>setTimeout(() => { document.getElementById('root').innerHTML = '<button>Trễ</button>' }, 300)</script>`);
    const r = await resolveText({ strategies: [{ kind: 'role', role: 'button', name: 'Trễ' }] });
    expect(r.text).toBe('Trễ');
  });

  it('survives an invalid selector by trying the next strategy', async () => {
    await page.setContent(`<button id="ok">OK</button>`);
    const r = await resolveLocator(
      page,
      {
        strategies: [
          { kind: 'css', value: '###' },
          { kind: 'css', value: '#ok' },
        ],
      },
      opts,
    );
    expect(r.strategyIndex).toBe(1);
  });
});

describe('errors', () => {
  it('reports ELEMENT_NOT_FOUND after the timeout', async () => {
    await page.setContent(`<p>Trống</p>`);
    const started = Date.now();
    const err = await rejection({ strategies: [{ kind: 'role', role: 'button', name: 'Lưu' }] }, {
      ...opts,
      timeoutMs: 300,
      name: 'Nút Lưu',
    } as typeof opts);
    expect(Date.now() - started).toBeGreaterThanOrEqual(280);
    expect(err.code).toBe('ELEMENT_NOT_FOUND');
    expect(err.details).toMatchObject({
      name: 'Nút Lưu',
      timeoutMs: 300,
      strategy: { kind: 'role', role: 'button', name: 'Lưu' },
    });
  });

  it('reports ELEMENT_AMBIGUOUS when only ambiguous matches exist', async () => {
    await page.setContent(`<button>Xóa</button><button>Xóa</button><button>Xóa</button>`);
    const err = await rejection({ strategies: [{ kind: 'role', role: 'button', name: 'Xóa' }] });
    expect(err.code).toBe('ELEMENT_AMBIGUOUS');
    expect(err.details).toMatchObject({ count: 3 });
  });

  it('stops when the signal is aborted', async () => {
    await page.setContent(`<p>Trống</p>`);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    const err = await rejection({ strategies: [{ kind: 'text', value: 'Không có' }] }, {
      ...opts,
      timeoutMs: 5000,
      signal: ac.signal,
    } as typeof opts);
    expect(err.code).toBe('RUN_CANCELLED');
  });
});

describe('nth match [C-04]', () => {
  beforeEach(async () => {
    await page.setContent(`<ul><li>Một</li><li>Hai</li><li>Ba</li></ul>`);
  });
  const items = (nth: Locator['nth']): Locator => ({
    strategies: [{ kind: 'role', role: 'listitem' }],
    ...(nth === undefined ? {} : { nth }),
  });

  it('picks first, last and the N-th (1-based)', async () => {
    expect((await resolveText(items('first'))).text).toBe('Một');
    expect((await resolveText(items('last'))).text).toBe('Ba');
    expect((await resolveText(items(2))).text).toBe('Hai');
  });

  it('fails when N is beyond the list', async () => {
    expect((await rejection(items(4))).code).toBe('ELEMENT_NOT_FOUND');
  });
});

describe('context scopes [C-03]', () => {
  const table = `
    <table id="t1"><caption>Đơn</caption>
      <tr><td>Nguyễn Văn An</td><td><button>Duyệt</button></td></tr>
      <tr><td>Trần Bình</td><td><button>Duyệt</button></td></tr>
      <tr><td>An</td><td><button>Duyệt</button></td></tr>
    </table>
    <div role="grid"><div role="row"><span>Lê Cường</span><button>Duyệt</button></div></div>`;

  it('finds a button in the row containing a text', async () => {
    await page.setContent(table);
    const r = await resolveLocator(
      page,
      {
        strategies: [{ kind: 'role', role: 'button', name: 'Duyệt' }],
        scope: [{ kind: 'row', text: 'Trần Bình' }],
      },
      opts,
    );
    const row = await r.locator.evaluate((el) => el.closest('tr')?.textContent?.trim());
    expect(row).toContain('Trần Bình');
  });

  it('row text can be exact, and ARIA rows work too', async () => {
    await page.setContent(table);
    const exact = await resolveLocator(
      page,
      {
        strategies: [{ kind: 'role', role: 'button', name: 'Duyệt' }],
        scope: [{ kind: 'row', text: 'An', exact: true }],
      },
      opts,
    );
    expect(await exact.locator.evaluate((el) => el.closest('tr')?.rowIndex)).toBe(2);

    const aria = await resolveLocator(
      page,
      {
        strategies: [{ kind: 'role', role: 'button', name: 'Duyệt' }],
        scope: [{ kind: 'row', text: 'Lê Cường' }],
      },
      opts,
    );
    expect(await aria.locator.evaluate((el) => el.parentElement?.getAttribute('role'))).toBe('row');
  });

  it('a row text matching several rows is ambiguous unless nth is given', async () => {
    await page.setContent(table);
    const loc: Locator = {
      strategies: [{ kind: 'role', role: 'button', name: 'Duyệt' }],
      scope: [{ kind: 'row', text: 'An' }],
    };
    expect((await rejection(loc)).code).toBe('ELEMENT_AMBIGUOUS');
    const r = await resolveLocator(page, { ...loc, nth: 'last' }, opts);
    expect(await r.locator.evaluate((el) => el.closest('tr')?.rowIndex)).toBe(2);
  });

  it('searches within a region, with fallback strategies and nth', async () => {
    await page.setContent(`
      <section aria-label="Khách"><button>Lưu</button></section>
      <section class="box"><button>Lưu</button></section>
      <section class="box"><button id="target">Lưu</button></section>`);
    const r = await resolveLocator(
      page,
      {
        strategies: [{ kind: 'role', role: 'button', name: 'Lưu' }],
        scope: [
          {
            kind: 'within',
            strategies: [
              { kind: 'role', role: 'region', name: 'Không có' },
              { kind: 'css', value: '.box' },
            ],
            nth: 2,
          },
        ],
      },
      opts,
    );
    expect(await r.locator.getAttribute('id')).toBe('target');
  });

  it('reports a missing region', async () => {
    await page.setContent(`<button>Lưu</button>`);
    const err = await rejection({
      strategies: [{ kind: 'role', role: 'button', name: 'Lưu' }],
      scope: [{ kind: 'within', strategies: [{ kind: 'css', value: '#nope' }] }],
    });
    expect(err.code).toBe('ELEMENT_NOT_FOUND');
    expect(err.details).toMatchObject({ scopeMissing: true });
  });

  const grid = `
    <style>body{margin:0} .f{position:absolute;width:120px;height:24px}</style>
    <span class="f" style="left:10px;top:10px">Họ tên</span>
    <input class="f" id="right" style="left:150px;top:10px" />
    <input class="f" id="below" style="left:10px;top:50px" />
    <input class="f" id="far" style="left:10px;top:400px" />
    <input class="f" id="left" style="left:10px;top:200px" />
    <span class="f" style="left:150px;top:200px">Ghi chú</span>`;
  const inputs: Locator['strategies'] = [{ kind: 'css', value: 'input' }];

  it.each([
    ['rightOf', 'Họ tên', 'right'],
    ['below', 'Họ tên', 'below'],
    ['near', 'Họ tên', 'below'],
    ['leftOf', 'Ghi chú', 'left'],
    ['above', 'Ghi chú', 'below'],
  ] as const)('near %s "%s" → #%s', async (position, text, id) => {
    await page.setContent(grid);
    const r = await resolveLocator(
      page,
      { strategies: inputs, scope: [{ kind: 'near', text, position }] },
      opts,
    );
    expect(await r.locator.getAttribute('id')).toBe(id);
  });

  it('nth with near counts from the closest', async () => {
    await page.setContent(grid);
    const r = await resolveLocator(
      page,
      { strategies: inputs, scope: [{ kind: 'near', text: 'Họ tên', position: 'below' }], nth: 2 },
      opts,
    );
    expect(await r.locator.getAttribute('id')).toBe('left');
  });

  it('works inside an iframe root', async () => {
    await page.setContent(
      `<iframe srcdoc="<table><tr><td>X</td><td><button>Mở</button></td></tr></table>"></iframe>`,
    );
    const frame = page.frameLocator('iframe');
    const r = await resolveLocator(
      frame,
      {
        strategies: [{ kind: 'role', role: 'button', name: 'Mở' }],
        scope: [{ kind: 'row', text: 'X' }],
      },
      opts,
    );
    expect(await r.locator.textContent()).toBe('Mở');
  });
});

describe('dynamic ids [C-05]', () => {
  it('matches the stable part when the recorded WebForms id changed', async () => {
    await page.setContent(`<input id="ctl00_MainContent_ctl77_txtHoTen" />`);
    const r = await resolveLocator(
      page,
      { strategies: [{ kind: 'css', value: '#ctl00_MainContent_ctl42_txtHoTen' }] },
      opts,
    );
    expect(r).toMatchObject({ stableId: true, strategyIndex: 0 });
    expect(await r.locator.getAttribute('id')).toBe('ctl00_MainContent_ctl77_txtHoTen');
  });

  it('prefers the exact id when it still exists', async () => {
    await page.setContent(`<input id="ctl00_MainContent_ctl42_txtHoTen" />`);
    const r = await resolveLocator(
      page,
      { strategies: [{ kind: 'css', value: '#ctl00_MainContent_ctl42_txtHoTen' }] },
      opts,
    );
    expect(r.stableId).toBe(false);
  });

  it('does not let the stable part match a different field', async () => {
    await page.setContent(`<input id="ctl00_MainContent_ctl77_txtDiaChi" />`);
    const err = await rejection({
      strategies: [{ kind: 'css', value: '#ctl00_MainContent_ctl42_txtHoTen' }],
    });
    expect(err.code).toBe('ELEMENT_NOT_FOUND');
  });
});
