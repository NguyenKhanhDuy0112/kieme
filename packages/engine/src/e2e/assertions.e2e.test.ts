import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type E2E, startE2E, step, summary } from './helpers';

let e: E2E;
beforeAll(async () => {
  e = await startE2E();
});
afterAll(async () => {
  await e?.close();
});

const html = (body: string) =>
  `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><title>Trang thử</title>${body}`)}`;
const soft = { mode: 'soft' as const, timeoutMs: 1500 };

/** Runs checks expected to pass (`ok`) and to fail (`ko`), on one page. */
async function check(
  url: string,
  ok: Record<string, unknown>[][],
  ko: Record<string, unknown>[][] = [],
) {
  const steps = [
    step('goto', { url }),
    ...ok.map(([a, p]) => step(String(a?.a), p ?? {}, soft)),
    ...ko.map(([a, p]) => step(String(a?.a), p ?? {}, soft)),
  ];
  const r = await e.run(steps);
  const s = summary(r).slice(1);
  expect(
    s.slice(0, ok.length).filter((x) => !x.endsWith('passed')),
    'should pass',
  ).toEqual([]);
  expect(
    s.slice(ok.length).filter((x) => x.includes('passed')),
    'should fail',
  ).toEqual([]);
  return r;
}
const A = (a: string, p: Record<string, unknown>) => [{ a }, p];

describe('assertions [B-01 → B-11]', () => {
  it('visibility and states [B-01, B-02]', async () => {
    await check(
      html(`<button>Hiện</button><button style="display:none">Ẩn</button>
        <input aria-label="Bắt buộc" required><input aria-label="Chỉ đọc" readonly value="x">
        <button disabled>Khóa</button><input type="checkbox" aria-label="Đồng ý" checked>`),
      [
        A('assertVisible', { target: { role: 'button', name: 'Hiện' } }),
        A('assertVisible', { target: { text: 'Ẩn' }, state: 'hidden' }),
        A('assertVisible', { target: { text: 'Không có gì' }, state: 'notExist' }),
        A('assertState', { target: { label: 'Bắt buộc' }, state: 'required' }),
        A('assertState', { target: { label: 'Chỉ đọc' }, state: 'readonly' }),
        A('assertState', { target: { role: 'button', name: 'Khóa' }, state: 'disabled' }),
        A('assertState', { target: { role: 'button', name: 'Hiện' }, state: 'enabled' }),
        A('assertState', { target: { label: 'Đồng ý' }, state: 'checked' }),
        A('assertState', { target: { label: 'Bắt buộc' }, state: 'editable' }),
      ],
      [
        A('assertVisible', { target: { text: 'Ẩn' } }),
        A('assertVisible', { target: { text: 'Ẩn' }, state: 'notExist' }),
        A('assertState', { target: { role: 'button', name: 'Khóa' }, state: 'enabled' }),
      ],
    );
  });

  it('text and values [B-03, B-04]', async () => {
    await check(
      html(`<p id="t">  Xin   chào
        Kiemi  </p><pre id="pre">a   b</pre><input aria-label="Email" value="An@Example.com">`),
      [
        A('assertText', { target: { css: '#t' }, value: 'Xin chào Kiemi' }),
        A('assertText', { target: { css: '#t' }, op: 'contains', value: 'chào' }),
        A('assertText', {
          target: { css: '#t' },
          op: 'startsWith',
          value: 'xin',
          ignoreCase: true,
        }),
        A('assertText', { target: { css: '#t' }, op: 'endsWith', value: 'Kiemi' }),
        A('assertText', { target: { css: '#t' }, op: 'regex', value: 'chào\\s+K' }),
        A('assertText', { target: { css: '#t' }, op: 'notContains', value: 'tạm biệt' }),
        A('assertValue', { target: { label: 'Email' }, value: 'an@example.com', ignoreCase: true }),
        A('assertText', { target: { css: '#pre' }, value: 'a b' }),
      ],
      [
        A('assertText', { target: { css: '#t' }, value: 'Xin chào', normalizeSpace: true }),
        A('assertText', { target: { css: '#pre' }, value: 'a b', normalizeSpace: false }),
        A('assertValue', { target: { label: 'Email' }, value: 'an@example.com' }),
      ],
    );
  });

  it('numbers and dates in local formats [B-05, B-06]', async () => {
    await check(
      html(
        `<p id="tong">Tổng: 1.250.000 đ</p><p id="usd">$1,000.50</p>
        <p id="ngay">Ngày tạo: {{d}}</p>`.replace('{{d}}', new Date().toLocaleDateString('en-GB')),
      ),
      [
        A('assertNumber', { target: { css: '#tong' }, value: 1250000 }),
        A('assertNumber', { target: { css: '#tong' }, op: 'gt', value: '1.000.000' }),
        A('assertNumber', { target: { css: '#usd' }, op: 'between', value: 1000, max: 1001 }),
        A('assertNumber', { actual: '{{2 * 3}}', op: 'lte', value: 6 }),
        A('assertDate', { target: { css: '#ngay' }, op: 'todayPlus', days: 0 }),
        A('assertDate', { target: { css: '#ngay' }, op: 'after', value: '01/01/2020' }),
        A('assertDate', { target: { css: '#ngay' }, op: 'before', value: '{{today + 1d}}' }),
        A('assertDate', { target: { css: '#ngay' }, value: '{{today | yyyy-MM-dd}}' }),
      ],
      [
        A('assertNumber', { target: { css: '#tong' }, op: 'ne', value: 1250000 }),
        A('assertDate', { target: { css: '#ngay' }, op: 'todayPlus', days: 1 }),
      ],
    );
  });

  it('counts, tables, URL and title on the demo site [B-07, B-08, B-09]', async () => {
    await check(
      `/table.html`,
      [
        A('assertCount', { target: { css: '#products-table tbody tr' }, value: 10 }),
        A('assertCount', { target: { role: 'button', name: '1' }, op: 'gte', value: 1 }),
        A('assertTable', {
          target: { css: '#products-table' },
          where: { column: 'Mã', value: 'SP001' },
          column: 'Tên sản phẩm',
          op: 'notEmpty',
        }),
        A('assertUrl', { op: 'contains', value: 'table.html' }),
        A('assertUrl', { value: '/table.html' }),
        A('assertUrl', { op: 'regex', value: 'https?://.+/table\\.html$' }),
        A('assertTitle', { op: 'notEmpty' }),
      ],
      [
        A('assertCount', { target: { css: '#products-table tbody tr' }, op: 'lte', value: 3 }),
        A('assertTable', {
          target: { css: '#products-table' },
          where: { column: 'Mã', value: 'KHONG-CO' },
          column: 'Tên sản phẩm',
          op: 'notEmpty',
        }),
        A('assertTable', {
          target: { css: '#products-table' },
          where: { column: 'Cột lạ', value: 'x' },
          column: 'Tên sản phẩm',
          op: 'notEmpty',
        }),
      ],
    );
  });

  it('toast messages [B-10] and hard vs soft [B-11]', async () => {
    const r = await e.run([
      step('goto', {
        url: html(
          `<button onclick="setTimeout(()=>{const d=document.createElement('div');d.className='toast success';d.textContent='Đã lưu thành công';document.body.append(d)},300)">Lưu</button>`,
        ),
      }),
      step('click', { target: { role: 'button', name: 'Lưu' } }),
      step('assertToast', { text: 'đã lưu', ignoreCase: true }),
      step('assertToast', { text: 'Lỗi' }, soft),
      step('assertTitle', { value: 'Sai' }, { timeoutMs: 1500 }),
      step('assertTitle', { value: 'Trang thử' }),
    ]);
    expect(summary(r)).toEqual([
      '1 passed',
      '2 passed',
      '3 passed',
      '4 failed ASSERTION_FAILED',
      '5 failed ASSERTION_FAILED',
      '6 skipped',
    ]);
    expect(r.steps[3]?.soft).toBe(true);
    expect(r.steps[3]?.error?.details).toMatchObject({
      check: 'toast',
      expected: 'Lỗi',
      actual: 'Đã lưu thành công',
    });
  });
});
