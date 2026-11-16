# ADR 0006 — Trình duyệt: phát hiện Edge/Chrome, tải Chromium, context theo session

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M1-04

## Bối cảnh
N-03 (không bắt cài thêm, thiếu thì tự tải Chromium có tiến trình), G-01 (Edge/Chrome/Chromium), G-03 (kích thước màn hình, mobile), G-05 (hiện/ẩn trình duyệt).

## Quyết định
1. **Phát hiện** (`detectInstalledBrowsers`): kiểm tra đường dẫn cài chuẩn (Windows: `Program Files`, `Program Files (x86)`, `%LOCALAPPDATA%`; macOS: `/Applications`, `~/Applications`; Linux: `/opt/...`, `/usr/bin/...`). Thứ tự ưu tiên: Windows **Edge → Chrome** (Edge luôn có sẵn), macOS/Linux **Chrome → Edge**.
2. **Khởi chạy** (`launchBrowser({ settings: { browser: auto|msedge|chrome|chromium, headless=true, slowMoMs? }, browsersPath, onDownloadProgress })`): luôn dùng `executablePath` đã phát hiện (không dùng `channel`), chế độ headless mới của Chrome — **không cần tải headless shell**.
3. **Fallback Chromium**: `auto` mà máy không có Edge/Chrome → tải `chromium` (kèm ffmpeg cho video) bằng CLI của `playwright-core` (`install --no-shell chromium`) chạy bằng `process.execPath` + `ELECTRON_RUN_AS_NODE=1`, `PLAYWRIGHT_BROWSERS_PATH=<browsersPath>` (thư mục dữ liệu app, desktop truyền vào). Tiến trình lấy từ dòng `NN% of X MiB` mà Playwright in ra khi không phải TTY (mỗi 10%). Đường dẫn chromium tính bằng cách đổi gốc `chromium.executablePath()` sang `browsersPath` (Playwright chỉ đọc biến môi trường lúc khởi động).
4. **Context theo session** (`SessionPages`): mỗi `session` 1 `BrowserContext` riêng (cookie/storage riêng) + 1 page đang dùng, tạo khi step đầu tiên của session gọi `ctx.page()`/`ctx.context()`; đóng hết sau cleanup. Runner nhận `RunOptions.browser` (đã launch bên ngoài) và `RunRequest.options.viewport`.
5. **Màn hình** (`ViewportSettings { device?, viewport? }`): mặc định 1366×768; `device` = tên thiết bị Playwright (`listDevices()` cho dropdown) → userAgent, scale, isMobile, hasTouch; `viewport` ghi đè kích thước.
6. **Mã lỗi**: `BROWSER_NOT_FOUND`, `BROWSER_DOWNLOAD_FAILED` (details: 5 dòng output cuối), `BROWSER_LAUNCH_FAILED`, `UNKNOWN_DEVICE`, `NO_BROWSER` (run không có browser mà action cần page).

## Hệ quả
- Engine không tự launch trong `runTestCase`: utility process của desktop launch 1 lần, dùng lại cho nhiều run (nhanh hơn), tự đóng.
- Firefox/WebKit (G-02, v1.x) thêm bằng cách mở rộng `BROWSER_KINDS` + `launch` theo loại.
- Ngôn ngữ/múi giờ/vị trí (G-04, v1.x) sẽ thêm vào `ViewportSettings`/context options.
