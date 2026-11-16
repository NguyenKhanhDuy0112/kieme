# ADR 0015 — Đóng gói bằng electron-builder, ký code qua biến môi trường, phát hành bằng tag

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M7-01, M7-02, M7-03b

## Bối cảnh
App phải cài được không cần quyền admin (N-13), có bản portable chạy qua RDP (N-10), phát hành tự động từ tag (N-11). Main process đã được electron-vite bundle (gồm cả package `@kiemi/*`), chỉ một số thư viện còn `require()` lúc chạy.

## Quyết định
1. **electron-builder 26** (devDependency của `apps/desktop`, lý do: chuẩn de-facto cho Electron, có sẵn NSIS/portable/dmg + electron-updater cùng hệ). Cấu hình ở `apps/desktop/electron-builder.config.js` (JS để đọc biến môi trường), khóa bằng `src/main/packaging.test.ts`.
2. **Chỉ đóng gói thứ main cần lúc chạy**: `dependencies` của desktop chỉ còn các gói `require()` từ bundle main (`better-sqlite3`, `playwright-core`, `drizzle-orm`, `exceljs`, `fflate`, `ssh2`, `zod`, `@trpc/server`, `electron-trpc`, sau này `electron-updater`, `@sentry/electron`). React, `@kiemi/*`… chuyển sang `devDependencies` (được bundle sẵn). Thêm thư viện mà main `require()` lúc chạy → phải đưa vào `dependencies`.
3. **Native**: `better-sqlite3` 13 mang sẵn prebuild N-API cho mọi OS/arch → `npmRebuild: false`, build chéo Windows từ mac được, bản mac `universal` gộp được (file `.node` giống nhau ở 2 lát). Bỏ prebuild Linux và mã nguồn C khỏi gói.
4. **`playwright-core` để ngoài asar** (`asarUnpack`): Playwright fork script Node (tải Chromium) và đọc file của chính nó.
5. **Trang mẫu** `apps/demo-site/dist` → `resources/sample-site` (`extraResources`), đúng đường main tìm (ADR 0014). `turbo build` đảm bảo demo-site build trước.
6. **Đích**: Windows `nsis` (oneClick, per-user, không xin quyền admin) + `portable` (`requestExecutionLevel: user`), x64. macOS `dmg` + `zip` universal (zip là thứ electron-updater dùng để cập nhật trên mac). Tên file: `Kiemi-Setup-<ver>.exe`, `Kiemi-Portable-<ver>.exe`, `Kiemi-<ver>-universal.dmg`.
7. **Ký code chỉ qua biến môi trường** (M7-02): Windows `CSC_LINK`/`CSC_KEY_PASSWORD` (hoặc `WIN_CSC_*`); macOS `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID Application) + notarize khi có `APPLE_API_KEY`/`APPLE_API_KEY_ID`/`APPLE_API_ISSUER` (hoặc `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`). Không có biến → bản không ký (dùng thử nội bộ). Hardened runtime + `build/entitlements.mac.plist` (JIT cho V8).
8. **Nơi phát hành**: GitHub Releases của repo code `NguyenKhanhDuy0112/kieme` (đang public). Nếu repo chuyển private → đặt `KIEMI_RELEASE_REPO=kiemi-releases` (repo public riêng) + token có quyền ghi repo đó (N-11).
9. **Icon** `apps/desktop/build/icon.svg` (nguồn) → `icon.png` 1024px; electron-builder tự sinh `.ico`/`.icns`.

## Hệ quả
- Bản chưa ký: Windows SmartScreen cảnh báo "Unknown publisher", macOS Gatekeeper chặn mở lần đầu (chuột phải → Mở). Cần chứng chỉ thật trước khi phát hành rộng.
- Build cục bộ: `pnpm --filter @kiemi/demo-site build && pnpm --filter @kiemi/desktop dist` (ra `apps/desktop/release/`, đã gitignore). `dist:dir` chỉ tạo thư mục app để chạy thử nhanh.
