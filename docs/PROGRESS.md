# PROGRESS

## Trạng thái hiện tại
M0 — Nền móng đang làm. Đã có monorepo (pnpm workspaces + Turborepo + TypeScript strict + Biome + Vitest), package khung `@kiemi/shared`, và `apps/desktop` (Electron 45 + electron-vite 6 + React 19 + Tailwind 4 + shadcn/ui) mở được cửa sổ "Hello Kiemi", IPC renderer ↔ main qua electron-trpc (ADR 0002), i18n vi/en (bản dịch ở `@kiemi/shared`, hook `useT`).

## Đang làm dở
**M0-05** — `apps/demo-site` (code CHƯA commit, nằm trong working tree; chưa `pnpm install`).
- Đã có:
  - `server/store.ts`: dữ liệu trong bộ nhớ gồm users (`nhanvien`, `nhanvien2`, `quanly`, mật khẩu `123456`), đơn nghỉ có validate, sản phẩm phân trang. Quản lý chỉ thấy đơn sau `syncDelayMs` (mặc định 5000, đổi bằng env `DEMO_SYNC_DELAY_MS`).
  - `server/webforms.ts`: trang `/webforms.aspx` render phía server, ID `ctl00_MainContent_ctlNN_*` đổi mỗi lần tải, có `__VIEWSTATE`, `__doPostBack`, dropdown Tỉnh có AutoPostBack đổi danh sách Quận, nút Lưu, LinkButton "Xóa hết".
  - `server/api.ts`: `/api/login|logout|me|reset|meta|products`, `/api/requests` (GET, POST, DELETE `:id`, POST `:id/approve|reject`), cookie `demo_session`.
  - `server/plugin.ts`: middleware cho cả `vite` dev và `vite preview`.
  - `vite.config.ts`: MPA, cổng 5180 `strictPort`.
  - `public/style.css`, `src/common.ts` (`api`, `$`, `toast`, `initPage` + thanh điều hướng), `index.html` + `src/index.ts`, `login.html` + `src/login.ts`.
- Còn thiếu:
  1. `form.html` + `src/form.ts`: tạo đơn nghỉ gồm dropdown tự làm (div/ul `role=listbox`, `li role=option`) cho Loại nghỉ; `<select>` thường cho Bộ phận; ô Từ ngày dạng `dd/MM/yyyy` kèm nút mở lịch chọn ngày; Số ngày; Lý do (textarea); Ghi chú (contenteditable); checkbox Khẩn cấp; radio Nhận kết quả qua Email/SMS; upload Đính kèm (gửi tên file). Validate phía client và hiện lỗi theo từng ô từ API (422). Thành công → toast "Tạo đơn thành công: DN-xxxx" + phần tử `#ma-don`.
  2. `requests.html` + `src/requests.ts`: bảng đơn; quản lý có nút Duyệt / Từ chối (Từ chối hỏi `confirm`); nút "Tải lại"; trạng thái rỗng.
  3. `table.html` + `src/table.ts`: ô tìm kiếm, chọn số dòng/trang, Trước/Sau + số trang, hiện "Đang tải…".
  4. `iframe.html` → `frames/inner.html` (có ô nhập + nút) → `frames/nested.html` (iframe lồng, có nút + kết quả).
  5. `dialogs.html` + `src/dialogs.ts`: nút alert / confirm / prompt (hiện kết quả ra trang), `window.open('/popup.html')`, link `target=_blank`; `popup.html` có nút Đóng.
  6. Unit test `server/*.test.ts`: store (độ trễ đồng bộ với `now` giả, validate, phân trang), webforms (ID đổi mỗi lần render, postback lưu tên, AutoPostBack đổi quận), api (dựng `http.createServer` thật, login → cookie → tạo đơn → quản lý thấy sau độ trễ).
  7. `pnpm install`, lint/typecheck/test, chạy thử `pnpm --filter @kiemi/demo-site dev`, cập nhật docs, commit `feat(demo-site): … [M0-05]`.

## Tiếp theo
Hoàn thành **M0-05** (mục "Đang làm dở"), sau đó **M0-06** — GitHub Actions lint + typecheck + test trên Windows & macOS.

## Vấn đề tồn đọng / Câu hỏi cho người dùng
- **Phiên bản công cụ** (chốt ở M0-01): Node ≥ 22.12 (`.nvmrc` = 24), pnpm 11.1.3, TypeScript 7.0.2 (bản viết lại bằng Go), Biome 2.6.4, Vitest 5.1, Turbo 2.11. Nếu sau này thư viện nào cần TypeScript compiler API (TS 7 không còn API JS như TS 5) thì cân nhắc thêm `typescript@5`/`6` riêng cho thư viện đó.
- pnpm 11 có `minimumReleaseAge` (chặn gói vừa phát hành quá mới) → khi thêm dependency, chọn bản đã phát hành đủ lâu thay vì thêm `minimumReleaseAgeExclude`.
- Biome không format/lint file `*.md` (docs viết tay, giữ nguyên định dạng bảng).
- Electron 45 **không còn postinstall**: binary tự tải ở lần chạy đầu (`pnpm dev`/`preview`), cache ở `~/Library/Caches/electron`. Không cần `allowBuilds`.
- Preload chạy sandbox nên phải là CommonJS → `apps/desktop/package.json` **không** đặt `"type": "module"`.
- Nếu shell có biến `ELECTRON_RUN_AS_NODE=1` (vd terminal do extension VS Code sinh ra), Electron chạy như Node và app lỗi `app is undefined` → chạy `env -u ELECTRON_RUN_AS_NODE pnpm dev`.
- **Quy ước i18n**: thêm chuỗi vào `packages/shared/src/i18n/locales/vi.ts` trước (nguồn chuẩn), rồi `en.ts` — TypeScript báo lỗi nếu thiếu key; test kiểm tra không rỗng và `{{biến}}` khớp. Gọi `t('nhom.khoa')` qua `useT()` (key có kiểu chặt).
- Ngôn ngữ đang lưu tạm ở `localStorage` (`kiemi.language`) — chuyển sang Cài đặt trong DB ở M3-07 (S-07).

## Nhật ký
| Ngày | Task | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-11-16 | — | Tạo bộ tài liệu dự án | |
| 2026-11-16 | M0-01 | Xong — monorepo, script `lint`/`typecheck`/`test`/`dev`/`build`/`format` | `@kiemi/shared` có `BRAND` + test mẫu; đã kiểm tra lint bắt `any`, typecheck bắt lỗi kiểu |
| 2026-11-16 | M0-02 | Xong — `apps/desktop` (electron-vite, React 19, Tailwind 4, shadcn/ui Button, design tokens màu thương hiệu, font Be Vietnam Pro offline) | Đã chạy thật: cửa sổ "Hello Kiemi", sandbox xác nhận qua CDP (không có `require`/`process` trong renderer); chặn mở cửa sổ mới/điều hướng lạ; CSP chặt |
| 2026-11-16 | M0-03 | Xong — electron-trpc 1.0 + tRPC 11 + TanStack Query; router `app.info`, `app.echo` (Zod) | Chạy thật: renderer hiện version lấy từ main; chỉ có `window.electronTRPC`; `allow` chặn trang lạ (unit test); ADR 0002 |
| 2026-11-16 | M0-04 | Xong — i18next 27 + react-i18next 18; `createI18n`, `useT`, key có kiểu chặt; nút đổi ngôn ngữ tạm trên màn chính | Chạy thật: đổi vi↔en, `<html lang>` cập nhật, nhớ lựa chọn. Thêm happy-dom + Testing Library cho test React |
| 2026-11-16 | — | Đổi workflow: 1 chat = 1 task, kết thúc phiên thì dừng; UI dùng shadcn/ui + Blocks; thêm cách chạy tự động `claude -p` | CLAUDE.md §2, §5.8; START-PROMPT.md |
