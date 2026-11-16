# ADR 0005 — Locator resolver: thử lần lượt, ngữ cảnh, thứ N, ID động

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M1-03

## Bối cảnh
- C-01: phần tử có nhiều chiến lược theo ưu tiên, tự thử lần lượt.
- C-03/C-04/C-05: định vị theo ngữ cảnh, phần tử thứ N, ID động (WebForms `ctl00_…`, ID sinh ngẫu nhiên).
- ADR 0003 đã hẹn thêm ngữ cảnh / thứ N / ID động vào Locator ở M1-03.

## Quyết định
1. **Schema (vẫn v1)**: `Locator` thêm 2 trường **tùy chọn** `scope?: LocatorScope[]` và `nth?: 'first' | 'last' | số ≥ 1` (đếm từ 1 như tester nói "thứ 3"). Không tăng `schemaVersion` vì: chỉ thêm trường tùy chọn, mọi file v1 cũ vẫn hợp lệ, và v1 chưa phát hành (không có app cũ nào phải đọc file mới). Thêm fixture `fixtures/v1/scoped-locators.kiemi.json`. Từ bản phát hành đầu tiên trở đi, mọi thay đổi schema phải theo ADR 0003.
2. **Scope** áp dụng theo thứ tự:
   - `within { strategies, nth? }`: vùng chứa, tự thử chiến lược của vùng; vùng khớp nhiều cái mà không có `nth` → tìm trong tất cả.
   - `row { text, exact? }`: dòng `tr` hoặc `[role=row]` có chứa chữ (exact = có ô đúng bằng chữ đó).
   - `near { text, position: below|above|leftOf|rightOf|near, exact? }`: lọc theo hình học so với chữ mốc (khung bao trong frame), xếp gần nhất trước; `near` = cách ≤ 50px. Tự tính bằng `getBoundingClientRect` thay vì dùng layout selector của Playwright (không khuyến khích, chỉ áp được cho CSS).
3. **Thuật toán** `resolveLocator(root, locator, { timeoutMs, signal, state, name })`:
   - `root` = Page | Frame | FrameLocator | Locator (iframe dùng được ngay).
   - Mỗi lượt: áp scope → thử từng chiến lược theo thứ tự → lấy chiến lược đầu tiên chỉ ra **đúng 1** phần tử (sau `nth`). Chiến lược khớp nhiều mà không có `nth` (và không có `near`) bị coi là **mơ hồ** → thử chiến lược sau. Có `near` mà không có `nth` → lấy cái gần nhất.
   - Mặc định chỉ tính phần tử **hiển thị** (`state: 'visible'`); `attached` cho input file ẩn…
   - Lặp lại (mặc định 100ms/lượt) đến hết `timeoutMs` → phần tử xuất hiện trễ vẫn tìm được. Selector sai / trang đang chuyển → bỏ qua chiến lược đó ở lượt này.
   - Trả về `{ locator (Playwright, đã ghim .nth), strategy, strategyIndex, stableId, matchCount }` — sau này dùng cho self-heal/cảnh báo "locator yếu".
4. **ID động**: css `#id`, `[id=…]`, `[name=…]` hoặc xpath `//tag[@id='…']` có token biến động (`ctl\d+`, ≥3 chữ số, hex ≥6 có số, chuỗi ngẫu nhiên dài) → sau khi thử nguyên văn thất bại, thử biến thể chỉ khớp phần ổn định: `ctl00_MainContent_ctl42_txtHoTen` → `[id*="_MainContent_"][id$="_txtHoTen"]`. `stableIdSelector()` xuất ra để recorder (M2) ghi sẵn selector ổn định.
5. **Mã lỗi mới**: `ELEMENT_NOT_FOUND` (details: `strategy` đầu tiên, `strategies`, `timeoutMs`, `name?`, `scopeMissing?`, `lastError?`), `ELEMENT_AMBIGUOUS` (thêm `count`). UI dịch thành câu kiểu *"Bước 5: Không tìm thấy nút 'Lưu' sau 10 giây"*.
6. **Phụ thuộc**: `playwright-core` 1.64.1 vào `@kiemi/engine` (đã có trong stack CLAUDE.md §3). Engine thêm lib `DOM` cho callback chạy trong trình duyệt.
7. **Test**: dùng Chrome/Edge có sẵn (`launchTestBrowser`, fallback Chromium tải về). E2E chạy trên trang WebForms của demo-site qua `startDemoServer()` (`@kiemi/demo-site/server`: API + `public/`, cổng ngẫu nhiên, không cần Vite).

## Hệ quả
- Test engine cần trình duyệt Chrome/Edge trên máy/CI (runner GitHub có sẵn Chrome).
- M1-04 gắn page theo session vào `ActionContext`; action dùng `resolveLocator(page, target, { timeoutMs: ctx.timeoutMs, signal: ctx.signal })`.
