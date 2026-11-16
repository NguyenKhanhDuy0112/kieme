# ADR 0002 — IPC bằng electron-trpc + TanStack Query

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M0-03

## Bối cảnh
- Renderer chạy `sandbox: true`, `contextIsolation: true` (CLAUDE.md §5.7) → không được truy cập Node/Electron.
- Cần IPC type-safe, input được validate (stack đã chốt: electron-trpc + Zod).

## Quyết định
1. **electron-trpc 1.0** (hỗ trợ tRPC v11, Electron ≥ 35). Router đặt ở `apps/desktop/src/main/api/`, **không import Electron** để unit test bằng `createCaller`.
2. **Preload của chính app** gọi `exposeElectronTRPC()`; main dùng `createIPCHandler({ preload: false })`. electron-trpc được **bundle vào preload** (preload sandbox không `require` được gói ngoài, chỉ `electron`). Đây là cầu nối duy nhất (`window.electronTRPC`).
3. **Giới hạn người gọi**: `allow` chỉ chấp nhận request từ `file://…/renderer/index.html` của app hoặc origin dev server (`ELECTRON_RENDERER_URL`, chỉ khi chưa đóng gói). Trang khác → `FORBIDDEN`. Quan trọng vì sau này app có thể nạp nội dung web bên ngoài.
4. **TanStack Query** (`@tanstack/react-query` + `@trpc/tanstack-react-query`) làm lớp gọi/caching phía renderer. Thêm dependency mới vì: cache + trạng thái loading/error chuẩn (U-09 phản hồi tức thì), là tích hợp chính thức của tRPC v11; Zustand vẫn dùng cho state UI thuần.
5. Context tRPC (`ApiContext`) chỉ dùng kiểu thuần (vd `platform: string`) để renderer import `type AppRouter` mà không cần kiểu Node.

## Hệ quả
- Thêm procedure = thêm router con trong `src/main/api/routers/` + gắn vào `root.ts` + unit test qua `createCaller`.
- Chưa dùng transformer (superjson); khi cần truyền `Date`/`Map` thì bổ sung ở cả `createIPCHandler`… và `ipcLink`.
