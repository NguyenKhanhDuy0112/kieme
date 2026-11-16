# ADR 0009 — Giao diện soạn test, form tự sinh, SSH tunnel

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M3-01 → M3-08

## Quyết định
1. **Bố cục (U-01)**: shadcn `sidebar` (thu gọn thành icon) + vùng chính + panel chi tiết bên phải (ẩn/hiện). Điều hướng bằng store **Zustand** (`view`, `projectId`, `openTestId`) — không thêm router. Command palette Ctrl/⌘K bằng shadcn `command` (cmdk). Theme sáng/tối/theo hệ thống (U-11) lưu trong Cài đặt; token sidebar dùng màu thương hiệu.
2. **Form tự sinh (M3-03)**: renderer không import engine (Playwright). Main có `system.actions` trả danh sách action + **JSON Schema** của `params` (`z.toJSONSchema(io: 'input')`). Renderer chọn control theo schema: `target` → bộ chọn phần tử (đã lưu / chữ / nhãn / gợi ý / loại+tên / CSS ở mục kỹ thuật), chuỗi → ô có gợi ý biến, enum → select, boolean → switch, số, danh sách, key-value, còn lại → JSON. Tùy chọn timeout/phiên/kiểu lỗi/ghi chú nằm trong "Nâng cao" (U-04).
3. **Câu tiếng Việt (U-03)**: mỗi action có `ui.steps.<type>.sentence` với `{{param}}`; renderer tách template thành chữ + chip (phần tử, giá trị). Không hiện selector (U-05).
4. **Tài liệu test trong editor**: các hàm thuần trong `doc-model.ts` (chèn/xóa/nhân bản/kéo thả/tắt, step lồng trong `steps`/`elseSteps`), store có undo/redo 100 bước (J-06). **Tự lưu** 0,8 giây sau lần sửa cuối + Ctrl/⌘S; lưu nốt khi rời màn hình; xung đột `version` → banner "Tải lại". Xóa bước/test → toast "Hoàn tác" (U-08); xóa thư mục/bộ test (không hoàn tác được) → hộp xác nhận.
5. **Gợi ý biến (M3-04)**: gõ `{{` → gợi ý từ biến môi trường, biến test, cột dữ liệu (`row.`), bí mật (`secret.`), biến lưu từ bước (`extract.into`, `api.saveTo`) và generator; lọc không dấu.
6. **SSH tunnel (G-07)**: `ssh2` (JS thuần — tắt build native tùy chọn `cpu-features`) ở main: kết nối (qua jump host nếu có) → mở **SOCKS5 cục bộ** trên 127.0.0.1, mỗi kết nối `forwardOut` qua SSH (DNS phân giải phía SSH). Run sẽ dùng `withTunnelProxy(env)` (M4). Mật khẩu/khóa riêng là **tên secret**. "Kiểm tra kết nối" trả thời gian hoặc lý do (`auth`/`timeout`/`unreachable`/`missingSecret`).
   - Schema: `Env.ssh = { enabled, target: SshHop, jump?: SshHop }`; DB thêm cột `environments.ssh` (**migration 2**); bundle xuất/nhập mang theo `ssh`.
7. **Cài đặt (S-07)**: bảng `settings` qua `SettingsService` (`language`, `theme`, `browser`, `headless`, `defaultTimeoutSec`, `resultsDir`) có giá trị mặc định; ngôn ngữ/theme áp dụng khi mở app (thay localStorage).
8. **Đóng gói main**: `@kiemi/engine` (mã TS) và các gói **chỉ có ESM** (`uuid`, `@faker-js/faker`, `date-fns`) phải được bundle vào main (CommonJS) — nếu để external, app crash lúc khởi động. Đã kiểm chứng bằng chạy app thật qua Playwright `_electron`.

## Hệ quả
- Component shadcn được cài bằng CLI; CLI không đọc được alias trong `tsconfig.json` nhiều project → sửa `from "cn"` thành `@renderer/lib/utils`; `sonner` viết lại không dùng `next-themes`.
- Nút **Ghi lại** và **Chạy** hiện có nhưng bị khóa (tooltip "sẽ có ở bản sau") cho tới M4/M5; màn **Lịch sử** là trạng thái rỗng.
