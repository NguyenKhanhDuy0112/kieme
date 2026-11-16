# PROGRESS

## Trạng thái hiện tại
M0 — Nền móng đang làm. Đã có monorepo (pnpm workspaces + Turborepo + TypeScript strict + Biome + Vitest), package khung `@kiemi/shared`, và `apps/desktop` (Electron 45 + electron-vite 6 + React 19 + Tailwind 4 + shadcn/ui) mở được cửa sổ "Hello Kiemi", IPC renderer ↔ main qua electron-trpc (ADR 0002), i18n vi/en (bản dịch ở `@kiemi/shared`, hook `useT`).

## Tiếp theo
**M0-05** — Tạo `apps/demo-site` (Vite): login 2 vai trò, form validate, bảng phân trang, iframe, popup/confirm, trang giả WebForms ID động, dữ liệu đồng bộ trễ (xem `docs/ROADMAP.md`).

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
