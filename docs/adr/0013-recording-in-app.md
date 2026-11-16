# ADR 0013 — Ghi thao tác trong app: thanh công cụ, Pick/Highlight, đăng nhập đã lưu, gợi ý kiểm tra

**Trạng thái:** Đã chốt · **Ngày:** 2026-11-16 · **Task:** M5-02 → M5-09

## Quyết định
1. **Locator khi ghi** (C-01, C-02): script trang tự tính role + tên truy cập (gần cách Playwright tính cho trường hợp thường gặp), nhãn, placeholder, chữ (phần tử bấm được), `data-testid`, css (`#id`, `[name]`, `[name][value]` cho radio/checkbox, đường dẫn css), xpath. Tất cả `exact: true`. Không lọc trùng trong trang — engine tự bỏ chiến lược khớp nhiều phần tử. Fingerprint: thẻ, chữ, thuộc tính (kể cả `required/maxlength/min/max/pattern` để M5-09 dùng), tối đa 5 chữ lân cận (nhãn, phần tử trước, tiêu đề nhóm, dòng bảng), hộp vị trí. Không lưu `value` của ô mật khẩu.
2. **Giao diện trong trang** nằm trong shadow DOM `<kiemi-recorder data-kiemi-ui>`; sự kiện từ đó không bị ghi. Thanh công cụ chỉ ở frame trên cùng. Chuỗi hiển thị truyền vào từ `@kiemi/shared` (`recorder.*`, theo ngôn ngữ trong Cài đặt).
3. **Chế độ chọn phần tử** (Thêm kiểm tra, Lưu giá trị, Pick): Node bật cho mọi frame của mọi tab; listener ở `window` capture chặn `pointerdown/mousedown/click/…` nên trang không phản ứng; frame được bấm tự hiện menu. Esc hủy.
4. **Highlight** dùng chính `resolveLocator` của engine (cùng kết quả khi chạy); nếu mơ hồ thì vẽ mọi phần tử của chiến lược đầu tiên khớp nhiều, báo số lượng.
5. **Ghi chèn từ bước X** (K-04): engine thêm `options.stopAfterStepId` (dừng sau bước gốc X, bỏ qua dọn dẹp) và `RunOptions.keepSessions` (giao lại các phiên trình duyệt thay vì đóng). Recorder gắn vào context của phiên của bước X. Bắt đầu với đăng nhập đã lưu = chạy trước một bước `useSession`.
6. **Đăng nhập đã lưu** (F-02): bước `saveSession` / `useSession`; `useSession` thêm cookie và đặt localStorage theo origin bằng init script (chỉ khi chưa có). Lưu ở bảng `saved_logins` (mã hóa bằng `SecretCipher`, có `expires_at`). Engine phát event `loginSaved`; RunManager / RecorderManager lưu DB và **không** chuyển event này ra renderer.
7. **Gợi ý kiểm tra** (M-01): sau bấm / Enter / chọn / tick, script theo dõi `MutationObserver` khoảng 1,2 giây → thông báo (`role=alert/status`, class toast…), dòng bảng mới, phần tử nổi bật mới; Node thêm gợi ý địa chỉ trang khi điều hướng do thao tác gây ra. Gợi ý chỉ thành bước khi bấm ✓ (trong trang hoặc trong app), chèn ngay sau thao tác gây ra nó.
8. **Ghi trong app**: phiên ghi chạy trong engine utility process như lần chạy (một process cho mỗi phiên), main có `RecorderManager` (một phiên một lúc). Renderer áp thay đổi trực tiếp vào tài liệu đang mở (`editor.patch`, không tạo lịch sử từng bước) sau một `checkpoint` — một lần Hoàn tác bỏ cả bản ghi.
9. **Hàm thuần cho renderer** ở entry `@kiemi/recorder/pure` (không kéo playwright-core): "Biến thành dữ liệu" (chỉ với bảng dữ liệu nhập tay; giá trị ghi được đổ vào mọi dòng đang có), biến thể form (theo kiểu ô/thuộc tính/nhãn), tên bí mật gợi ý.

## Hệ quả
- Tên truy cập tự tính có thể khác Playwright ở ca hiếm → chiến lược đầu không khớp, engine dùng chiến lược sau (không lỗi).
- Gợi ý theo heuristic (thời gian, selector thông báo) — có thể sót hoặc thừa; người dùng luôn phải bấm ✓.
- `recorder` phụ thuộc `engine` (dùng `resolveLocator`); engine không được phụ thuộc ngược lại.
