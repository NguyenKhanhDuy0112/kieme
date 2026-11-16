# ADR 0008 — Tầng dữ liệu `@kiemi/db`: SQLite + Drizzle, migration nhúng, secret qua keychain, nhập/xuất

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M2-01 → M2-05

## Bối cảnh
M2 cần lưu trữ cục bộ (SPEC Phụ lục 2), CRUD qua tRPC, môi trường/biến/secret (S-06, E-08, N-07), dữ liệu test Excel/CSV (E-03), xuất/nhập (J-03). Stack đã chốt: SQLite (better-sqlite3) + Drizzle, exceljs.

## Quyết định
1. **Package mới `packages/db` (`@kiemi/db`)**: Node thuần, không import Electron. Chứa schema Drizzle (`tables.ts`), migration, `Repo` chung, các service, nhập/xuất. Desktop main chỉ mở DB, cấp `SecretCipher` (Electron `safeStorage`) và expose qua tRPC. Lý do: test được bằng Vitest không cần Electron; CLI (v1.x) dùng lại được.
2. **better-sqlite3 13** dùng N-API + bản dựng sẵn cho mọi OS → **cùng một file nhị phân chạy được cả Node (test) lẫn Electron 45**, không cần `electron-rebuild` (đã kiểm chứng). `pnpm-workspace.yaml` cho phép script cài đặt của `better-sqlite3`.
3. **Migration nhúng trong TS** (`migrations.ts`: danh sách `{ id, name, sql }`), chạy trong transaction, ghi vào `_kiemi_migrations`. Không dùng drizzle-kit/thư mục migration → main process đóng gói bằng electron-vite không cần mang file kèm. Test bắt buộc: DB sau mọi migration khớp **chính xác** các bảng Drizzle (cột, kiểu, NOT NULL). Không bao giờ sửa migration đã phát hành.
4. **Mọi bảng** có `id` (UUIDv7), `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `version` (epoch ms). `Repo` luôn lọc theo workspace + chưa xóa; xóa = soft delete; `update(id, patch, expectedVersion)` → `VERSION_CONFLICT` nếu đã bị sửa nơi khác; `version` tăng mỗi lần ghi.
5. **TestCase** lưu nguyên tài liệu `.kiemi.json` (cột `content`, JSON) + cột `name/tags/description/schema_version` để liệt kê nhanh. Lưu qua `parseTestCase` (migrate + validate) — file cũ luôn mở được.
6. **Secret**: chỉ lưu `ciphertext` do keychain mã hóa (`safeStorage`: Keychain macOS / DPAPI Windows). API cho renderer chỉ trả **tên** secret; giá trị giải mã chỉ có ở `environments.forRun()` trong main để gửi engine. Keychain không dùng được → `SECRETS_UNAVAILABLE`, không lưu.
7. **Dataset**: CSV tự viết (RFC 4180, tự đoán `,` `;` tab, bỏ BOM, xuống dòng trong ô); Excel bằng `exceljs` (ngày → `dd/MM/yyyy`, công thức → kết quả, rich text → chữ). Cột trống → "Cột N", trùng tên → "(2)".
8. **Xuất/nhập**: 1 test = `.kiemi.json`; project/suite = `.zip` (thư viện **`fflate`** — nhỏ, JS thuần, không phụ thuộc) gồm `kiemi.json` (manifest `kiemi-bundle` v1) + `tests/<thư mục>/<tên>.kiemi.json`. Nhập luôn tạo **project mới, id mới**, ánh xạ lại tham chiếu (thư mục, `call.shared`, suite → test/dataset/môi trường). **Không bao giờ xuất giá trị secret**; báo cáo nhập liệt kê secret cần nhập lại, step dùng chung bị thiếu, file hỏng bị bỏ qua. Giới hạn zip: 5000 file / 200 MB.
9. **Lỗi**: `DbError` (`NOT_FOUND`, `VERSION_CONFLICT`, `VALIDATION`, `NAME_TAKEN`, `SECRETS_UNAVAILABLE`, `IMPORT_FAILED`) → tRPC code tương ứng; `error.data.kiemiCode` + `details` để renderer dịch sang tiếng Việt.
10. File đi giữa renderer và main dưới dạng base64 (renderer sandbox không có file system).

## Hệ quả
- DB ở `app.getPath('userData')/kiemi.db` (WAL).
- Kiểu `Proxy` của schema đổi tên thành `ProxySettings` (tránh che `Proxy` toàn cục).
- Khi đóng gói (M7) phải giữ `better-sqlite3` ngoài asar (`asarUnpack`) vì là module native.
