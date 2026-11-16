// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createI18n } from '.';
import { useT } from './use-t';

function Probe() {
  const { t, language } = useT();
  return (
    <p>
      {language}|{t('common.run')}|{t('app.version', { version: '1.0.0' })}
    </p>
  );
}

describe('useT / createI18n', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('defaults to Vietnamese with interpolation', () => {
    const i18n = createI18n();
    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByText('vi|Chạy|Phiên bản 1.0.0')).toBeTruthy();
    expect(document.documentElement.lang).toBe('vi');
  });

  it('switches language, updates <html lang> and remembers the choice', async () => {
    const i18n = createI18n();
    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    );
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByText('en|Run|Version 1.0.0')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(createI18n().language).toBe('en');
  });

  it('ignores an unsupported stored language', () => {
    localStorage.setItem('kiemi.language', 'fr');
    expect(createI18n().language).toBe('vi');
  });
});
