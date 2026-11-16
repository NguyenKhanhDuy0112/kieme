import { $, api, escapeHtml, initPage, type Me, toast } from './common';

interface LeaveRequest {
  id: string;
  code: string;
  owner: string;
  type: string;
  fromDate: string;
  days: number;
  reason: string;
  urgent: boolean;
  status: 'cho-duyet' | 'da-duyet' | 'tu-choi';
}

const STATUS_LABEL: Record<LeaveRequest['status'], string> = {
  'cho-duyet': 'Chờ duyệt',
  'da-duyet': 'Đã duyệt',
  'tu-choi': 'Từ chối',
};

const tbody = $('#requests-table tbody');
const loading = $('#loading');
let me: Me | null = null;
let leaveTypes: Record<string, string> = {};

const vnDate = (iso: string) => iso.split('-').reverse().join('/');

async function load(): Promise<void> {
  loading.hidden = false;
  const { data } = await api<{ items?: LeaveRequest[] }>('/api/requests');
  loading.hidden = true;
  const items = data.items ?? [];
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Chưa có đơn nào</td></tr>';
    return;
  }
  tbody.innerHTML = items
    .map(
      (r) => `<tr data-code="${r.code}">
        <td>${r.code}${r.urgent ? ' <span class="badge tu-choi">Khẩn</span>' : ''}</td>
        <td>${escapeHtml(r.owner)}</td>
        <td>${escapeHtml(leaveTypes[r.type] ?? r.type)}</td>
        <td>${vnDate(r.fromDate)}</td>
        <td>${r.days}</td>
        <td>${escapeHtml(r.reason)}</td>
        <td><span class="badge ${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td>${
          me?.role === 'quanly' && r.status === 'cho-duyet'
            ? `<button type="button" class="btn primary" data-act="approve" data-id="${r.id}">Duyệt</button>
               <button type="button" class="btn danger" data-act="reject" data-id="${r.id}">Từ chối</button>`
            : ''
        }</td>
      </tr>`,
    )
    .join('');
}

tbody.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn?.dataset.id) return;
  const act = btn.dataset.act;
  const code = btn.closest('tr')?.dataset.code ?? '';
  if (act === 'reject' && !confirm(`Bạn có chắc muốn từ chối đơn ${code}?`)) return;
  const { status } = await api(`/api/requests/${encodeURIComponent(btn.dataset.id)}/${act}`, {
    method: 'POST',
  });
  if (status === 200) toast(act === 'approve' ? `Đã duyệt đơn ${code}` : `Đã từ chối đơn ${code}`);
  else toast('Thao tác thất bại', 'error');
  await load();
});

$('#reload').addEventListener('click', () => void load());

void (async () => {
  me = await initPage({ requireLogin: true });
  if (!me) return;
  const meta = await api<{ leaveTypes: Record<string, string>; syncDelayMs: number }>('/api/meta');
  leaveTypes = meta.data.leaveTypes;
  if (me.role === 'quanly') {
    const hint = $('#sync-hint');
    hint.textContent = `Đơn mới cần khoảng ${Math.round(meta.data.syncDelayMs / 1000)} giây để đồng bộ. Bấm "Tải lại" để cập nhật.`;
    hint.hidden = false;
  }
  await load();
})();
