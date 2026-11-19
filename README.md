<div align="center">

<img src="apps/desktop/build/icon.png" alt="Kiemi" width="112" height="112">

# Kiemi

**Let Kiemi do the checking.**

Kiểm thử giao diện web **không cần viết code** — ghi lại thao tác hoặc soạn từng bước, bấm **Chạy**, xem kết quả.
Chạy offline, không cần tài khoản, không cần cài thêm gì.

[![Phiên bản mới nhất](https://img.shields.io/github/v/release/NguyenKhanhDuy0112/kiemi?label=phi%C3%AAn%20b%E1%BA%A3n&color=1F2A5C)](https://github.com/NguyenKhanhDuy0112/kiemi/releases/latest)
[![CI](https://github.com/NguyenKhanhDuy0112/kiemi/actions/workflows/ci.yml/badge.svg)](https://github.com/NguyenKhanhDuy0112/kiemi/actions/workflows/ci.yml)

</div>

## Tải về

Chọn đúng máy của bạn — nút luôn tải **bản mới nhất**.

<div align="center">

[![Tải cho Windows](https://img.shields.io/badge/T%E1%BA%A3i%20cho%20Windows-.exe-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/NguyenKhanhDuy0112/kiemi/releases/latest/download/Kiemi-Setup.exe)
&nbsp;
[![Tải cho macOS](https://img.shields.io/badge/T%E1%BA%A3i%20cho%20macOS-.dmg-1F2A5C?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/NguyenKhanhDuy0112/kiemi/releases/latest/download/Kiemi-mac.dmg)

[Windows portable (không cần cài)](https://github.com/NguyenKhanhDuy0112/kiemi/releases/latest/download/Kiemi-Portable.exe) · [Mọi phiên bản](https://github.com/NguyenKhanhDuy0112/kiemi/releases)

</div>

| Máy | File | Cách cài |
|---|---|---|
| **Windows 10/11** | `Kiemi-Setup.exe` | Bấm đúp là xong — cài cho riêng tài khoản của bạn, **không cần quyền quản trị**. |
| **Windows — không cài được** (máy công ty, server qua Remote Desktop) | `Kiemi-Portable.exe` | Chép file vào máy rồi bấm đúp, không cần cài. |
| **macOS** (chip Intel và Apple) | `Kiemi-mac.dmg` | Mở file, kéo **Kiemi** vào thư mục **Applications**. |

> **Lần đầu mở**, vì bản hiện tại chưa được ký số:
> - **Windows** hiện *"Windows protected your PC"* → bấm **More info** → **Run anyway**.
> - **macOS** báo *không xác định được nhà phát triển* → chuột phải vào **Kiemi** → **Mở** → **Mở**.

Kiemi dùng **Microsoft Edge** hoặc **Google Chrome** có sẵn trên máy. Không có cả hai thì lần chạy đầu Kiemi tự tải một trình duyệt (một lần, khoảng 150 MB).

## Kiemi làm được gì

- **Ghi lại thao tác** trên trình duyệt → mỗi thao tác thành một bước đọc như câu: *Bấm vào `Nút Lưu`*, *Nhập `Ô Họ tên` = `Nguyễn Văn An`*. Kiemi tự gợi ý bước kiểm tra khi trang thay đổi.
- **Soạn và sửa bước bằng bảng**: kéo thả, tắt tạm, hoàn tác; điều kiện, lặp, chờ đến khi, gọi API.
- **Chạy với nhiều dòng dữ liệu** nhập từ Excel/CSV; sinh dữ liệu giả tiếng Việt (họ tên, số điện thoại, ngày).
- **Nhiều vai trò trong một test** (nhân viên tạo đơn → quản lý duyệt), **môi trường** và **bí mật** được mã hóa, proxy / SSH cho mạng nội bộ.
- **Kết quả dễ hiểu**: lỗi bằng tiếng Việt (*"Bước 5: Không tìm thấy nút 'Lưu' sau 10 giây"*), ảnh chụp khoanh đỏ chỗ lỗi, video, xem lại từng thao tác, báo cáo HTML, so sánh 2 lần chạy.
- **Dự án mẫu** chạy được ngay, không cần mạng. **Tự cập nhật**, dữ liệu luôn được giữ nguyên.

Hướng dẫn đầy đủ: **[docs/user-guide](docs/user-guide/README.md)**.

---

## Dành cho nhà phát triển

Yêu cầu: Node ≥ 22.12 (`.nvmrc` = 24), pnpm 11, Edge hoặc Chrome (cho test engine).

```bash
pnpm install
pnpm dev                    # mở app ở chế độ phát triển
pnpm lint && pnpm typecheck && pnpm test
```

Đóng gói thử trên máy (ra `apps/desktop/release/`):

```bash
pnpm build
pnpm --filter @kiemi/desktop exec electron-builder --config electron-builder.config.js --dir --publish never
```

| Thư mục | Nội dung |
|---|---|
| `apps/desktop` | App Electron: `main/` (DB, chạy test, ghi thao tác, cập nhật), `preload/`, `renderer/` (React + shadcn/ui) |
| `apps/demo-site` | Trang web mẫu để test engine và cho Dự án mẫu |
| `packages/schema` | Định nghĩa test (Step DSL có version) + migration |
| `packages/engine` | Dịch bước → Playwright, chạy trong tiến trình riêng |
| `packages/recorder` | Ghi thao tác, chọn phần tử trên trang |
| `packages/db` | SQLite + Drizzle: lưu trữ, nhập/xuất |
| `packages/shared` | i18n (vi/en), mã lỗi |

Tài liệu: [SPEC](docs/SPEC.md) · [ROADMAP](docs/ROADMAP.md) · [Kiến trúc](docs/ARCHITECTURE.md) · [ADR](docs/adr/) · [Checklist phát hành](docs/RELEASE-CHECKLIST.md).

**Phát hành**: `pnpm changeset` → `pnpm release:version` → commit → `git tag vX.Y.Z && git push origin vX.Y.Z`. GitHub Actions build Windows + macOS và đăng lên [Releases](https://github.com/NguyenKhanhDuy0112/kiemi/releases); nút tải ở trên tự trỏ tới bản mới.
