# ADR 0017 — Linh vật Cú Kiemi, chuyển động và màn hình khởi động

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-19 · **Task:** M8-01 → M8-05

## Quyết định
1. **Linh vật = SVG vẽ trong code** (`components/mascot/mascot.tsx`), không dùng ảnh/thư viện: 4 biểu cảm (`idle`, `happy`, `worried`, `focused`), màu lấy từ biến CSS `--mascot-*` nên tự đổi theo sáng/tối, luôn `aria-hidden` (minh họa không thay chữ). `moodForStatus(status)` ánh xạ trạng thái lần chạy → biểu cảm. Mọi chỗ dùng chung một component: thay bản vẽ của designer sau này chỉ sửa một file.
2. **Icon app** `build/icon.svg`: nền chàm, cú màu sáng hơn (`#5B6CD6`) chiếm gần trọn ô để còn nhận ra mắt + dấu tick ở 16px.
3. **Chuyển động chỉ bằng CSS** (`renderer/src/motion.css`, cộng `tw-animate-css` có sẵn) — không thêm `motion`/Framer (~40 KB). Chỉ animate `transform`/`opacity` (và `box-shadow` cho viền "thở" của bước đang chạy) để giữ 60 khung hình/giây với test 200 bước. Lớp dùng: `screen-enter`, `panel-enter`, `status-pop`, `welcome-mascot`, `mascot-*`.
4. **Giảm chuyển động**: một quy tắc chung đặt thời lượng animation/transition ≈ 0 khi `prefers-reduced-motion: reduce` **hoặc** `html[data-reduce-motion]` (cài đặt `reduceMotion`). Giá trị được nhớ thêm trong `localStorage` để áp ngay lúc khởi động, trước khi đọc DB. Test kiểm cả `motion.css` và `splash.css` đều có hai quy tắc này.
5. **Splash** nằm trong `index.html` + `public/splash.css` (HTML/CSS thuần, sơn trước khi React nạp); cửa sổ có `backgroundColor` trùng màu splash nên không nháy trắng. `hideSplash()` (`lib/splash.ts`) tắt khi cài đặt đã nạp: tối thiểu 1,8 s (xem trọn hiệu ứng mở đầu; trước là 0,5 s nhưng người dùng thấy quá nhanh), lần đầu thêm 1,4 s cho cú vẫy "Xin chào!" rồi mờ dần vào hộp thoại chào mừng; lưới an toàn 10 s. Slogan trên splash viết cứng tiếng Việt (slogan thương hiệu, có trước i18n); chữ "Xin chào!" lấy từ i18n.
6. **Token** (U-12): bo góc 10px (control) / 16px (card); nền trạng thái pastel `--{pass,fail,warning,info}-soft`, chữ trên đó dùng `*-text` / `primary` — có trong test tương phản AA.

## Hệ quả
- Splash giữ app tới tối đa ~1,8 s tính từ lúc trang bắt đầu nạp, kể cả khi app đã sẵn sàng sớm hơn — vẫn trong giới hạn ≤ 3 s của N-05; app chậm hơn thì không bị cộng thêm gì.
- Thêm animation mới → đặt trong `motion.css` (để quy tắc giảm chuyển động phủ tới), chỉ dùng `transform`/`opacity`.
