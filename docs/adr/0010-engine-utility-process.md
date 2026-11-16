# ADR 0010 — Engine chạy trong utility process, event về UI

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M4-01

## Bối cảnh
N-05: UI không được đứng khi đang chạy test; engine crash không kéo sập app. ARCHITECTURE: main dựng `RunRequest`, engine chạy ở tiến trình riêng, event chuyển tiếp qua tRPC subscription.

## Quyết định
1. **Utility process**: `utilityProcess.fork(out/main/engine-worker.js)` (entry thứ 2 của bundle main trong `electron.vite.config.ts`). Mỗi lần chạy = 1 tiến trình mới, chạy xong thì main kill.
2. **Giao thức** (`src/main/run/protocol.ts`, dữ liệu thuần, structured clone): main → worker `start { requests[], launch }` / `cancel`; worker → main `ready`, `download`, `event` (EngineEvent), `done { results }`, `fatal { error }`.
3. **`worker-core.ts`** không import Electron (test được bằng Node): mở 1 trình duyệt cho mọi request (mỗi dòng dữ liệu = 1 request), chạy lần lượt, đóng trình duyệt.
4. **`RunManager`** (main): đọc test/môi trường/bí mật/dữ liệu/bước dùng chung/cài đặt từ DB → tạo `runs` + 1 `run_cases` mỗi dòng (`RunRequest.runId` = id của run case) → mở SSH tunnel nếu môi trường bật (proxy = SOCKS cục bộ) → spawn worker. Ghi `run_steps` / `artifacts` theo `stepEnd`/`runEnd`; đóng tunnel khi xong.
5. **Trạng thái cuối**: có case `error` → `error`; đã bấm Dừng hoặc có case `cancelled` → `cancelled`; có case `failed` → `failed`; còn lại `passed`. Worker thoát mà chưa gửi `done`/`fatal` → `error` mã `ENGINE_CRASHED`. Lỗi mở trình duyệt → `BROWSER_LAUNCH_FAILED`/mã của engine; lỗi SSH → `SSH_FAILED`.
6. **Dừng**: gửi `cancel` (engine vẫn chạy bước dọn dẹp), sau 15 giây chưa xong thì kill.
7. **Feed cho UI**: `runs.events` (subscription, async generator) phát lại toàn bộ event đã có rồi event mới, kết thúc khi run xong. Main giữ lịch sử event của 20 run gần nhất trong bộ nhớ. Kiểu `RunFeedEvent = status | download | engine`.
8. Mã lỗi mới `ENGINE_CRASHED`, `SSH_FAILED` thêm vào `ENGINE_ERROR_CODES` để `describeRunError` có thông điệp vi/en.

## Hệ quả
- `@kiemi/db` có `RunService` (`services.runs`). `ApiContext.runs: RunManager`; test dùng `createTestRunManager(services)` (`src/main/run/testing.ts`, worker chạy cùng tiến trình qua structured clone).
- Dataset nguồn file Excel/CSV trong test (không qua bảng/bộ đã lưu) hiện chạy như không có dữ liệu.
- `app.getAppMetrics()` hiện tiến trình engine là `Utility` / `node.mojom.NodeService`.
