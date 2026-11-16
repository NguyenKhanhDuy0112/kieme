import { $, api, initPage, type Me } from './common';

void initPage();

const form = $<HTMLFormElement>('#login-form');
const errorBox = $('#login-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $<HTMLInputElement>('#username').value.trim();
  const password = $<HTMLInputElement>('#password').value;
  if (!username || !password) {
    errorBox.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
    errorBox.hidden = false;
    return;
  }
  const { status, data } = await api<{ user?: Me; error?: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (status !== 200 || !data.user) {
    errorBox.textContent = data.error ?? 'Đăng nhập thất bại';
    errorBox.hidden = false;
    return;
  }
  const next = new URLSearchParams(location.search).get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : null;
  location.href = safeNext ?? (data.user.role === 'quanly' ? '/requests.html' : '/form.html');
});
