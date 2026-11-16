import { describe, expect, it } from 'vitest';
import {
  ElementSchema,
  FingerprintSchema,
  LOCATOR_STRATEGY_KINDS,
  LocatorSchema,
  LocatorStrategySchema,
  TargetSchema,
} from './locator';

describe('locator strategies [C-01]', () => {
  it('lists kinds in the required priority order', () => {
    expect(LOCATOR_STRATEGY_KINDS).toEqual([
      'role',
      'label',
      'placeholder',
      'text',
      'testId',
      'css',
      'xpath',
    ]);
  });

  it('accepts every strategy kind', () => {
    const all = [
      { kind: 'role', role: 'button', name: 'Lưu' },
      { kind: 'label', value: 'Họ tên' },
      { kind: 'placeholder', value: 'Nhập email' },
      { kind: 'text', value: 'Đăng nhập', exact: true },
      { kind: 'testId', value: 'save-btn' },
      { kind: 'css', value: '#save' },
      { kind: 'xpath', value: '//button' },
    ];
    for (const s of all) expect(LocatorStrategySchema.parse(s)).toEqual(s);
  });

  it('rejects unknown kinds and empty values', () => {
    expect(LocatorStrategySchema.safeParse({ kind: 'magic', value: 'x' }).success).toBe(false);
    expect(LocatorStrategySchema.safeParse({ kind: 'css', value: '' }).success).toBe(false);
    expect(LocatorStrategySchema.safeParse({ kind: 'role' }).success).toBe(false);
  });

  it('keeps strategy order and requires at least one', () => {
    const loc = LocatorSchema.parse({
      strategies: [
        { kind: 'css', value: '#a' },
        { kind: 'role', role: 'button', name: 'A' },
      ],
    });
    expect(loc.strategies.map((s) => s.kind)).toEqual(['css', 'role']);
    expect(LocatorSchema.safeParse({ strategies: [] }).success).toBe(false);
  });
});

describe('fingerprint [C-02]', () => {
  it('defaults attributes and neighbors', () => {
    expect(FingerprintSchema.parse({ tag: 'input' })).toEqual({
      tag: 'input',
      attributes: {},
      neighbors: [],
    });
  });

  it('stores tag, text, attributes, neighbors and box', () => {
    const fp = {
      tag: 'button',
      text: 'Lưu',
      attributes: { id: 'ctl00_Main_btnSave', type: 'submit' },
      neighbors: ['Thông tin đơn'],
      box: { x: 10, y: 20, width: 80, height: 32 },
    };
    expect(FingerprintSchema.parse(fp)).toEqual(fp);
    expect(FingerprintSchema.safeParse({ ...fp, box: { ...fp.box, width: -1 } }).success).toBe(
      false,
    );
  });
});

describe('element & target', () => {
  it('requires a human name on stored elements', () => {
    const strategies = [{ kind: 'text', value: 'Lưu' }];
    expect(ElementSchema.safeParse({ strategies }).success).toBe(false);
    expect(ElementSchema.parse({ name: 'Nút Lưu', strategies }).name).toBe('Nút Lưu');
  });

  it('accepts a ref or an inline locator, not a mix', () => {
    expect(TargetSchema.parse({ ref: 'el_save' })).toEqual({ ref: 'el_save' });
    expect(TargetSchema.safeParse({ strategies: [{ kind: 'css', value: '#a' }] }).success).toBe(
      true,
    );
    expect(
      TargetSchema.safeParse({ ref: 'el_save', strategies: [{ kind: 'css', value: '#a' }] })
        .success,
    ).toBe(false);
    expect(TargetSchema.safeParse({ ref: 'bad ref' }).success).toBe(false);
  });
});
