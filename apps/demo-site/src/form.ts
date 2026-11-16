import { $, api, initPage, toast } from './common';

type Field = 'type' | 'fromDate' | 'days' | 'reason';
type Errors = { [K in Field]?: string | undefined };

const LEAVE_TYPES: Record<string, string> = {
  'phep-nam': 'Nghỉ phép năm',
  om: 'Nghỉ ốm',
  'khong-luong': 'Nghỉ không lương',
};

void initPage({ requireLogin: true });

const form = $<HTMLFormElement>('#leave-form');
const formError = $('#form-error');

// ---------- custom dropdown (div/ul role=listbox) ----------
const trigger = $<HTMLButtonElement>('#type-trigger');
const listbox = $<HTMLUListElement>('#type-listbox');
let selectedType = '';

listbox.innerHTML = Object.entries(LEAVE_TYPES)
  .map(([v, l]) => `<li role="option" data-value="${v}" aria-selected="false">${l}</li>`)
  .join('');

function setMenu(open: boolean): void {
  listbox.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
}
trigger.addEventListener('click', () => setMenu(listbox.hidden === true));
listbox.addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLLIElement>('li[role=option]');
  if (!li) return;
  selectedType = li.dataset.value ?? '';
  trigger.textContent = li.textContent;
  for (const o of listbox.querySelectorAll('li')) o.setAttribute('aria-selected', String(o === li));
  setMenu(false);
  showErrors({ ...currentErrors, type: undefined });
});
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#type-dropdown')) setMenu(false);
});

// ---------- date input dd/MM/yyyy + calendar ----------
const dateInput = $<HTMLInputElement>('#from-date');
const calendar = $('#calendar');
let calMonth = new Date();

const pad = (n: number) => String(n).padStart(2, '0');

function parseVnDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function renderCalendar(): void {
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const head = `<div class="cal-head">
    <button type="button" class="btn" data-nav="-1" aria-label="Tháng trước">‹</button>
    <strong>Tháng ${m + 1}/${y}</strong>
    <button type="button" class="btn" data-nav="1" aria-label="Tháng sau">›</button></div>`;
  const blanks = '<span></span>'.repeat(offset);
  const days = Array.from(
    { length: daysInMonth },
    (_, i) =>
      `<button type="button" class="day" data-day="${i + 1}" aria-label="${pad(i + 1)}/${pad(m + 1)}/${y}">${i + 1}</button>`,
  ).join('');
  calendar.innerHTML = head + blanks + days;
}

$('#open-calendar').addEventListener('click', () => {
  const iso = parseVnDate(dateInput.value);
  calMonth = iso ? new Date(`${iso}T00:00:00`) : new Date();
  renderCalendar();
  calendar.hidden = !calendar.hidden;
});
calendar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  if (btn.dataset.nav) {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(btn.dataset.nav), 1);
    renderCalendar();
    return;
  }
  if (btn.dataset.day) {
    dateInput.value = `${pad(Number(btn.dataset.day))}/${pad(calMonth.getMonth() + 1)}/${calMonth.getFullYear()}`;
    calendar.hidden = true;
    showErrors({ ...currentErrors, fromDate: undefined });
  }
});

// ---------- validation ----------
let currentErrors: Errors = {};

function showErrors(errors: Errors): void {
  currentErrors = errors;
  for (const el of form.querySelectorAll<HTMLElement>('[data-error-for]')) {
    const field = el.dataset.errorFor as Field;
    el.textContent = errors[field] ?? '';
  }
  const inputs: Record<Field, HTMLElement> = {
    type: trigger,
    fromDate: dateInput,
    days: $('#days'),
    reason: $('#reason'),
  };
  for (const [field, el] of Object.entries(inputs) as [Field, HTMLElement][]) {
    el.classList.toggle('invalid', Boolean(errors[field]));
    el.setAttribute('aria-invalid', String(Boolean(errors[field])));
  }
}

function clientValidate(): Errors {
  const errors: Errors = {};
  if (!selectedType) errors.type = 'Vui lòng chọn loại nghỉ';
  if (!dateInput.value.trim()) errors.fromDate = 'Vui lòng chọn ngày bắt đầu';
  else if (!parseVnDate(dateInput.value)) errors.fromDate = 'Ngày không hợp lệ (dd/MM/yyyy)';
  const days = $<HTMLInputElement>('#days').value;
  if (!days) errors.days = 'Vui lòng nhập số ngày';
  const reason = $<HTMLTextAreaElement>('#reason').value.trim();
  if (!reason) errors.reason = 'Vui lòng nhập lý do';
  return errors;
}

form.addEventListener('reset', () => {
  selectedType = '';
  trigger.textContent = '-- Chọn loại nghỉ --';
  $('#note').textContent = '';
  showErrors({});
  formError.hidden = true;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const errors = clientValidate();
  showErrors(errors);
  if (Object.keys(errors).length > 0) return;

  const submit = $<HTMLButtonElement>('#submit');
  submit.disabled = true;
  const file = $<HTMLInputElement>('#attachment').files?.[0];
  const body = {
    type: selectedType,
    department: $<HTMLSelectElement>('#department').value,
    fromDate: parseVnDate(dateInput.value),
    days: $<HTMLInputElement>('#days').value,
    reason: $<HTMLTextAreaElement>('#reason').value,
    note: $('#note').textContent ?? '',
    urgent: $<HTMLInputElement>('#urgent').checked,
    notify: form.querySelector<HTMLInputElement>('input[name=notify]:checked')?.value ?? 'email',
    attachment: file?.name ?? null,
  };
  const { status, data } = await api<{
    request?: { code: string };
    errors?: Errors;
    error?: string;
  }>('/api/requests', { method: 'POST', body: JSON.stringify(body) });
  submit.disabled = false;
  if (status === 422 && data.errors) {
    showErrors(data.errors);
    return;
  }
  if (status !== 201 || !data.request) {
    formError.textContent = data.error ?? 'Không tạo được đơn';
    formError.hidden = false;
    return;
  }
  toast(`Tạo đơn thành công: ${data.request.code}`);
  $('#ma-don').textContent = data.request.code;
  $('#result').hidden = false;
  form.reset();
});
