import { readFile } from 'node:fs/promises';
import { type DemoSite, startDemoSite } from '@kiemi/demo-site/server';
import { DatasetSchema, EnvSchema, parseTestCase, SharedStepSchema } from '@kiemi/schema';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '../actions';
import type { EngineEvent } from '../events';
import { runTestCase } from '../runner';
import { launchTestBrowser } from '../testing/browser';
import { summary } from './helpers';

/**
 * M1-15: the sample multi-session test "A creates → B checks" from a real
 * `.kiemi.json` file, data-driven, with a sync delay between users.
 */
let browser: Browser;
let site: DemoSite;
beforeAll(async () => {
  [browser, site] = await Promise.all([launchTestBrowser(), startDemoSite({ syncDelayMs: 2500 })]);
});
afterAll(async () => {
  await browser?.close();
  await site?.close();
});

const login = SharedStepSchema.parse({
  id: 'login',
  name: 'Đăng nhập',
  params: ['user', 'pass'],
  steps: [
    { id: 'l1', action: 'goto', params: { url: '/login.html' } },
    {
      id: 'l2',
      action: 'fill',
      params: { target: { label: 'Tên đăng nhập' }, value: '{{param.user}}' },
    },
    {
      id: 'l3',
      action: 'fill',
      params: { target: { label: 'Mật khẩu' }, value: '{{param.pass}}' },
    },
    { id: 'l4', action: 'click', params: { target: { role: 'button', name: 'Đăng nhập' } } },
  ],
});

const dataset = DatasetSchema.parse({
  id: 'ds',
  name: 'Đơn nghỉ',
  columns: ['ma', 'loai', 'soNgay'],
  rows: [
    { ma: 'A1', loai: 'Nghỉ phép năm', soNgay: '2' },
    { ma: 'B2', loai: 'Nghỉ ốm', soNgay: '1' },
  ],
});

describe('M1-15 — A tạo → B kiểm tra', () => {
  it('passes for every data row', async () => {
    const json = JSON.parse(
      await readFile(new URL('./fixtures/leave-request.kiemi.json', import.meta.url), 'utf8'),
    ) as unknown;
    const { testCase } = parseTestCase(json);
    const env = EnvSchema.parse({ id: 'demo', name: 'Demo', baseUrl: site.url });
    const registry = createDefaultRegistry();

    for (const [rowIndex] of dataset.rows.entries()) {
      const events: EngineEvent[] = [];
      const r = await runTestCase(
        {
          runId: `leave-${rowIndex}`,
          testCase,
          dataset,
          rowIndex,
          env,
          secrets: { nvUser: 'nhanvien', nvPass: '123456' },
          sharedSteps: [login],
          options: { defaultStepTimeoutMs: 15_000 },
        },
        { registry, browser, onEvent: (e) => events.push(e) },
      );
      expect(
        summary(r).filter((s) => !s.endsWith('passed')),
        `row ${rowIndex}`,
      ).toEqual([]);
      expect(r.status).toBe('passed');
      expect(r.cleanup[0]?.status).toBe('passed');
      // Session label on every step [F-01].
      expect(r.steps.map((s) => s.session)).toEqual([
        ...Array(8).fill('nhanvien'),
        ...Array(8).fill('quanly'),
      ]);
      // Secrets never leak into events.
      expect(JSON.stringify(events)).not.toContain('123456');
    }
  });
});
