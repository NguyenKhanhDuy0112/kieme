/**
 * A fake ASP.NET WebForms page rendered on the server.
 * - Control IDs contain a random `ctlNN` segment that changes on EVERY render (dynamic IDs, C-05).
 * - Hidden __VIEWSTATE / __EVENTTARGET fields; every action is a full-page POST back (postback).
 * - The "Tỉnh/Thành" dropdown has AutoPostBack: changing it reloads the page with new districts.
 */

const PROVINCES: Record<string, string[]> = {
  HN: ['Ba Đình', 'Hoàn Kiếm', 'Cầu Giấy'],
  HCM: ['Quận 1', 'Quận 3', 'Bình Thạnh'],
  DN: ['Hải Châu', 'Sơn Trà'],
};
const PROVINCE_NAMES: Record<string, string> = {
  HN: 'Hà Nội',
  HCM: 'TP. Hồ Chí Minh',
  DN: 'Đà Nẵng',
};

export interface WebFormsState {
  province: string;
  savedNames: string[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function encodeViewState(state: WebFormsState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
}

export function decodeViewState(raw: string | undefined): WebFormsState {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw ?? '', 'base64').toString('utf8'),
    ) as Partial<WebFormsState>;
    return {
      province:
        typeof parsed.province === 'string' && parsed.province in PROVINCES
          ? parsed.province
          : 'HN',
      savedNames: Array.isArray(parsed.savedNames)
        ? parsed.savedNames.filter((n) => typeof n === 'string')
        : [],
    };
  } catch {
    return { province: 'HN', savedNames: [] };
  }
}

/** Finds a posted field by its stable suffix (the `ctlNN` part is dynamic). */
export function fieldBySuffix(form: Record<string, string>, suffix: string): string | undefined {
  const key = Object.keys(form).find((k) => k.endsWith(`$${suffix}`));
  return key === undefined ? undefined : form[key];
}

export function handleWebForms(
  form: Record<string, string> | null,
  rand: () => number = Math.random,
): string {
  let state = decodeViewState(form?.__VIEWSTATE);
  let message = '';
  let error = '';

  if (form) {
    const target = form.__EVENTTARGET ?? '';
    const name = (fieldBySuffix(form, 'txtHoTen') ?? '').trim();
    const province = fieldBySuffix(form, 'ddlTinh') ?? state.province;
    const district = fieldBySuffix(form, 'ddlQuan') ?? '';
    state = { ...state, province: province in PROVINCES ? province : state.province };

    if (target.endsWith('$ddlTinh')) {
      message = `Đã tải danh sách quận/huyện của ${PROVINCE_NAMES[state.province]}`;
    } else if (target.endsWith('$lnkXoaHet')) {
      state = { ...state, savedNames: [] };
      message = 'Đã xóa toàn bộ danh sách';
    } else if (fieldBySuffix(form, 'btnLuu') !== undefined) {
      if (!name) {
        error = 'Họ tên không được để trống';
      } else {
        const label = `${name} — ${district}, ${PROVINCE_NAMES[state.province]}`;
        state = { ...state, savedNames: [...state.savedNames, label] };
        message = `Đã lưu nhân viên: ${name}`;
      }
    }
  }

  const ctl = `ctl${String(Math.floor(rand() * 90) + 10)}`;
  const id = (s: string) => `ctl00_MainContent_${ctl}_${s}`;
  const nm = (s: string) => `ctl00$MainContent$${ctl}$${s}`;
  const districts = PROVINCES[state.province] ?? [];

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Hồ sơ nhân viên (WebForms)</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
<nav class="topbar"><a href="/">← Trang chủ</a></nav>
<main class="container">
<h1>Hồ sơ nhân viên (WebForms)</h1>
<p class="hint">Trang giả ASP.NET WebForms: ID thay đổi mỗi lần tải, mọi thao tác là postback.</p>
<form method="post" action="/webforms.aspx" id="aspnetForm">
<input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
<input type="hidden" name="__EVENTARGUMENT" id="__EVENTARGUMENT" value="" />
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${encodeViewState(state)}" />
<script>
function __doPostBack(t, a) {
  var f = document.getElementById('aspnetForm');
  document.getElementById('__EVENTTARGET').value = t;
  document.getElementById('__EVENTARGUMENT').value = a || '';
  f.submit();
}
</script>
${message ? `<div id="${id('lblThongBao')}" class="alert success" role="status">${esc(message)}</div>` : ''}
${error ? `<div id="${id('lblLoi')}" class="alert error" role="alert">${esc(error)}</div>` : ''}
<div class="field">
<label for="${id('txtHoTen')}">Họ tên</label>
<input type="text" id="${id('txtHoTen')}" name="${nm('txtHoTen')}" value="" />
</div>
<div class="field">
<label for="${id('ddlTinh')}">Tỉnh/Thành</label>
<select id="${id('ddlTinh')}" name="${nm('ddlTinh')}" onchange="setTimeout(function(){__doPostBack('${nm('ddlTinh')}','')}, 0)">
${Object.entries(PROVINCE_NAMES)
  .map(
    ([v, l]) => `<option value="${v}"${v === state.province ? ' selected' : ''}>${esc(l)}</option>`,
  )
  .join('\n')}
</select>
</div>
<div class="field">
<label for="${id('ddlQuan')}">Quận/Huyện</label>
<select id="${id('ddlQuan')}" name="${nm('ddlQuan')}">
${districts.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('\n')}
</select>
</div>
<div class="actions">
<input type="submit" id="${id('btnLuu')}" name="${nm('btnLuu')}" value="Lưu" class="btn primary" />
<a id="${id('lnkXoaHet')}" href="javascript:__doPostBack('${nm('lnkXoaHet')}','')">Xóa hết</a>
</div>
<h2>Đã lưu</h2>
<table id="${id('gvNhanVien')}" class="table">
<thead><tr><th>STT</th><th>Nhân viên</th></tr></thead>
<tbody>
${
  state.savedNames.length
    ? state.savedNames.map((n, i) => `<tr><td>${i + 1}</td><td>${esc(n)}</td></tr>`).join('\n')
    : '<tr><td colspan="2" class="empty">Chưa có dữ liệu</td></tr>'
}
</tbody>
</table>
</form>
</main>
</body>
</html>`;
}
