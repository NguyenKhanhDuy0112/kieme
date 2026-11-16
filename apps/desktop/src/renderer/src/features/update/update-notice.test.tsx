// @vitest-environment happy-dom
import { createI18n } from '@renderer/i18n';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

const install = vi.fn(async () => true);
const openDownloadPage = vi.fn(async () => true);
vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: {
    updates: {
      events: { subscribe: () => ({ unsubscribe: () => undefined }) },
      check: { mutate: async () => ({ status: 'upToDate' }) },
      install: { mutate: install },
      openDownloadPage: { mutate: openDownloadPage },
    },
  },
}));

const { UpdateNotice } = await import('./update-notice');
const { useUpdateStore } = await import('./update-store');

function renderNotice() {
  const i18n = createI18n();
  return render(
    <I18nextProvider i18n={i18n}>
      <UpdateNotice />
    </I18nextProvider>,
  );
}

afterEach(() => {
  cleanup();
  useUpdateStore.setState({ state: { status: 'off' }, dialogOpen: false });
});

describe('UpdateNotice [N-12]', () => {
  it('shows nothing while there is no new version', () => {
    useUpdateStore.setState({ state: { status: 'upToDate' } });
    renderNotice();
    expect(screen.queryByTestId('update-badge')).toBeNull();
  });

  it('downloaded update: what is new + restart to update', async () => {
    useUpdateStore.setState({
      state: { status: 'ready', version: '1.1.0', notes: '• Thêm bước Chọn ngày' },
      dialogOpen: true,
    });
    renderNotice();
    expect(screen.getByTestId('update-badge').textContent).toContain('Có bản mới 1.1.0');
    expect(screen.getByText('Kiemi 1.1.0 đã sẵn sàng')).toBeTruthy();
    expect(screen.getByText('Có gì mới')).toBeTruthy();
    expect(screen.getByText('• Thêm bước Chọn ngày')).toBeTruthy();
    expect(screen.getByText(/được giữ nguyên/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Khởi động lại để cập nhật/ }));
    });
    expect(install).toHaveBeenCalledOnce();
  });

  it('portable: download the new file instead', async () => {
    useUpdateStore.setState({
      state: { status: 'available', version: '1.1.0', notes: '', url: 'https://x' },
      dialogOpen: true,
    });
    renderNotice();
    expect(screen.getByText(/Bản portable không tự cập nhật/)).toBeTruthy();
    expect(screen.getByText('Bản này sửa lỗi và cải thiện độ ổn định.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Tải bản mới/ }));
    });
    expect(openDownloadPage).toHaveBeenCalledOnce();
  });
});
