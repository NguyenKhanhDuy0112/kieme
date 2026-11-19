# Hướng dẫn sử dụng Kiemi

> *Kiemi — Let Kiemi do the checking.*
> Kiemi giúp bạn kiểm thử trang web mà không cần viết code: **ghi lại** thao tác của bạn (hoặc soạn từng bước), bấm **Chạy**, rồi xem kết quả.

Mục lục
1. [Cài đặt](#1-cài-đặt)
2. [Lần đầu mở Kiemi](#2-lần-đầu-mở-kiemi)
3. [Tạo test bằng cách ghi lại](#3-tạo-test-bằng-cách-ghi-lại)
4. [Sửa các bước](#4-sửa-các-bước)
5. [Môi trường, biến và bí mật](#5-môi-trường-biến-và-bí-mật)
6. [Chạy với nhiều dòng dữ liệu](#6-chạy-với-nhiều-dòng-dữ-liệu)
7. [Chạy test và xem kết quả](#7-chạy-test-và-xem-kết-quả)
8. [Bộ test, tag và lịch sử](#8-bộ-test-tag-và-lịch-sử)
9. [Chia sẻ test](#9-chia-sẻ-test)
10. [Cập nhật, sao lưu và báo lỗi](#10-cập-nhật-sao-lưu-và-báo-lỗi)
11. [Câu hỏi thường gặp](#11-câu-hỏi-thường-gặp)

---

## 1. Cài đặt

Tải bản mới nhất ở trang **Releases** của Kiemi. Không cần tài khoản, không cần cài thêm gì, không cần quyền quản trị.

| Máy | File | Ghi chú |
|---|---|---|
| Windows | `Kiemi-Setup.exe` | Bấm đúp là cài xong (chỉ cho tài khoản của bạn). Có biểu tượng Kiemi ngoài màn hình. |
| Windows (không cài được) | `Kiemi-Portable.exe` | 1 file, không cần cài — chép vào máy (kể cả máy chỉ vào được qua Remote Desktop) rồi bấm đúp. |
| macOS | `Kiemi-mac.dmg` | Mở file, kéo Kiemi vào thư mục **Applications**. Chạy cả máy chip Intel và Apple. |

**Trình duyệt**: Kiemi dùng Microsoft Edge hoặc Google Chrome có sẵn trên máy. Máy không có cả hai thì lần chạy đầu Kiemi tự tải một trình duyệt (khoảng 150 MB, chỉ một lần).

Nếu máy cảnh báo khi mở lần đầu:
- Windows hiện *"Windows protected your PC"*: bấm **More info → Run anyway**.
- macOS báo *"không thể mở vì không xác định được nhà phát triển"*: chuột phải vào Kiemi → **Mở** → **Mở**.

## 2. Lần đầu mở Kiemi

Màn hình chào mừng cho bạn 2 lựa chọn:
- **Ghi thao tác**: nhập địa chỉ trang bạn muốn kiểm thử → Kiemi tạo "Test đầu tiên" và mở trình duyệt để ghi.
- **Mở test mẫu**: Kiemi tạo **Dự án mẫu** với vài test chạy được ngay (không cần mạng). Mở một test và bấm **Chạy** để xem Kiemi làm việc thế nào.

Sau đó có một hướng dẫn ngắn 3 bước. Muốn xem lại: **Cài đặt → Hướng dẫn**.

Màn hình chính chia 3 vùng: bên trái là menu (**Test, Lịch sử, Môi trường, Phần tử, Cài đặt**) và cây test; ở giữa là bảng các bước; bên phải là chi tiết bước đang chọn. Nhấn **Ctrl K** (macOS: **⌘ K**) để tìm nhanh test hoặc lệnh.

## 3. Tạo test bằng cách ghi lại

1. Ở cây test, bấm **Test mới**, đặt tên.
2. Bấm **Ghi lại**, nhập trang bắt đầu (để trống = địa chỉ của môi trường đang chọn).
3. Kiemi mở trình duyệt. Bạn thao tác như bình thường: bấm, gõ, chọn… Mỗi thao tác thành **một bước** trong bảng.
4. Trên thanh công cụ của trình duyệt đang ghi, bạn có thể **chọn phần tử để kiểm tra** (vd "chữ *Đã lưu* phải hiện ra"). Kiemi cũng **gợi ý kiểm tra** khi thấy trang thay đổi — bấm để nhận, bỏ qua nếu không cần.
5. Gõ vào ô mật khẩu? Kiemi đề nghị lưu thành **bí mật** để mật khẩu không nằm trong test.
6. Bấm **Dừng ghi**. Không ưng? **Hoàn tác** (Ctrl Z) bỏ cả lần ghi.

Mẹo:
- **Ghi chèn**: muốn thêm thao tác vào giữa test, chọn bước rồi ghi — Kiemi chạy các bước trước đó rồi mới ghi tiếp.
- **Biến thành dữ liệu**: sau khi ghi một form, Kiemi đề nghị đưa các giá trị đã gõ ra bảng dữ liệu để chạy với nhiều bộ giá trị (xem mục 6). Kiemi cũng có thể sinh sẵn các trường hợp sai/biên (bỏ trống, quá dài…).
- **Đăng nhập một lần**: dùng bước *Lưu đăng nhập* rồi *Dùng đăng nhập đã lưu* ở các test khác để khỏi đăng nhập lại mỗi lần.

## 4. Sửa các bước

- Mỗi bước đọc như một câu: *Bấm vào* `Nút Lưu`, *Nhập* `Ô Họ tên` = `Nguyễn Văn An`. Bấm vào bước để sửa ở panel bên phải.
- **Thêm bước**: chọn loại thao tác (mở trang, nhập, bấm, chọn, kiểm tra, chờ, gọi API, lặp, điều kiện…).
- **Kéo** tay nắm bên trái để đổi thứ tự; **tắt** một bước để tạm bỏ qua mà không xóa.
- **Phần tử**: chọn từ *Phần tử đã lưu* hoặc tìm theo chữ hiển thị, nhãn ô, chữ gợi ý. Nút **Chọn trên trang** cho bạn bấm thẳng vào phần tử trên trình duyệt; nút **Hiện trên trang** cho bạn xem Kiemi đang hiểu phần tử nào.
- **Kiểm tra mềm**: bước kiểm tra lỗi vẫn ghi nhận nhưng test chạy tiếp.
- Kiemi **tự lưu**. Ctrl Z / Ctrl Shift Z để hoàn tác / làm lại.
- **Chế độ Nâng cao** (Cài đặt): hiện cách tìm kỹ thuật (CSS, XPath, mã kiểm thử) cho người đã quen.

## 5. Môi trường, biến và bí mật

Vào **Môi trường** để tạo môi trường (vd *Thử nghiệm*, *Chính thức*):
- **Địa chỉ gốc**: các bước *Mở trang* chỉ cần ghi `/login.html`.
- **Biến**: giá trị dùng chung, viết trong ô bằng `{{tenBien}}`.
- **Bí mật** (mật khẩu, token): được mã hóa bằng khóa của hệ điều hành, không bao giờ hiện lại, bị che trong kết quả, ảnh chụp và báo cáo. Dùng bằng `{{secret.tenBiMat}}`.
- **Proxy / SSH**: khi trang chỉ vào được qua mạng nội bộ. Có nút *Kiểm tra kết nối*.

Trong ô giá trị, gõ `{{` để thấy **Gợi ý biến**: biến môi trường, biến của test, cột dữ liệu, bí mật và giá trị tự sinh (họ tên Việt Nam, số điện thoại, email, *Hôm nay + 3 ngày*…).

## 6. Chạy với nhiều dòng dữ liệu

Tab **Dữ liệu** của test: nhập bảng tay hoặc **Nhập từ Excel/CSV**. Mỗi dòng là một lần chạy; dùng giá trị bằng `{{tenCot}}`. Bộ dữ liệu đã nhập có thể dùng lại cho nhiều test trong dự án.

## 7. Chạy test và xem kết quả

- Bấm **Chạy**. Mở **Tùy chọn chạy…** để chọn môi trường, chạy chậm, hiện cửa sổ trình duyệt, chạy từng bước, chụp ảnh, quay video, ghi trace. Lựa chọn được nhớ cho lần sau.
- Trong lúc chạy: **Tạm dừng / Tiếp tục / Bước tiếp / Dừng**. Đặt **điểm dừng** trước một bước để dừng lại xem trang.
- Kết quả từng bước: **Đạt** / **Không đạt** / **Bỏ qua**, kèm thời gian. Bước lỗi có lời giải thích dễ hiểu, vd *"Bước 5: Không tìm thấy nút 'Lưu' sau 10 giây"* và gợi ý cách sửa, cùng ảnh chụp có khoanh đỏ chỗ lỗi.
- **Xem lại từng thao tác (trace)**: tua lại từng bước — trang lúc đó, mạng, nhật ký.
- **Xuất báo cáo**: file HTML gửi được cho người khác. **Mở thư mục kết quả**: ảnh, video, trace.

## 8. Bộ test, tag và lịch sử

- **Bộ test**: gom nhiều test chạy theo thứ tự, có môi trường mặc định. Hoặc **Chạy theo tag** để chạy mọi test gắn tag đó.
- **Nhiều vai trò trong một test**: tab **Phiên** — mỗi phiên là một người dùng riêng (vd *nhân viên* tạo đơn → *quản lý* duyệt).
- **Lịch sử**: mọi lần chạy, lọc theo test/bộ test/kết quả. Chọn 2 lần chạy → **So sánh 2 lần chạy** để thấy bước nào khác nhau.

## 9. Chia sẻ test

**Xuất** một test ra file `.kiemi.json`, hoặc cả dự án / bộ test ra `.zip`, rồi gửi cho đồng nghiệp **Nhập** vào máy họ. Bí mật **không** được xuất — người nhận tự nhập bí mật của họ trong Môi trường.

## 10. Cập nhật, sao lưu và báo lỗi

- **Tự cập nhật**: mỗi khi mở, Kiemi kiểm tra bản mới và tải ngầm. Khi xong, nút **Có bản mới** hiện trên thanh tiêu đề — bấm để xem **Có gì mới** và **Khởi động lại để cập nhật**. Test, kết quả và cài đặt được giữ nguyên. Bản portable và bản macOS hiện tại chỉ báo có bản mới: bấm **Tải bản mới**, rồi dùng file portable mới thay file cũ (Windows) hoặc kéo Kiemi mới vào Applications để thay bản cũ (macOS). Kiểm tra bằng tay: **Cài đặt → Cập nhật → Kiểm tra cập nhật**.
- **Dữ liệu nằm ở đâu**: Windows `%APPDATA%\Kiemi`, macOS `~/Library/Application Support/Kiemi` (file `kiemi.db`, thư mục `runs` chứa kết quả). Trước mỗi lần nâng cấp cấu trúc dữ liệu, Kiemi tự lưu một bản sao vào thư mục `backups`.
- **Báo lỗi ẩn danh** (mặc định **tắt**): bật ở **Cài đặt → Gửi báo cáo lỗi ẩn danh** để gửi thông tin kỹ thuật khi Kiemi gặp lỗi. Kiemi không gửi test, dữ liệu, địa chỉ trang, mật khẩu hay tên máy. Có hiệu lực từ lần mở tiếp theo.

## 11. Câu hỏi thường gặp

**Test không đạt vì "Không tìm thấy phần tử"?**
Trang có thể đã đổi chữ hoặc bố cục. Mở bước lỗi, bấm **Hiện trên trang** để xem Kiemi tìm gì, rồi **Chọn trên trang** để chọn lại. Nếu trang tải chậm, tăng *Thời gian chờ tối đa* của bước (hoặc mặc định ở Cài đặt).

**Trang hiện kết quả sau vài giây/phút (đồng bộ trễ)?**
Dùng bước *Chờ đến khi* — Kiemi kiểm tra lại theo chu kỳ (có thể tải lại trang) đến khi điều kiện đúng.

**Không thấy cửa sổ trình duyệt khi chạy?**
Tắt *Chạy ngầm* trong Cài đặt, hoặc bật *Hiện cửa sổ trình duyệt* trong Tùy chọn chạy.

**Đổi ngôn ngữ / giao diện tối?**
**Cài đặt → Giao diện**: Tiếng Việt / English, Sáng / Tối / Theo hệ thống.

**Máy không có mạng?**
Kiemi chạy hoàn toàn offline. Chỉ cần mạng để tải trình duyệt lần đầu (khi máy không có Edge/Chrome), kiểm tra cập nhật, và tất nhiên để vào trang bạn kiểm thử.
