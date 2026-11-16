import { $, api, escapeHtml, initPage } from './common';

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}
interface PageResult {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

void initPage();

const tbody = $('#products-table tbody');
const loading = $('#loading');
const search = $<HTMLInputElement>('#search');
const pageSize = $<HTMLSelectElement>('#page-size');
const prev = $<HTMLButtonElement>('#prev');
const next = $<HTMLButtonElement>('#next');
const pages = $('#pages');
let page = 1;
let totalPages = 1;
let requestId = 0;

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

async function load(): Promise<void> {
  const id = ++requestId;
  loading.hidden = false;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: pageSize.value,
    q: search.value,
  });
  const { data } = await api<PageResult>(`/api/products?${params}`);
  if (id !== requestId) return; // a newer request superseded this one
  loading.hidden = true;
  page = data.page;
  totalPages = data.totalPages;
  tbody.innerHTML = data.items.length
    ? data.items
        .map(
          (
            p,
          ) => `<tr><td>${p.sku}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td>
            <td>${money.format(p.price)}</td><td>${p.stock}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty">Không có sản phẩm phù hợp</td></tr>';
  pages.innerHTML = Array.from(
    { length: totalPages },
    (_, i) =>
      `<button type="button" class="btn" data-page="${i + 1}"${i + 1 === page ? ' aria-current="page"' : ''}>${i + 1}</button>`,
  ).join(' ');
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
  $('#summary').textContent = `Trang ${page}/${totalPages} — ${data.total} sản phẩm`;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
search.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    page = 1;
    void load();
  }, 300);
});
pageSize.addEventListener('change', () => {
  page = 1;
  void load();
});
prev.addEventListener('click', () => {
  page -= 1;
  void load();
});
next.addEventListener('click', () => {
  page += 1;
  void load();
});
pages.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-page]');
  if (!btn) return;
  page = Number(btn.dataset.page);
  void load();
});

void load();
