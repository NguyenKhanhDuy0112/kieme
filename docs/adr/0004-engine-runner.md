# ADR 0004 — Engine: action registry, runner tuần tự, event stream, timeout

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M1-02

## Bối cảnh
- CLAUDE.md §5.2–5.3: engine độc lập (không Electron/DB/React), action là plugin `defineAction`.
- D-05 (cleanup luôn chạy), D-06 (tắt step), D-07 (timeout riêng từng step).
- Trình duyệt (Playwright) chưa gắn — làm ở M1-04.

## Quyết định
1. `packages/engine` chỉ phụ thuộc `@kiemi/schema` + `zod`. Chưa thêm `playwright-core` (M1-04 sẽ thêm và mở rộng `ActionContext` với page/context của session).
2. `defineAction({ type, params, ui: { label (i18n key), icon (Lucide), group }, execute(params, ctx) })`. `ActionRegistry` giữ action theo `type`, trùng `type` → lỗi. Runner validate `step.params` bằng `action.params.safeParse` trước khi chạy.
3. `ActionContext = { step, session, timeoutMs, signal, log }`. `signal` bị abort khi step hết giờ hoặc run bị hủy — action dài phải lắng nghe để dừng sớm.
4. `runTestCase(RunRequest, { registry, onEvent, signal })` → `RunResult`. Event (dữ liệu thuần, gửi được qua MessagePort): `runStart | stepStart | log | stepEnd | runEnd` (`artifact` thêm khi có ảnh chụp). Listener ném lỗi không làm hỏng run.
5. Ngữ nghĩa chạy:
   - Tuần tự theo thứ tự `steps`; step `enabled=false` → `skipped` (không có `stepStart`).
   - Lỗi `hard` → dừng, các step còn lại `skipped`; lỗi `soft` → ghi lại (`soft: true`) và chạy tiếp. Có step `failed` (kể cả soft/cleanup) → run `failed`.
   - Timeout = `step.timeoutMs` ?? `options.defaultStepTimeoutMs` ?? **10 000 ms**. Hết giờ → `STEP_TIMEOUT` (details `{ step, timeoutMs }`).
   - Hủy (`signal`) → step đang chạy và các step sau `skipped` với `RUN_CANCELLED`, run `cancelled`.
   - Cleanup **luôn chạy** sau steps (kể cả khi fail/hủy), chạy hết mọi step cleanup dù có step lỗi.
   - Lỗi ngoài dự kiến của chính runner → run `error` (`ENGINE_ERROR`).
6. **Mã lỗi** (`ENGINE_ERROR_CODES`): `UNKNOWN_ACTION`, `INVALID_PARAMS`, `STEP_TIMEOUT`, `STEP_FAILED`, `RUN_CANCELLED`, `ENGINE_ERROR`. `RunError.message` của engine là tiếng Anh dự phòng cho log; **UI dịch theo `code` + `details`** (số bước = `details.step`, bắt đầu từ 1) thành câu tiếng Việt dễ hiểu.

## Hệ quả
- Engine không phụ thuộc i18n; chuỗi lỗi cho người dùng thêm vào `@kiemi/shared` khi làm màn Kết quả.
- Đo `durationMs` bằng `performance.now()`; `now` có thể inject để test.
