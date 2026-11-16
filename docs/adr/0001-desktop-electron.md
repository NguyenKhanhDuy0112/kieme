# ADR 0001 — Desktop app bằng Electron, engine Playwright

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16

## Bối cảnh
- Người dùng là tester không biết code; yêu cầu "cài là dùng".
- Nhiều web cần test nằm sau VPN/mạng nội bộ (vd UAT của khách hàng). Không được cài gì lên server của khách hàng.
- Muốn chi phí vận hành gần bằng 0 ở giai đoạn đầu.

## Quyết định
- Desktop app **Electron** (Windows + macOS), chạy test trên máy người dùng bằng **Playwright**, dữ liệu lưu **SQLite local**.
- Dùng Edge/Chrome có sẵn trên máy (`channel`), fallback tải Chromium.
- Toàn bộ TypeScript trong 1 monorepo; engine tách thành package độc lập để sau này dùng cho CLI / runner cloud.

## Lý do
- Máy người dùng đã vào được VPN → không cần tunnel, agent hay runner server.
- Electron có sẵn Node.js → chạy Playwright trực tiếp (Tauri cần sidecar Node).
- Không cần hạ tầng server, không cần cách ly đa khách hàng ở v1.
- Dữ liệu và secret ở lại trên máy người dùng → dễ được doanh nghiệp tài chính chấp nhận.

## Hệ quả
- Phải lo đóng gói, ký code, auto-update cho 2 hệ điều hành.
- Làm việc nhóm / chia sẻ: v1 dùng Xuất/Nhập file; đồng bộ cloud để sau (schema DB đã sẵn sàng: UUIDv7, workspaceId, updatedAt, deletedAt, version).
- Chạy theo lịch / CI: để v1.x (CLI dùng chung engine).
