// @vitest-environment happy-dom
import { createI18n } from '@renderer/i18n';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from './schema-form';
import {
  AdvancedModeContext,
  blankStrategy,
  moveItem,
  strategyProblem,
  strategyText,
  targetKindsFor,
} from './strategies';
import { StrategiesEditor } from './strategies-editor';

describe('strategy helpers [C-07]', () => {
  it('moves items and keeps the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('keeps the value when the kind changes', () => {
    expect(blankStrategy('css', { kind: 'text', value: 'Lưu' })).toEqual({
      kind: 'css',
      value: 'Lưu',
    });
    expect(blankStrategy('role', { kind: 'text', value: 'Lưu' })).toEqual({
      kind: 'role',
      role: 'button',
      name: 'Lưu',
    });
    expect(blankStrategy('xpath', { kind: 'role', role: 'button' })).toEqual({
      kind: 'xpath',
      value: '',
    });
  });

  it('flags empty and broken hand-written values', () => {
    expect(strategyProblem({ kind: 'css', value: ' ' })).toBe('empty');
    expect(strategyProblem({ kind: 'css', value: '#save' })).toBeNull();
    expect(strategyProblem({ kind: 'css', value: 'div[' })).toBe('badCss');
    expect(strategyProblem({ kind: 'css', value: '{{sel}}' })).toBeNull();
    expect(strategyProblem({ kind: 'xpath', value: '//button[text()="Lưu"]' })).toBeNull();
    expect(strategyProblem({ kind: 'xpath', value: 'button' })).toBe('badXpath');
    expect(strategyProblem({ kind: 'role', role: 'button' })).toBeNull();
  });

  it('describes strategies technically', () => {
    expect(strategyText({ kind: 'role', role: 'button', name: 'Lưu' })).toBe('role: button "Lưu"');
    expect(strategyText({ kind: 'css', value: '#a' })).toBe('css: #a');
  });

  it('offers technical ways only in advanced mode (U-05)', () => {
    expect(targetKindsFor('text', false, false)).toEqual(['text', 'label', 'placeholder', 'role']);
    expect(targetKindsFor('text', true, true)).toEqual([
      'ref',
      'text',
      'label',
      'placeholder',
      'role',
      'testId',
      'css',
      'locator',
    ]);
    // a CSS target written earlier stays selectable
    expect(targetKindsFor('css', false, false)).toContain('css');
  });
});

const wrap = (ui: ReactNode, advanced: boolean) => (
  <I18nextProvider i18n={createI18n()}>
    <AdvancedModeContext.Provider value={advanced}>{ui}</AdvancedModeContext.Provider>
  </I18nextProvider>
);

describe('StrategiesEditor [C-07]', () => {
  afterEach(cleanup);

  it('edits, reorders, adds and removes ways to find', () => {
    const onChange = vi.fn();
    render(
      wrap(
        <StrategiesEditor
          value={[
            { kind: 'role', role: 'button', name: 'Lưu' },
            { kind: 'css', value: '#save' },
          ]}
          onChange={onChange}
        />,
        true,
      ),
    );
    const css = screen.getByDisplayValue('#save');
    fireEvent.change(css, { target: { value: '#luu' } });
    expect(onChange).toHaveBeenLastCalledWith([
      { kind: 'role', role: 'button', name: 'Lưu' },
      { kind: 'css', value: '#luu' },
    ]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Lên trên' })[1] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith([
      { kind: 'css', value: '#save' },
      { kind: 'role', role: 'button', name: 'Lưu' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm cách tìm' }));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa cách tìm' })[0] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'css', value: '#save' }]);
  });

  it('warns about a broken CSS value and keeps at least one way', () => {
    render(
      wrap(<StrategiesEditor value={[{ kind: 'css', value: 'div[' }]} onChange={() => {}} />, true),
    );
    expect(screen.getByText('CSS chưa đúng cú pháp')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Phải còn ít nhất 1 cách tìm' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe('element field in the step form', () => {
  afterEach(cleanup);
  const schema = {
    type: 'object',
    properties: { target: { type: 'object' } },
    required: ['target'],
  };

  it('hides selectors in normal mode, shows them in advanced mode', async () => {
    const value = { target: { strategies: [{ kind: 'css', value: '#ma-don' }] } };
    const { unmount } = render(
      wrap(
        <SchemaForm
          schema={schema}
          rawParams={[]}
          value={value}
          elements={{}}
          onChange={() => {}}
        />,
        false,
      ),
    );
    expect(screen.queryByDisplayValue('#ma-don')).toBeNull();
    expect(screen.getByText('1 cách tìm')).toBeTruthy();
    unmount();
    await act(async () => {
      render(
        wrap(
          <SchemaForm
            schema={schema}
            rawParams={[]}
            value={value}
            elements={{}}
            onChange={() => {}}
          />,
          true,
        ),
      );
    });
    expect(screen.getByDisplayValue('#ma-don')).toBeTruthy();
  });
});
