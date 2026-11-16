# ADR 0011 — Debug khi chạy, chạy suite/tag, màn Kết quả, lịch sử, báo cáo

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M4-02 → M4-06

## Quyết định
1. **Debug trong engine** (`packages/engine/src/run/debug.ts`): `RunOptions.debugger.beforeStep(step, signal)` được chờ trước mỗi bước (kể cả bước con, trừ bước dọn dẹp). `DebugController`: `pause()` (dừng trước bước kế), `step()` (chạy đúng 1 bước rồi dừng), `resume()`, `setBreakpoints(ids)`; Dừng (abort) giải phóng bước đang chờ. Thời gian chờ không tính vào timeout của bước. `options.startAtStepId`: bỏ qua các bước gốc trước bước X (kết quả `skipped`).
2. **Giao thức worker** thêm `pause | resume | step | breakpoints` và `start.debug`, `start.stopOnFailure`; worker gửi `debug { paused|running, stepId, stepNo }`. Có breakpoint hoặc chạy từng bước → luôn hiện trình duyệt.
3. **`runs.start` nhận `{ target, environmentId?, options }`** (`src/main/run/start-input.ts`): target `test` (+ `rowIndex`) / `suite` (item bật, dataset riêng của item, biến suite, môi trường mặc định của suite) / `tag` (không phân biệt hoa thường). `environmentId`: không truyền = môi trường của suite hoặc môi trường đầu tiên; `null` = không dùng. Options: `headless`, `slowMoMs`, `startAtStepId`, `breakpoints`, `pauseAtStart`, `stopOnFailure`, `screenshots`, `video`, `trace`.
4. **Dừng khi lỗi đầu tiên** (H-04) áp dụng ở mức test: test còn lại → `skipped`. Trong 1 test vẫn theo chế độ cứng/mềm của bước.
5. **Feed** thêm `plan` (danh sách case + target) và `debug`. Nhiều case → thư mục con `case-N/`; đường dẫn artifact luôn tương đối với thư mục run.
6. **DB**: migration 3 thêm `runs.target` (json `{kind, …, name}`) cho Lịch sử. `RunService.detail()` / `history()` (mới nhất trước theo UUIDv7, lọc test/suite/trạng thái, đếm case).
7. **Xem file kết quả**: scheme `kiemi-artifact://run/<runId>/<path>` (privileged, stream) đọc file trong đúng thư mục của run (chặn `..`/đường dẫn tuyệt đối). CSP renderer thêm `img-src`/`media-src kiemi-artifact:`.
8. **Trace viewer**: dùng web app có sẵn trong `playwright-core/lib/vite/traceViewer`, phục vụ bằng HTTP server nội bộ `127.0.0.1` (bố cục giống Playwright: app ở `/trace/`, trace truyền dạng `file?path=` và chỉ trả file đã cho phép), mở trong `BrowserWindow` sandbox riêng. Không thêm dependency.
9. **Báo cáo HTML** (I-05) dựng ở renderer bằng hàm thuần `buildHtmlReport`: 1 file, CSS nội tuyến, ảnh chụp dạng data URL (`runs.screenshots`), không script, không tải gì từ ngoài; video/trace không nhúng (nằm trong thư mục kết quả). Lưu bằng tải xuống của Electron (hộp thoại Lưu).
10. **UI**: một màn Chạy/Kết quả (`features/run/run-screen.tsx`, `openRunId` trong app store) — live khi đang chạy, từ DB khi mở lại; hộp thoại Tùy chọn chạy (nhớ lựa chọn trong phiên); breakpoint lưu theo test ở `localStorage` (`kiemi.breakpoints`, tiện ích cá nhân); bộ test sửa trong hộp thoại (chọn test theo thứ tự + môi trường); menu "Chạy theo tag"; Lịch sử dùng shadcn Table, so sánh 2 lần chạy (`compareRuns`).

## Hệ quả
- `ApiContext.desktop?` (`openTrace`, `showInFolder`) — test không cần Electron.
- Khi đóng gói (M7) cần kiểm tra `traceViewer` và `playwright-core` nằm ngoài asar hoặc đọc được qua asar.
