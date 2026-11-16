# ROADMAP — Kiemi v1

Mỗi task: làm trong 1 phiên, tham chiếu ID trong `SPEC.md`. Tick `[x]` khi xong (theo Definition of Done trong `CLAUDE.md`).

## M0 — Nền móng
- [x] **M0-01** Khởi tạo monorepo: pnpm workspaces, Turborepo, TypeScript strict, Biome, Vitest; script `lint`, `typecheck`, `test`, `dev`
- [x] **M0-02** Tạo `apps/desktop` bằng electron-vite (React 19 + Tailwind + shadcn/ui); bật contextIsolation/sandbox; cửa sổ "Hello Kiemi" chạy được
- [x] **M0-03** Nối electron-trpc giữa renderer ↔ main, 1 procedure mẫu có Zod
- [x] **M0-04** i18next (vi/en), cấu trúc file dịch, hook `useT`
- [x] **M0-05** Tạo `apps/demo-site` (Vite): trang login 2 vai trò, form có validate, bảng phân trang, iframe, popup/confirm, trang giả WebForms ID động, dữ liệu đồng bộ trễ (A tạo → B thấy sau 5s)
- [x] **M0-06** GitHub Actions: lint + typecheck + test trên Windows & macOS

## M1 — Schema & Engine lõi
- [x] **M1-01** `packages/schema`: Locator, Step, TestCase, Env, Dataset, RunResult (Zod) + `schemaVersion: 1` + framework migration + xuất JSON Schema [N-08, C-01, C-02]
- [x] **M1-02** `packages/engine`: `defineAction` registry, runner chạy tuần tự, stream event (stepStart/stepEnd/log), timeout từng step [D-07]
- [x] **M1-03** Locator resolver nhiều lớp + ngữ cảnh + thứ N + ID động [C-01, C-03, C-04, C-05]
- [x] **M1-04** Trình duyệt: phát hiện Edge/Chrome, fallback tải Chromium; headed/headless; viewport/mobile [N-03, G-01, G-03, G-05]
- [x] **M1-04b** Proxy theo môi trường (HTTP/SOCKS5, DNS qua proxy) [G-06]
- [x] **M1-05** Nhiều phiên (browser context theo `session`) [F-01, A-16]
- [x] **M1-06** Biến: `{{…}}`, phạm vi, generator, ngày, biểu thức [E-01, E-02, E-05, E-06, E-07]
- [x] **M1-07** Actions điều hướng & nhập liệu [A-01 → A-12]
- [x] **M1-08** Actions tab, dialog, iframe, cookie, chờ [A-13 → A-18]
- [x] **M1-09** Assertions [B-01 → B-11]
- [x] **M1-10** Lưu giá trị vào biến [E-04]
- [x] **M1-11** Luồng: step dùng chung, waitUntil, if/else, lặp, cleanup, tắt step [D-01 → D-06]
- [x] **M1-12** API call + bắt lỗi console/network [F-03, F-04]
- [x] **M1-13** Artifacts: ảnh chụp (khoanh đỏ), video, trace; che secret [I-01 → I-03, E-08]
- [x] **M1-14** Thông báo lỗi tiếng Việt + gợi ý sửa [I-04, N-06]
- [x] **M1-15** E2E: test mẫu "A tạo → B kiểm tra" chạy pass trên demo-site

## M2 — Lưu trữ
- [ ] **M2-01** SQLite + Drizzle: schema theo Phụ lục 2, migration, seed workspace mặc định
- [ ] **M2-02** Repository + tRPC CRUD: Project, Folder, TestCase, Suite, SharedStep, Element
- [ ] **M2-03** Environment, Variable, Secret (safeStorage) [S-06, E-08, N-07]
- [ ] **M2-04** Dataset: import Excel/CSV, bảng nhập tay [E-03]
- [ ] **M2-05** Xuất / Nhập project, test (`.kiemi.json` / `.zip`) [J-03]

## M3 — UI soạn test
- [ ] **M3-01** Layout app, điều hướng, trang chủ danh sách [S-01]
- [ ] **M3-02** Bảng step: thêm/sửa/xóa/kéo thả/tắt/nhân bản, undo/redo [S-02, J-04, J-06]
- [ ] **M3-03** Panel thuộc tính step tự sinh form từ `params` + `ui` của action
- [ ] **M3-04** Ô nhập có gợi ý biến `{{` [E-01]
- [ ] **M3-05** Kho phần tử + tìm nơi dùng [J-01, J-02]
- [ ] **M3-06** Tab Dữ liệu, Biến, Phiên trong màn soạn test [E-03, F-01]
- [ ] **M3-07** Màn Môi trường & Cài đặt [S-06, S-07]
- [ ] **M3-08** SSH tunnel tích hợp (thư viện `ssh2` ở main process, SOCKS cục bộ, jump host, Kiểm tra kết nối, credential lưu Secret) + hướng dẫn VPN → SSH [G-07, G-08]

## M4 — Chạy & Kết quả
- [ ] **M4-01** Engine chạy trong utility process, nối event về UI [N-05]
- [ ] **M4-02** Màn Chạy test: tiến độ realtime, Dừng/Tạm dừng/Bước tiếp, breakpoint, chạy từ bước X, slow-mo [S-03, H-03, H-04]
- [ ] **M4-03** Chạy suite / tag, chọn môi trường [H-01, H-02]
- [ ] **M4-04** Màn Kết quả: step, ảnh, video, trace viewer [S-04]
- [ ] **M4-05** Lịch sử chạy [S-05]
- [ ] **M4-06** Xuất báo cáo HTML tự chứa [I-05]

## M5 — Recorder & Pick
- [ ] **M5-01** `packages/recorder`: bắt thao tác → step, gộp thao tác thừa [K-01, K-02]
- [ ] **M5-02** Sinh locator nhiều lớp + fingerprint khi ghi [C-01, C-02]
- [ ] **M5-03** Thanh công cụ nổi: Thêm kiểm tra, Lưu giá trị, Dừng [K-03]
- [ ] **M5-04** Pick + Highlight phần tử [C-06]
- [ ] **M5-05** Ghi chèn từ step X; nhận ô password → Secret [K-04, K-05]
- [ ] **M5-06** Lưu & dùng lại phiên đăng nhập [F-02]
- [ ] **M5-07** Gợi ý kiểm tra tự động khi ghi (theo dõi thay đổi DOM/URL sau thao tác) [M-01]
- [ ] **M5-08** "Biến thành dữ liệu" sau khi ghi [M-02]
- [ ] **M5-09** Sinh biến thể negative/biên từ form đã ghi [M-03]

## M6 — Hoàn thiện sản phẩm
- [ ] **M6-01** Onboarding lần đầu + test mẫu [S-08, L-01, L-02, N-01]
- [ ] **M6-02** Chế độ Nâng cao (sửa selector) [C-07]
- [ ] **M6-03** Rà soát toàn bộ i18n, thông báo lỗi, accessibility cơ bản
- [ ] **M6-04** Hiệu năng: mở app ≤ 3s, test 200 step không giật UI [N-05]

## M7 — Đóng gói & Phát hành
- [ ] **M7-01** electron-builder: `.exe` (NSIS) + `.dmg` + **Windows portable `.exe`** [N-10]
- [ ] **M7-02** Ký code Windows + notarize macOS (cần chứng chỉ — hỏi người dùng)
- [ ] **M7-03** Auto-update (electron-updater, nguồn GitHub Releases): tải ngầm, "Có gì mới", khởi động lại để cập nhật; DB migration khi mở bản mới; portable chỉ thông báo [N-09, N-12]
- [ ] **M7-03b** GitHub Actions release: tag → build Win (NSIS per-user + portable) & Mac (dmg, universal) → ký code → publish Releases; release notes từ Changesets [N-11, N-13]
- [ ] **M7-04** Sentry opt-in [N-09]
- [ ] **M7-05** Hướng dẫn sử dụng (docs người dùng) + checklist phát hành v1.0

## Sau v1 (v1.x)
M-04 → M-07 (AI tạo test, import), A-19, A-20, B-12 → B-14, C-08, D-08, F-05 → F-09, G-02, G-04, H-05 → H-08, I-06 → I-08, J-05.
