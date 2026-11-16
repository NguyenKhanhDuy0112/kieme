# ADR 0007 — Engine runtime: biến, step lồng nhau, điều kiện, chẩn đoán, artifacts

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M1-05 → M1-15

## Bối cảnh
M1 cần: nhiều phiên (F-01, A-16), biến & biểu thức (E-01…E-08), toàn bộ action v1 (A-01…A-18), assertion (B-01…B-11), luồng (D-01…D-06), API (F-03), lỗi console/mạng (F-04), ảnh/video/trace (I-01…I-03), lỗi tiếng Việt (I-04, N-06).

## Quyết định
1. **Schema (vẫn v1, chỉ thêm trường tùy chọn — lý do như ADR 0005)**: `TestCase.variables`, `Step.skipIf`, `StepResult.children`, `RunResult.artifacts`, `RunResult.diagnostics`, `SharedStep { id, name, params[], steps[] }` (lưu ở DB, truyền vào `RunRequest.sharedSteps`).
2. **Biến** (`VariableStore`): `{{…}}` ở mọi giá trị; chuỗi chỉ gồm 1 `{{expr}}` giữ nguyên kiểu (số, object). Tra tên trần: runtime → khung loop/shared → test → suite → env. Không gian tên: `env.`, `secret.`, `row.`, `param.`, `loop.`, `fake.`. Biến môi trường được mở rộng **lười** (getter) để biến tham chiếu nhau không lặp vô hạn.
   - Biểu thức tự viết (không `eval`): số, chuỗi, đường dẫn (`resp.body.items[0].id`), `+ - * / % × ÷`, `&` nối chuỗi, hàm (`round`, `random`, `randomString`, `format`, `date`…), thời lượng (`today + 3d`, `now - 2h`), định dạng sau `|` (`{{today | yyyy-MM-dd}}`). `+` cộng số nếu hai vế là số (kể cả `"1.000.000"`), ngược lại nối chuỗi.
   - Ngày mặc định `dd/MM/yyyy`, tuần bắt đầu thứ Hai; số hiểu `1.000.000`, `1,000.50`, `12,5`.
3. **Action**: `defineAction` thêm `rawParams` (khóa chứa step con / điều kiện, không thay biến trước) và `container` (if/loop/call/waitUntil/wait — không bị giới hạn bởi timeout của step). `ActionContext` có `vars`, `run` (testCase, env, sessions, dialogs, diagnostics, `url()` theo baseUrl), `resolve(target)` (tìm trong **mọi frame**, main frame trước — A-15), `runSteps(steps, frame)`, `markSecret(locator)`, `remainingMs()`, `stepNo` (`5` / `5.2`).
4. **Target** của action: `{ref}` | locator đầy đủ | viết tắt `{text}`, `{label}`, `{placeholder}`, `{role,name}`, `{testId}`, `{css}` (kèm `nth`).
5. **Step con**: lỗi cứng ở step con → step cha fail với **cùng lỗi** (`StepFailure`); lỗi mềm được ghi, chạy tiếp. Step con không ghi `session` thì theo step cha; step dùng chung ở session `default` thì theo session của bước `call`. Event `stepStart/stepEnd` có `parentStepId`, `stepNo`.
6. **Điều kiện** (if / waitUntil / skipIf): `{ assert: <check>, ... }`, `{ variable, op, value }`, `{ not }`, `{ all: [] }`, `{ any: [] }`. Mỗi assertion là 1 *check* chạy 1 lần; step `assertX` thử lại mỗi 200ms đến hết thời gian của step; điều kiện chỉ thử 1 lần (phần tử không có = `false`).
7. **Tab/popup** (A-13): tab mới do trang mở tự thành tab đang dùng. **Dialog** (A-14): mặc định chấp nhận để luồng chạy tiếp; bước `dialog` đặt trước câu trả lời cho dialog kế tiếp của session; nội dung lưu vào `{{dialogMessage}}`.
8. **Chẩn đoán** (F-04): ghi lỗi console, lỗi JS, phản hồi ≥ 400 vào `RunResult.diagnostics`; `failOnConsoleError` / `failOnHttpError` làm step fail. Bỏ qua dòng console "Failed to load resource" (đã tính ở mục mạng) và `/favicon.ico`.
9. **Artifacts** (I-01…I-03): `options.artifacts = { dir, screenshots: onFailure|always|off, video, trace }`. Ảnh chụp khoanh đỏ (`outline #E5484D`) phần tử của step; video/trace theo session. Quay video cần ffmpeg của Playwright → `ensureFfmpeg()` tự cài (~1 MB) lần đầu; lỗi thì tắt video + cảnh báo, không làm hỏng run.
10. **Secret** (E-08): thay giá trị secret bằng `••••` trong log, lỗi, details, event; ảnh chụp che ô đã nhập secret và chữ trùng secret.
11. **Lỗi cho người dùng** (I-04, N-06): `@kiemi/shared` `describeRunError(error, t)` → `{ message: "Bước 5: Không tìm thấy nút “Lưu” sau 10 giây.", hint }`; không bao giờ hiện selector/CSS.
12. Resolver dừng sớm hơn timeout của step 150ms để lỗi "không tìm thấy" (rõ nghĩa) thắng lỗi "hết giờ".

## Hệ quả
- `@kiemi/engine` thêm `@faker-js/faker`, `date-fns`, `uuid` (đã có trong stack CLAUDE.md §3).
- Lint: tắt `useDomNodeTextContent` cho engine (cố ý dùng `innerText` = chữ người dùng thấy).
- Tham số của `if` là `steps` / `elseSteps` (không dùng `then` để object không bị coi là Promise).
- E2E dùng `startDemoSite()` (Vite thật, cổng ngẫu nhiên) từ `@kiemi/demo-site/server`.
