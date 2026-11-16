# CLAUDE.md — Kiemi (No-code UI Test Automation)

## Thương hiệu
- Tên sản phẩm: **Kiemi** (từ "kiểm"). Package scope: `@kiemi/*`. File test: `.kiemi.json`. App ID: `app.kiemi.desktop`.
- Slogan: *"Kiemi — Bấm một lần, kiểm mãi mãi."*
- Màu: chàm đậm `#1F2A5C` (chủ đạo), xanh lá pass `#3DDC84`, đỏ fail `#E5484D`, trắng.
- Linh vật: **Cú Kiemi** — cú tròn màu chàm, mắt to, bụng/mỏ là **dấu tick xanh lá** (SPEC U-16).
- Icon: ô vuông bo góc nền chàm có **Cú Kiemi** (dấu tick xanh lá). Phải nhận diện được ở 16px.

> File này được Claude Code tự đọc mỗi phiên. Đây là luật của dự án — tuân thủ tuyệt đối.

## 1. Sản phẩm
Desktop app (Windows + macOS) cho **tester không biết code**: ghi thao tác hoặc soạn bảng step → bấm Chạy → xem kết quả.
Cài là dùng: offline, không cần tài khoản, không cài thêm gì (dùng Edge/Chrome có sẵn trên máy).

Tài liệu nguồn (đọc khi cần):
- `docs/SPEC.md` — toàn bộ yêu cầu, mỗi yêu cầu có ID (vd `B-03`)
- `docs/ROADMAP.md` — danh sách task theo milestone, có checkbox
- `docs/PROGRESS.md` — tiến độ, nhật ký, **task tiếp theo**
- `docs/ARCHITECTURE.md` — kiến trúc, luồng chạy, ranh giới giữa các khối
- `docs/adr/` — các quyết định kiến trúc

## 2. Quy trình mỗi phiên (BẮT BUỘC)
1. Đọc `docs/PROGRESS.md` → mục **"Tiếp theo"**. Đọc các mục SPEC mà task đó tham chiếu.
2. **Mỗi phiên (chat) làm trọn 1 milestone** trong ROADMAP (vd M5): code lần lượt **mọi task chưa xong** của milestone đó, rồi mới test cả milestone một lượt. Không làm sang milestone kế, không làm ngoài phạm vi ROADMAP.
   - Tiết kiệm token: không đọc cả SPEC — chỉ `grep` các ID mà task tham chiếu (vd `grep -E '^\| (A-01|A-02) ' docs/SPEC.md`). Đọc PROGRESS trước, ARCHITECTURE/ADR chỉ khi task đụng tới.
   - Milestone quá lớn cho 1 phiên → dừng ở điểm ổn định (sau 1 task trọn vẹn), commit, ghi chi tiết phần còn lại vào PROGRESS mục **"Đang làm dở"**.
3. Trước mỗi task: nêu kế hoạch ngắn (file tạo/sửa, cách test).
4. **Trong lúc code từng task**: viết kèm test (unit/e2e) của task; chỉ cần `pnpm lint && pnpm typecheck` pass rồi commit local, chưa push.
   **Code xong cả milestone → test cả milestone**: chạy `pnpm lint && pnpm typecheck && pnpm test` (phải pass hết) + kiểm tra luồng chính trên app thật (build, `_electron.launch`) nếu milestone có UI. Sửa lỗi tìm được (commit `fix(...)`).
5. Cập nhật:
   - `docs/ROADMAP.md`: tick `[x]` task đã xong
   - `docs/PROGRESS.md`: thêm dòng nhật ký, cập nhật "Tiếp theo", ghi vấn đề tồn đọng
   - Có quyết định kiến trúc mới → thêm file `docs/adr/NNNN-ten.md`
6. Commit theo Conventional Commits, kèm ID: `feat(engine): add fill action [A-02]`
   - **Tác giả commit = chủ dự án**: `Duy Nguyen Khanh <duynguyen.011202@gmail.com>` (đã đặt trong `git config` của repo). Trước khi commit, kiểm tra `git config user.email` đúng email này.
   - **Không thêm** dòng `Co-Authored-By: Claude …` hay bất kỳ attribution AI nào vào commit/PR.
   - Mỗi task 1 commit. **Test cả milestone pass → `git push`** lên GitHub (`origin`). Chưa có remote `origin` → nhắc người dùng cung cấp URL repo, không tự tạo repo.
   - Không `push --force` lên `main`.
7. Nếu người dùng chỉ nói "làm tiếp" / "continue" → làm task trong mục "Tiếp theo" (hoặc mục "Đang làm dở" nếu có).
8. **Kết thúc phiên**: sau khi push, DỪNG — không tự làm milestone kế. Báo ngắn gọn: đã xong gì, kết quả test, milestone tiếp theo, và nhắc người dùng `/clear` (hoặc mở chat mới) rồi gõ `Làm tiếp.`
9. Chạy tự động không cần mở chat: xem `START-PROMPT.md` (vòng lặp `claude -p "Làm tiếp."`, mỗi lần = 1 phiên mới = 1 milestone).

## 2b. Quy trình thay đổi yêu cầu (BẮT BUỘC)
Khi người dùng đưa yêu cầu mới / muốn sửa / bỏ một yêu cầu (vd "thêm tính năng X", "đổi Y", "bỏ Z"):

1. **Đề xuất, chưa sửa gì**. Trình bày ngắn gọn:
   - Yêu cầu viết lại rõ ràng + **ID mới** (theo mục phù hợp trong SPEC, vd `B-15`) hoặc ID bị sửa/bỏ
   - Ưu tiên đề xuất (v1 / v1.x) + **tiêu chí chấp nhận** (kiểm tra được)
   - **Ảnh hưởng**: yêu cầu nào liên quan/xung đột, task ROADMAP thêm/sửa, có đụng schema DSL (cần migration) hay DB không, có cần ADR không
   - Ước lượng độ lớn: S / M / L
2. **Chờ người dùng chốt** ("chốt", "ok", "đồng ý"). Nếu người dùng sửa → đề xuất lại.
   - Ngoại lệ: người dùng nói rõ "chốt luôn" / "làm luôn" ngay trong yêu cầu → bỏ qua bước chờ.
3. **Sau khi chốt**, cập nhật tài liệu trước, code sau:
   - `docs/SPEC.md`: thêm/sửa/bỏ dòng yêu cầu (bỏ thì gạch ngang `~~…~~` + ghi "Bỏ ngày …", không xóa ID — ID không bao giờ dùng lại)
   - `docs/SPEC.md` mục **Lịch sử thay đổi**: thêm 1 dòng
   - `docs/ROADMAP.md`: thêm/sửa task, đặt đúng milestone theo phụ thuộc
   - `docs/ARCHITECTURE.md` / `docs/adr/` nếu kiến trúc thay đổi
   - `docs/PROGRESS.md`: cập nhật "Tiếp theo" nếu thứ tự ưu tiên đổi
   - Commit riêng: `docs(spec): add B-15 <mô tả>`
4. **Hỏi làm ngay hay xếp hàng**: nếu người dùng muốn làm ngay → làm theo Quy trình mỗi phiên (mục 2) với task mới. Nếu không → để trong ROADMAP.
5. Không bao giờ code một tính năng **chưa có trong SPEC**. Nếu trong lúc code phát hiện cần thêm yêu cầu → dừng, đề xuất theo bước 1.

## 3. Stack (đã chốt — không tự ý thay)
| Phần | Công nghệ |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Ngôn ngữ | TypeScript `strict: true` |
| Lint/format | Biome |
| Desktop | Electron + electron-vite |
| UI | React 19, Tailwind CSS, shadcn/ui, TanStack Table, dnd-kit, Zustand |
| IPC | electron-trpc (type-safe, input validate bằng Zod) |
| DB | SQLite (better-sqlite3) + Drizzle ORM |
| Engine | playwright-core (channel `msedge` / `chrome`, fallback tải Chromium) |
| Schema | Zod (xuất JSON Schema) |
| Excel | exceljs |
| Dữ liệu giả | @faker-js/faker (locale vi) |
| Ngày giờ | date-fns |
| ID | UUIDv7 (`uuid` package) |
| i18n | i18next (vi mặc định, en) |
| Test | Vitest (unit), Playwright Test (e2e engine trên demo-site) |
| Đóng gói | electron-builder + electron-updater |
| Crash report | Sentry (opt-in) |

## 4. Cấu trúc thư mục
```
apps/
  desktop/        # Electron: main/, preload/, renderer/ (React)
  demo-site/      # Web mô phỏng ca khó để test engine (iframe, WebForms postback, popup, bảng, đồng bộ trễ, nhiều vai trò)
packages/
  schema/         # Zod: TestCase, Step, Locator, Dataset, Env, RunResult + migrations DSL
  db/             # SQLite + Drizzle: bảng, migration, service, nhập/xuất (ADR 0008). KHÔNG import electron
  engine/         # Dịch step → Playwright. KHÔNG import electron/DB/React
  recorder/       # Script bắt thao tác + Pick phần tử
  shared/         # util dùng chung (i18n keys, error codes)
docs/
```

## 5. Nguyên tắc bất biến
1. **Step DSL có version**: định nghĩa trong `packages/schema`. Mọi test file có `schemaVersion`. Đổi schema = tăng version + viết migration + test migration với fixture của mọi version cũ.
2. **Engine độc lập**: input `TestCase + Dataset + Env + Secrets` → output `RunResult` + stream event. Chạy trong Electron utility process (crash không kéo sập app). Dùng chung cho desktop và CLI sau này.
3. **Action = plugin**: `defineAction({ type, params: zodSchema, ui: { label, icon, group }, execute })`. UI tự sinh form từ `params` + `ui`. Thêm action = 1 file + unit test + e2e trên demo-site.
4. **Locator nhiều lớp**: mỗi phần tử lưu mảng `strategies` theo ưu tiên (role+name → label → placeholder → text → testId → css → xpath) + `fingerprint` (text, tag, attributes, vị trí) để self-heal sau này.
5. **Nhiều phiên từ đầu**: mỗi step có `session` (mặc định `"default"`); mỗi session = 1 browser context riêng.
6. **DB**: mọi bảng có `id` (UUIDv7), `workspaceId`, `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version`.
7. **Bảo mật Electron**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Renderer chỉ gọi main qua electron-trpc. Secret lưu bằng `safeStorage`. Che secret trong log, kết quả, ảnh chụp.
8. **UI đẹp, đơn giản, dễ dùng**: mọi màn hình tuân thủ mục **U** trong `docs/SPEC.md` (U-01 → U-15). Trước khi làm UI, đọc lại mục U.
   **Làm UI nhanh — dùng đồ có sẵn, không tự thiết kế từ đầu**:
   - Component: lấy từ **shadcn/ui** bằng `pnpm dlx shadcn@latest add <tên>` trong `apps/desktop` (button, input, dialog, dropdown-menu, command, table, tabs, sonner, tooltip, sheet…).
   - Bố cục màn hình: dùng **shadcn Blocks** (vd `sidebar-07` cho layout 3 vùng U-01, `dashboard-01`, `login-0x`) rồi chỉnh màu/chữ theo token sẵn có trong `styles.css`.
   - Bảng: TanStack Table theo mẫu "Data Table" của shadcn. Icon: Lucide. Toast: sonner. Command palette: `command` (cmdk).
   - Chỉ tự viết component khi shadcn không có; không thêm UI kit khác (MUI, Ant…).
   - Demo-site (`apps/demo-site`) là web mục tiêu để test, không cần đẹp — HTML/CSS thuần.
   **UI cho người không biết code**: không hardcode chuỗi (dùng i18n). Không hiện thuật ngữ kỹ thuật (selector, CSS, Playwright) trừ chế độ "Nâng cao". Lỗi phải nói bằng tiếng Việt dễ hiểu: *"Bước 5: Không tìm thấy nút 'Lưu' sau 10 giây"*.
9. **Không thêm dependency lớn** khi chưa ghi lý do vào ADR.

## 6. Definition of Done
- Đáp ứng tiêu chí chấp nhận của các ID SPEC liên quan
- Có test: unit cho schema/engine; e2e trên demo-site cho mỗi action/assertion mới
- `lint`, `typecheck`, `test` pass
- Chuỗi UI có đủ `vi` + `en`
- ROADMAP + PROGRESS đã cập nhật, đã commit

## 7. Quy ước
- Code, tên biến, commit message: **tiếng Anh**. UI, docs: **tiếng Việt**.
- Tên file: kebab-case. Component React: PascalCase.
- Không để `any`, không `// @ts-ignore` khi chưa ghi lý do.
- Mỗi action engine nằm ở `packages/engine/src/actions/<type>.ts`.
