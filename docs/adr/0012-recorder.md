# ADR 0012 — Recorder: bắt thao tác và gộp thành step

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M5-01

## Quyết định
1. **Gói `@kiemi/recorder`** (không import electron/DB/React): `startRecorder(context, { startUrl?, baseUrl?, session?, onChange?, navigationGraceMs? })` nhận `BrowserContext` của playwright-core đã mở sẵn (headed khi dùng thật) → `{ steps, page, stop() }`. Main/engine worker sẽ gọi nó ở bước nối UI.
2. **Script nhúng** (`src/injected.ts`): hàm `installRecorder` tự chứa, chuyển thành chuỗi bằng `toString()` và cài bằng `context.addInitScript` (chạy ở mọi trang và mọi iframe) + `frame.evaluate` cho trang đã mở sẵn. Gửi dữ liệu qua `context.exposeBinding('__kiemiRecord')`. Cả hai trả `Disposable` → `stop()` gỡ ra. Cờ `window.__kiemiRecorderInstalled` chống cài 2 lần.
3. **Chỉ ghi sự kiện `isTrusted`** (thao tác thật của người dùng), lắng nghe ở capture phase. Sự kiện do script trang tự phát (hoặc `selectOption`/`dispatchEvent` của Playwright) bị bỏ qua — để không sinh step rác khi trang tự đồng bộ dữ liệu.
4. **Dữ liệu từ trang là không tin cậy**: mọi payload qua binding được parse bằng Zod (`PageEventSchema`, giới hạn độ dài) trước khi dùng.
5. **Gộp thao tác thừa** (K-02) trong `StepCollector` (thuần, có unit test): gõ phím liên tiếp cùng ô → 1 step `fill` (cập nhật giá trị); chọn/tick lại cùng phần tử → giữ lần cuối; 2 click của double-click → 1 `click {variant: double}`; click chỉ để focus ô nhập/select/checkbox/label → không ghi (sự kiện của ô được ghi thay); click do Enter sinh ra (submit form) → không ghi. Phần tử được nhận diện bằng `tab:frame:key` (key gán trong trang bằng `WeakMap`).
6. **Phím**: ghi Enter, Escape, F1–F12; phím mũi tên/PageUp/Home/Backspace/Delete khi không ở trong ô nhập; tổ hợp Ctrl/Alt/Meta (trừ phím soạn thảo Ctrl+A/C/V/X/Y/Z trong ô nhập). Ký tự thường đi vào `fill`. Bỏ Tab.
7. **Điều hướng & tab**: lần tải đầu của tab đầu → `goto`; tab mới người dùng tự mở → `newTab {url}`; popup/tab do trang mở (`opener`) → không ghi lần tải đầu. Tải trang sau đó chỉ ghi khi **không** có thao tác/lần tải trước trong `navigationGraceMs` (mặc định 1500 ms) — tức người dùng tự gõ địa chỉ; cùng URL → `navigate {to: reload}`. Thao tác chuyển sang tab khác → chèn `switchTab {by: index}`. URL dưới `baseUrl` lưu tương đối (`/login.html`).
8. **iframe**: không cần step riêng — engine tự tìm phần tử trong mọi frame (A-15).
9. **Locator lúc này là bản cơ bản** (text ngắn cho phần tử bấm được, `data-testid`, `#id`, `[name]`, css path). M5-02 thay bằng locator nhiều lớp đầy đủ + fingerprint.

## Hệ quả
- Code trong `installRecorder` không được dùng import/biến ngoài hàm; công cụ build không được chèn helper vào hàm này (đã chạy được với Vitest; cần kiểm tra lại khi bundle bằng electron-vite).
- Heuristic thời gian có thể bỏ sót trường hợp người dùng gõ địa chỉ ngay trong 1,5 giây sau thao tác; chấp nhận ở v1.
- Test e2e của recorder cần Chrome/Edge (như engine) và demo-site bản Vite (`startDemoSite`).
