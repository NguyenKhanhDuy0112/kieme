# ADR 0003 — Step DSL v1 và framework migration

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M1-01

## Bối cảnh
- N-08: file `.kiemi.json` có `schemaVersion`; file cũ phải luôn mở và chạy được trên app mới.
- C-01/C-02: phần tử lưu nhiều chiến lược theo ưu tiên + fingerprint.
- Action là plugin (CLAUDE.md §5.3) → schema chung không thể biết hết `params` của từng action.

## Quyết định
1. `packages/schema` chỉ phụ thuộc **zod 4** (cùng bản với desktop). Mọi kiểu xuất ra qua `z.infer`.
2. **Step**: `{ id, action, params, session="default", name?, note?, enabled=true, mode="hard"|"soft", timeoutMs? }`. `params` để mở (`record<string, unknown>`) — mỗi action tự validate bằng schema `params` của `defineAction` (M1-02).
3. **Phần tử**: `elements` là map `ref → { name, strategies[], fingerprint? }` trong TestCase. Step trỏ tới bằng `{ "ref": "el_x" }` hoặc locator nội tuyến `{ "strategies": [...] }` (không được trộn). Chiến lược là union theo `kind` (`role`/`label`/`placeholder`/`text`/`testId`/`css`/`xpath`), thứ tự trong mảng = thứ tự thử. Ngữ cảnh / thứ N / ID động thêm ở M1-03.
4. **Ràng buộc chéo** chỉ có ở Zod (`superRefine`): id step không trùng (kể cả cleanup), `session` phải khai báo trong `sessions`, `ref` phải tồn tại trong `elements`.
5. **Migration**: `createMigrator(current, migrations)` chạy lần lượt `vN → vN+1` trên JSON thô (bản sao), rồi `TestCaseSchema.parse`. Lỗi có mã: `NOT_AN_OBJECT`, `MISSING_VERSION`, `NEWER_VERSION` (file của app mới hơn → báo người dùng cập nhật app), `NO_MIGRATION_PATH`.
6. **Fixture**: `packages/schema/fixtures/vN/*.kiemi.json`. Test bắt buộc có thư mục cho mọi version ≤ hiện tại, và mọi fixture phải mở được qua `parseTestCase`. **Không bao giờ sửa fixture cũ** khi đổi schema.
7. **JSON Schema** (draft 2020-12, góc nhìn người viết file: trường có default là tùy chọn) sinh bằng `z.toJSONSchema`, commit ở `packages/schema/json-schema/test-case.schema.json` (snapshot test, cập nhật bằng `pnpm --filter @kiemi/schema test -u`; Biome bỏ qua thư mục này). File test có thể ghi `"$schema"` để editor gợi ý.

## Hệ quả
- Đổi schema: tăng `CURRENT_SCHEMA_VERSION`, đổi `schemaVersion` literal, thêm `{ from: N, migrate }` vào `MIGRATIONS`, thêm `fixtures/vN+1/`, chạy `test -u` để cập nhật JSON Schema.
- Lỗi `params` chỉ phát hiện khi engine/UI validate theo action, không phải lúc parse file.
