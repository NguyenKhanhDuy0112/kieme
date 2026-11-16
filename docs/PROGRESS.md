# PROGRESS

## Trạng thái hiện tại
M0 — Nền móng **xong**. M1 — Schema & Engine lõi **xong** (M1-01 → M1-15). M2 — Lưu trữ **xong** (M2-01 → M2-05, `@kiemi/db`). Đã có monorepo (pnpm workspaces + Turborepo + TypeScript strict + Biome + Vitest), package khung `@kiemi/shared`, và `apps/desktop` (Electron 45 + electron-vite 6 + React 19 + Tailwind 4 + shadcn/ui) mở được cửa sổ "Hello Kiemi", IPC renderer ↔ main qua electron-trpc (ADR 0002), i18n vi/en (bản dịch ở `@kiemi/shared`, hook `useT`), `apps/demo-site` (web mục tiêu cho e2e engine, cổng 5180), và CI GitHub Actions (lint + typecheck + test trên Windows & macOS).

## Đang làm dở
(không có)

## Tiếp theo
**M3-01** — Layout app, điều hướng, trang chủ danh sách [S-01].

## Vấn đề tồn đọng / Câu hỏi cho người dùng
- **Dữ liệu** (ADR 0008): `@kiemi/db` — `openDatabase({ path })` (migrate), `ensureDefaultWorkspace`, `createServices(ctx, cipher)` → `projects, folders, testCases, suites, sharedSteps, elements, environments, datasets`; `exportTestCase / importTestCase / exportBundle / importBundle`. tRPC: `projects.*`, `folders.*`, `testCases.*`, `suites.*`, `sharedSteps.*`, `elements.*`, `environments.*` (secret chỉ trả tên), `datasets.*` (`importFile` base64), `io.*`. Lỗi có `error.data.kiemiCode`. Test: `createMemoryServices()`. Thêm bảng/cột = migration mới trong `migrations.ts` (test đối chiếu Drizzle).
- Chuỗi tiếng Việt cho mã lỗi `DbError` chưa có — thêm khi làm UI M3 (cùng chỗ với `errors.codes`).
- **Engine runtime** (ADR 0007): `createDefaultRegistry()` có mọi action v1 + `assertX`. `runTestCase(request, { registry, browser, onEvent, signal })`; `RunRequest` nhận `env`, `secrets`, `dataset`+`rowIndex`, `sharedSteps`, `suiteVariables`, `options { defaultStepTimeoutMs, viewport, failOnConsoleError, failOnHttpError, artifacts {dir, screenshots, video, trace}, filesDir }`. Lỗi → `describeRunError(error, t)` ở `@kiemi/shared`. Kịch bản mẫu M1-15: `packages/engine/src/e2e/fixtures/leave-request.kiemi.json`.
- Chưa làm (để sau, không chặn M2): bước "Chọn ngày" chỉ gõ trực tiếp (chưa bấm trên lịch); dropdown tự làm tìm option theo `role=option`/`li`/`data-value`.
- **Trình duyệt** (ADR 0006): `launchBrowser({ settings, browsersPath, onDownloadProgress })` → Edge/Chrome có sẵn hoặc tải Chromium vào `browsersPath`. Runner nhận `browser` đã launch; action lấy `await ctx.page()` / `ctx.context()` (mỗi session 1 context, tạo khi cần, đóng sau cleanup). Màn hình: `options.viewport = { device?, viewport? }`. Proxy lấy từ `request.env.proxy` (+ secret mật khẩu). Test có proxy HTTP/SOCKS5 giả ở `src/testing/proxies.ts`.
- **Locator** (ADR 0005): `resolveLocator(root, locator, { timeoutMs, signal, state })` → Playwright locator đã ghim 1 phần tử. `Locator` có thêm `scope` (`within`/`row`/`near`) và `nth` (`first`/`last`/số từ 1) — vẫn schema v1 (thêm trường tùy chọn, chưa phát hành). Mã lỗi `ELEMENT_NOT_FOUND`/`ELEMENT_AMBIGUOUS`. Test engine cần Chrome/Edge (`launchTestBrowser`); e2e dùng `startDemoServer()` từ `@kiemi/demo-site/server` (chỉ trang server-render như `/webforms.aspx`, chưa có trang Vite).
- **Engine** (`@kiemi/engine`, ADR 0004): `runTestCase(request, { registry, onEvent, signal })`. Đã có `playwright-core` 1.64.1; `ActionContext` có `page()`/`context()` (M1-04). Lỗi engine có `code` + `details`; UI phải dịch theo mã (chưa có chuỗi i18n cho lỗi). Timeout mặc định 10 giây.
- **Schema DSL** (`@kiemi/schema`, ADR 0003): `parseTestCase(json)` = migrate + validate. `Step.params` để mở — action tự validate (M1-02). Đổi schema → làm theo mục "Hệ quả" ADR 0003; JSON Schema cập nhật bằng `pnpm --filter @kiemi/schema test -u`.
- **Phiên bản công cụ** (chốt ở M0-01): Node ≥ 22.12 (`.nvmrc` = 24), pnpm 11.1.3, TypeScript 7.0.2 (bản viết lại bằng Go), Biome 2.6.4, Vitest 5.1, Turbo 2.11. Nếu sau này thư viện nào cần TypeScript compiler API (TS 7 không còn API JS như TS 5) thì cân nhắc thêm `typescript@5`/`6` riêng cho thư viện đó.
- pnpm 11 có `minimumReleaseAge` (chặn gói vừa phát hành quá mới) → khi thêm dependency, chọn bản đã phát hành đủ lâu thay vì thêm `minimumReleaseAgeExclude`.
- Biome không format/lint file `*.md` (docs viết tay, giữ nguyên định dạng bảng).
- Electron 45 **không còn postinstall**: binary tự tải ở lần chạy đầu (`pnpm dev`/`preview`), cache ở `~/Library/Caches/electron`. Không cần `allowBuilds`.
- Preload chạy sandbox nên phải là CommonJS → `apps/desktop/package.json` **không** đặt `"type": "module"`.
- Nếu shell có biến `ELECTRON_RUN_AS_NODE=1` (vd terminal do extension VS Code sinh ra), Electron chạy như Node và app lỗi `app is undefined` → chạy `env -u ELECTRON_RUN_AS_NODE pnpm dev`.
- **Quy ước i18n**: thêm chuỗi vào `packages/shared/src/i18n/locales/vi.ts` trước (nguồn chuẩn), rồi `en.ts` — TypeScript báo lỗi nếu thiếu key; test kiểm tra không rỗng và `{{biến}}` khớp. Gọi `t('nhom.khoa')` qua `useT()` (key có kiểu chặt).
- **Demo-site** (`pnpm --filter @kiemi/demo-site dev`, http://localhost:5180): dữ liệu trong bộ nhớ, dùng chung giữa mọi browser context; `POST /api/reset` để xóa sạch trước mỗi e2e. Độ trễ đồng bộ đổi bằng `DEMO_SYNC_DELAY_MS` (e2e nên đặt nhỏ). Biome tắt nhóm luật a11y cho `apps/demo-site/**/*.html` vì trang cố tình có phần tử không chuẩn (dropdown tự làm, contenteditable).
- **CI** (`.github/workflows/ci.yml`): chạy khi push `main`, PR, hoặc bấm tay; ma trận `windows-latest` + `macos-latest`, Node theo `.nvmrc`, pnpm theo `packageManager`. `.gitattributes` ép LF để Biome không lỗi CRLF trên Windows. Máy chưa có `gh` CLI — xem kết quả run qua trang Actions hoặc GitHub API.
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
| 2026-11-16 | M0-05 | Xong — `apps/demo-site` (Vite MPA): login 2 vai trò, form đơn nghỉ (dropdown tự làm, lịch dd/MM/yyyy, contenteditable, upload, lỗi theo ô), danh sách đơn (duyệt/từ chối + confirm, đồng bộ trễ), bảng phân trang + tìm kiếm, iframe lồng 2 lớp, alert/confirm/prompt/popup/tab mới, WebForms ID động + postback | 18 unit test server (store, webforms, api qua HTTP thật). Chạy thử dev server: mọi trang 200, quản lý thấy đơn sau độ trễ; Chrome headless xác nhận JS client render |
| 2026-11-16 | M0-06 | Xong — workflow CI `lint`/`typecheck`/`test` trên Windows & macOS; `.gitattributes` (LF) | Run đầu tiên pass cả 2 OS (actions/runs/43815029737) |
| 2026-11-16 | M1-01 | Xong — `@kiemi/schema`: Locator (7 chiến lược theo thứ tự C-01) + Fingerprint, Element/Target, Step, TestCase v1, Dataset/nguồn dữ liệu, Env/Secrets, RunResult; framework migration + fixture v1; JSON Schema commit sẵn | 35 unit test; ADR 0003 |
| 2026-11-16 | M1-02 | Xong — `@kiemi/engine`: `defineAction` + `ActionRegistry` (validate params bằng Zod), `runTestCase` tuần tự, event `runStart/stepStart/log/stepEnd/runEnd`, timeout từng step + mặc định, soft/hard, bỏ step tắt, cleanup luôn chạy, hủy run | 14 unit test; ADR 0004 |
| 2026-11-16 | M1-03 | Xong — `resolveLocator`: thử chiến lược theo thứ tự, chờ phần tử xuất hiện, bỏ qua kết quả mơ hồ, scope `within`/`row`/`near`, `nth`, ID động (`ctl00_…`, ID ngẫu nhiên → khớp phần ổn định), hỗ trợ iframe | 36 test mới (unit stable-id + trình duyệt thật + e2e WebForms demo-site); ADR 0005 |
| 2026-11-16 | M1-04 | Xong — phát hiện Edge/Chrome theo OS, `launchBrowser` (auto/chọn trình duyệt, headless/headed, slowMo), tải Chromium có tiến trình, context riêng theo session, viewport + giả lập mobile | 23 test mới; đã thử tải Chromium thật (~150 MB) và chạy được; ADR 0006 |
| 2026-11-16 | M1-04b | Xong — `Env.proxy` (HTTP/HTTPS/SOCKS5, bypass, mật khẩu qua secret), proxy theo context, DNS qua proxy | 9 test mới (proxy HTTP có auth + SOCKS5 thật trong Node, tên máy nội bộ chỉ proxy phân giải được) |
| 2026-11-16 | — | Người dùng yêu cầu làm hết M1 trong 1 phiên, code xong hết rồi mới test | Bỏ qua quy tắc 1 chat = 1 task cho phiên này |
| 2026-11-16 | M1-05 | Xong — mỗi session 1 context riêng, nhãn session trên từng step, bước `switchSession` [F-01, A-16] | e2e: 2 phiên cách ly cookie |
| 2026-11-16 | M1-06 | Xong — `{{…}}`, phạm vi env→suite→test→runtime, generator (random/uuid/timestamp/fake.* tiếng Việt), ngày (`today+3d`, `startOfMonth`, `| dd/MM/yyyy`), biểu thức | 14 unit test |
| 2026-11-16 | M1-07 | Xong — goto, fill, clear, click (đúp/phải), hover, select (native + tự làm), check, pickDate, press, scroll, upload, navigate | e2e trên form demo-site |
| 2026-11-16 | M1-08 | Xong — tab mới/chuyển/đóng (tự bắt popup), dialog, iframe tự phát hiện (lồng 2 lớp), clearData, wait | e2e |
| 2026-11-16 | M1-09 | Xong — 12 loại kiểm tra (hiển thị, trạng thái, text, giá trị, số, ngày, đếm, bảng, URL, tiêu đề, thông báo, biến), cứng/mềm | e2e |
| 2026-11-16 | M1-10 | Xong — `extract` (text/value/thuộc tính/URL/tiêu đề + regex) | e2e |
| 2026-11-16 | M1-11 | Xong — `call` (step dùng chung có tham số), `waitUntil` (chu kỳ + tải lại), `if`/`elseSteps`, `loop` (N lần / dữ liệu / dòng bảng), `skipIf`, kết quả step con | e2e |
| 2026-11-16 | M1-12 | Xong — `api` (method/header/JSON/form, lưu response, kiểm status/field), ghi lỗi console & 4xx/5xx, tùy chọn fail | e2e |
| 2026-11-16 | M1-13 | Xong — ảnh chụp khoanh đỏ (lỗi / mọi step), video, trace, che secret | e2e; tự cài ffmpeg khi cần video |
| 2026-11-16 | M1-14 | Xong — lỗi tiếng Việt + gợi ý cho mọi mã lỗi, `describeRunError` (vi/en) | 6 unit test |
| 2026-11-16 | M1-15 | Xong — test mẫu "nhân viên tạo đơn → quản lý thấy sau đồng bộ trễ, kiểm tra bảng, duyệt" từ file `.kiemi.json`, chạy theo 2 dòng dữ liệu | Pass; cả repo 201 test; ADR 0007 |
| 2026-11-16 | — | Người dùng yêu cầu làm tiếp M2 cùng phiên, code xong rồi mới test | |
| 2026-11-16 | M2-01 | Xong — `@kiemi/db`: 17 bảng Phụ lục 2 (Drizzle), migration nhúng + bảng `_kiemi_migrations`, seed workspace/project/môi trường/ngôn ngữ | better-sqlite3 13 (N-API) chạy cả Node lẫn Electron 45 không cần rebuild; đã chạy app thật: tạo `kiemi.db` đúng |
| 2026-11-16 | M2-02 | Xong — `Repo` (workspace, soft delete, optimistic version) + service Project/Folder/TestCase/Suite/SharedStep/Element + tRPC | Thư mục chống vòng lặp, xóa lan xuống test con |
| 2026-11-16 | M2-03 | Xong — Môi trường, biến, secret mã hóa bằng `safeStorage`; renderer chỉ thấy tên secret | |
| 2026-11-16 | M2-04 | Xong — Dataset: bảng nhập tay, nhập CSV (`,`/`;`/tab, BOM), Excel (ngày, công thức, rich text) | |
| 2026-11-16 | M2-05 | Xong — Xuất/nhập `.kiemi.json` và `.zip` (project/suite), id mới, ánh xạ tham chiếu, không xuất secret | 33 test mới (db 29 + router 4); cả repo 234 test; ADR 0008 |
