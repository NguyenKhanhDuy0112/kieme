# ADR 0016 — Tự cập nhật (electron-updater) và báo lỗi crash opt-in (Sentry)

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M7-03, M7-04

## Quyết định
### Tự cập nhật (N-12)
1. **electron-updater 6** (dependency runtime của desktop; cùng hệ với electron-builder, đọc `latest.yml`/`latest-mac.yml` trên GitHub Releases, tải chênh lệch qua blockmap).
2. `UpdateService` (`src/main/update/update-service.ts`, không import Electron, updater được tiêm vào) giữ trạng thái `off | idle | checking | upToDate | downloading | ready | available | error`, phát qua tRPC `updates.events`. Kiểm tra 10 giây sau khi mở (không làm chậm khởi động) rồi mỗi 4 giờ.
3. **Chế độ** (`updateMode`): bản cài = `auto` (tải ngầm, `autoInstallOnAppQuit`, nút "Khởi động lại để cập nhật" → `quitAndInstall`); bản portable (`PORTABLE_EXECUTABLE_DIR`) = `notify` (không tải, nút "Tải bản mới" mở trang Releases); dev hoặc `KIEMI_DISABLE_UPDATES=1` = `off`. Portable không có `app-update.yml` nên gọi `setFeedURL` trỏ thẳng repo (`RELEASE_SOURCE`, test đối chiếu với cấu hình electron-builder).
4. **"Có gì mới"**: ghi chú lấy từ release GitHub (HTML) → chuyển sang văn bản thường (`releaseNotesText`); nguồn là CHANGELOG của Changesets (ADR 0015). Hộp thoại tự mở một lần khi bản mới sẵn sàng; sau đó còn nút trên thanh tiêu đề và mục Cài đặt → Cập nhật.
5. **Dữ liệu giữ nguyên**: DB ở `userData` không bị trình cài đặt động tới; mỗi migration chạy trong transaction; trước khi migrate một DB đã có dữ liệu, `openDatabase({ backupDir })` sao lưu bằng `VACUUM INTO` vào `userData/backups/kiemi-before-<id>-<thời điểm>.db`.
6. Lỗi kiểm tra (mất mạng…) chỉ ghi trạng thái `error`, không bật thông báo.

### Báo lỗi crash (N-09)
1. **@sentry/electron 8** (dependency runtime; lý do: bắt được cả lỗi JS ở main lẫn crash native của renderer/utility process qua minidump, có hàng đợi offline).
2. **Opt-in, mặc định tắt**: cài đặt `crashReports`. SDK **chỉ khởi động** khi người dùng đã bật trước lần mở app này **và** bản build có DSN (`MAIN_VITE_SENTRY_DSN`, chỉ đặt trong workflow phát hành; turbo khai báo `MAIN_VITE_*`). Bật → hiệu lực từ lần mở sau (SDK phải khởi động trước `ready`, nên DB được mở trước `ready`). Tắt → `beforeSend` bỏ mọi sự kiện ngay lập tức.
3. **Không gửi dữ liệu cá nhân** (`crash/scrub.ts`, có test): bỏ `user`, `server_name`, `request`, `extra`, mọi breadcrumb; context chỉ giữ tên/phiên bản OS, runtime, app; thư mục home → `~`; URL → `<url>`, email → `<email>`; bỏ biến và dòng mã nguồn trong stack frame. Không gửi transaction/trace. Không chèn preload của Sentry vào cửa sổ (sandbox giữ nguyên).
4. Lỗi chưa bắt trong cửa sổ được chuyển về main qua tRPC `app.reportError` (tối đa 20 lần mỗi phiên cửa sổ), main mới quyết định gửi hay không.

## Hệ quả
- macOS chỉ tự cập nhật được khi app đã ký (Squirrel.Mac) → phụ thuộc M7-02. Bản chưa ký: trạng thái `error`, người dùng tải tay.
- Cần tạo project Sentry và secret `SENTRY_DSN` trong repo; chưa có thì app không bao giờ gửi gì (đúng tinh thần offline).
