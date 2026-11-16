# SPEC — Kiemi (No-code UI Test Automation)

Ưu tiên: **v1** = bản phát hành đầu tiên · **v1.x** = bổ sung sau.
Mỗi yêu cầu có ID để ROADMAP, commit và test tham chiếu.

---

## 0. Mục tiêu & yêu cầu phi chức năng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| N-01 | Người mới cài app → chạy được test đầu tiên trong **≤ 5 phút** | v1 |
| N-02 | Chạy offline hoàn toàn, không cần tài khoản | v1 |
| N-03 | Không bắt cài thêm phần mềm: dùng Edge/Chrome có sẵn; không có thì tự tải Chromium (có thanh tiến trình) | v1 |
| N-04 | Windows 10+ và macOS 12+ | v1 |
| N-05 | App mở trong ≤ 3 giây; UI không đứng khi đang chạy test (engine chạy tiến trình riêng) | v1 |
| N-06 | Toàn bộ UI tiếng Việt (có tiếng Anh); lỗi giải thích bằng ngôn ngữ người không biết code | v1 |
| N-07 | Secret (mật khẩu, token) mã hóa bằng keychain hệ điều hành, không lộ trong log/ảnh/báo cáo | v1 |
| N-08 | Test file có `schemaVersion`; file cũ luôn mở và chạy được trên app mới | v1 |
| N-09 | Tự cập nhật app; báo lỗi crash (opt-in) | v1 |
| N-11 | **Phát hành tự động**: push tag `vX.Y.Z` → GitHub Actions build Win/Mac/portable, ký code, upload lên GitHub Releases (repo public `kiemi-releases` nếu repo code private) | v1 |
| N-12 | **Tự cập nhật không cần tải lại**: kiểm tra khi mở app, tải ngầm, hiện "Có gì mới" + nút "Khởi động lại để cập nhật"; dữ liệu giữ nguyên; DB migration tự chạy khi mở bản mới. Bản portable: chỉ thông báo có bản mới | v1 |
| N-13 | **Không cần cài thêm gì**: không cần quyền admin (cài per-user), không cần Node/Playwright/tài khoản; trình duyệt dùng Edge/Chrome có sẵn hoặc tự tải 1 lần | v1 |
| N-10 | Có bản **portable** cho Windows (1 file .exe, không cần cài, không cần quyền admin) để chạy trực tiếp trên máy/server chỉ truy cập được qua RDP | v1 |

---

## 1. Màn hình
| ID | Màn hình | Nội dung | Ưu tiên |
|---|---|---|---|
| S-01 | Trang chủ / Danh sách | Project → Thư mục → Test case / Suite; tạo, sửa, xóa, nhân bản, tìm kiếm, tag | v1 |
| S-02 | Soạn test | Nút Ghi lại; bảng step (thêm, sửa, xóa, kéo thả, tắt/bật step); panel thuộc tính step; tab Dữ liệu, Biến | v1 |
| S-03 | Chạy test | Trình duyệt chạy thật; panel tiến độ từng step realtime; nút Dừng / Tạm dừng / Bước tiếp | v1 |
| S-04 | Kết quả | Pass/fail từng step, thời gian, ảnh chụp, video, trace; nút Xuất báo cáo | v1 |
| S-05 | Lịch sử chạy | Danh sách các lần chạy, lọc theo test/suite/trạng thái, so sánh 2 lần chạy | v1 |
| S-06 | Môi trường & Secret | Khai báo môi trường (UAT, Staging…) với baseURL, biến, tài khoản | v1 |
| S-07 | Cài đặt | Ngôn ngữ, trình duyệt mặc định, timeout mặc định, thư mục lưu kết quả | v1 |
| S-08 | Onboarding | Lần mở đầu: nhập URL → Ghi lại → Chạy; kèm test mẫu | v1 |

---

## U. Nguyên tắc giao diện (áp dụng cho MỌI màn hình)
| ID | Nguyên tắc | Ưu tiên |
|---|---|---|
| U-01 | **Bố cục 3 vùng**: sidebar trái (Test, Lịch sử, Môi trường, Phần tử, Cài đặt) · vùng chính · panel chi tiết bên phải (ẩn/hiện được) | v1 |
| U-02 | **Mỗi màn hình 1 hành động chính** nổi bật (Ghi lại / Chạy / Lưu), các hành động phụ nhẹ hơn hoặc nằm trong menu "…" | v1 |
| U-03 | **Step đọc như câu tiếng Việt**: `Bấm vào [nút Lưu]`, `Nhập [Mã NV] = 003609`, `Kiểm tra [thông báo] chứa "Thành công"` — phần tử và giá trị hiển thị dạng chip bấm được | v1 |
| U-04 | **Ẩn dần độ phức tạp**: mặc định chỉ hiện ô cần thiết; tùy chọn nâng cao (timeout, selector, retry) nằm trong mục "Nâng cao" thu gọn | v1 |
| U-05 | **Không thuật ngữ kỹ thuật** ở chế độ thường (không selector, CSS, XPath, Playwright, DOM) | v1 |
| U-06 | **Trạng thái rỗng có hướng dẫn**: màn hình trống luôn có minh họa + 1 câu giải thích + nút hành động ("Chưa có test nào — Ghi test đầu tiên") | v1 |
| U-07 | **Màu theo ý nghĩa, nhất quán**: xanh lá = pass, đỏ = fail, chàm = đang chạy/chính, vàng = cảnh báo/flaky, xám = bỏ qua. Luôn kèm icon/chữ, không chỉ dựa vào màu | v1 |
| U-08 | **Undo thay cho hộp thoại xác nhận**: xóa → toast "Đã xóa · Hoàn tác" (trừ thao tác không hoàn tác được) | v1 |
| U-09 | **Phản hồi tức thì**: mọi thao tác có phản hồi < 100ms (loading skeleton, trạng thái nút); không màn hình đứng | v1 |
| U-10 | **Phím tắt + Command palette** (Ctrl/Cmd+K): tìm test, chạy, tạo mới; phím tắt hiện trong tooltip | v1 |
| U-11 | **Sáng / Tối / Theo hệ thống** | v1 |
| U-12 | **Design tokens**: font *Be Vietnam Pro* (hiển thị dấu tiếng Việt đẹp), lưới 8px, bo góc 8px (control) / 12px (card), viền mảnh, không gradient/bóng đổ nặng; icon Lucide (đi kèm shadcn/ui) | v1 |
| U-13 | **Khả năng tiếp cận**: tương phản WCAG AA, điều khiển được bằng bàn phím, focus ring rõ, cỡ chữ tối thiểu 13px | v1 |
| U-14 | **Hướng dẫn tại chỗ**: tooltip giải thích ngắn cho từng hành động; tour 3 bước ở lần đầu | v1 |
| U-15 | **Kiểm tra cảm nhận**: người chưa từng dùng phải tạo + chạy được test đầu tiên mà không cần hỏi ai (đo bằng N-01) | v1 |

---

## A. Hành động (Actions)
| ID | Hành động | Ghi chú | Ưu tiên |
|---|---|---|---|
| A-01 | Mở URL | Hỗ trợ đường dẫn tương đối theo baseURL của môi trường | v1 |
| A-02 | Nhập | Ô text, textarea, contenteditable; tùy chọn xóa trước khi nhập | v1 |
| A-03 | Xóa nội dung ô | | v1 |
| A-04 | Bấm / Bấm đúp / Bấm chuột phải | | v1 |
| A-05 | Hover | | v1 |
| A-06 | Chọn dropdown | `<select>` và dropdown tự làm (div/li); chọn theo text/giá trị/vị trí | v1 |
| A-07 | Tick / Bỏ tick / Chọn radio | | v1 |
| A-08 | Chọn ngày | Gõ trực tiếp hoặc thao tác date picker | v1 |
| A-09 | Nhấn phím / Tổ hợp phím | Enter, Tab, Esc, Ctrl+S… | v1 |
| A-10 | Cuộn tới phần tử / cuộn trang | | v1 |
| A-11 | Upload file | File cố định hoặc từ dữ liệu test | v1 |
| A-12 | Tải lại / Quay lại / Tiến tới | | v1 |
| A-13 | Tab: mở mới, chuyển, đóng | Tự bắt tab/popup mới mở | v1 |
| A-14 | Hộp thoại alert/confirm/prompt | Chấp nhận / Hủy / nhập text | v1 |
| A-15 | Iframe | Tự phát hiện phần tử trong iframe (kể cả lồng nhau) | v1 |
| A-16 | Đổi phiên | Chuyển sang session A/B/C | v1 |
| A-17 | Xóa cookie / storage | | v1 |
| A-18 | Chờ cố định (giây) | Khuyên dùng hạn chế, UI cảnh báo | v1 |
| A-19 | Kéo thả | | v1.x |
| A-20 | Tải file về | Lưu file để kiểm tra ở B-13 | v1.x |

## B. Kiểm tra (Assertions)
| ID | Kiểm tra | Ưu tiên |
|---|---|---|
| B-01 | Hiển thị / Không hiển thị / Không tồn tại | v1 |
| B-02 | Trạng thái: enabled/disabled, checked, required, readonly | v1 |
| B-03 | Text: bằng, chứa, bắt đầu bằng, kết thúc bằng, regex, không chứa (tùy chọn bỏ qua hoa/thường, khoảng trắng) | v1 |
| B-04 | Giá trị ô nhập | v1 |
| B-05 | So sánh số: =, ≠, >, ≥, <, ≤, trong khoảng (tự hiểu định dạng `1.000.000`, `1,000.00`) | v1 |
| B-06 | So sánh ngày: bằng, trước, sau, = hôm nay ± N (nhiều định dạng ngày) | v1 |
| B-07 | Đếm phần tử: =, ≥, ≤ | v1 |
| B-08 | Bảng: dòng có cột X = giá trị thì cột Y phải = giá trị | v1 |
| B-09 | URL: bằng / chứa / regex; Tiêu đề trang | v1 |
| B-10 | Thông báo (toast/message) xuất hiện với nội dung | v1 |
| B-11 | Kiểu kiểm tra: **cứng** (fail thì dừng) / **mềm** (ghi nhận, chạy tiếp) | v1 |
| B-12 | So sánh cả bảng với file Excel kỳ vọng | v1.x |
| B-13 | Nội dung file tải về (tên, dung lượng, nội dung Excel/CSV/PDF) | v1.x |
| B-14 | So sánh ảnh với ảnh chuẩn (visual regression, có vùng bỏ qua) | v1.x |

## C. Định vị phần tử (Locator)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| C-01 | Lưu nhiều chiến lược theo ưu tiên: role+name → label → placeholder → text → testId → css → xpath; tự thử lần lượt | v1 |
| C-02 | Lưu fingerprint phần tử (tag, text, thuộc tính, phần tử lân cận) | v1 |
| C-03 | Định vị theo ngữ cảnh: "trong dòng có…", "bên dưới/cạnh nhãn…", "bên trong vùng…" | v1 |
| C-04 | Phần tử thứ N / đầu / cuối trong danh sách | v1 |
| C-05 | Xử lý ID động (ASP.NET WebForms `ctl00_…`, ID sinh ngẫu nhiên): khớp phần ổn định | v1 |
| C-06 | Nút Pick (bấm lên trang để chọn) và Highlight (hiện phần tử đang trỏ tới, báo nếu trùng nhiều) | v1 |
| C-07 | Chế độ Nâng cao: sửa selector thủ công | v1 |
| C-08 | Gợi ý selector mới khi hỏng (self-heal), người dùng duyệt | v1.x |

## D. Điều khiển luồng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| D-01 | Step dùng chung có tham số (vd "Đăng nhập(user, pass)"), sửa 1 chỗ áp dụng mọi nơi | v1 |
| D-02 | Chờ đến khi điều kiện đúng: timeout, chu kỳ, tùy chọn tải lại trang mỗi lần | v1 |
| D-03 | If / Else theo điều kiện (phần tử hiển thị, text, biến) | v1 |
| D-04 | Lặp: qua từng dòng dữ liệu, qua từng dòng bảng trên trang, N lần | v1 |
| D-05 | Khối Cleanup luôn chạy dù pass hay fail | v1 |
| D-06 | Tắt/bật step; bỏ qua có điều kiện | v1 |
| D-07 | Timeout riêng cho từng step | v1 |
| D-08 | Thử lại một khối step N lần | v1.x |

## E. Dữ liệu & Biến
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| E-01 | Cú pháp biến `{{ten}}` ở mọi ô giá trị, có gợi ý tự động khi gõ | v1 |
| E-02 | Phạm vi biến: môi trường → suite → test → runtime (lưu từ trang) | v1 |
| E-03 | Dữ liệu test từ Excel/CSV hoặc bảng nhập tay; mỗi dòng = 1 lần chạy | v1 |
| E-04 | Lưu giá trị từ trang vào biến: text, value, thuộc tính, một phần URL (regex) | v1 |
| E-05 | Sinh dữ liệu: `{{random}}`, `{{timestamp}}`, `{{uuid}}`, tên/SĐT/email/địa chỉ Việt Nam, chuỗi độ dài N | v1 |
| E-06 | Ngày: `{{today}}`, `{{today+3d}}`, `{{startOfMonth}}`, định dạng tùy chọn (`dd/MM/yyyy`) | v1 |
| E-07 | Biểu thức đơn giản: + − × ÷, nối chuỗi, làm tròn | v1 |
| E-08 | Secret: kiểu biến đặc biệt, mã hóa, tự che `••••` trong log/ảnh/báo cáo | v1 |

## F. Nhiều phiên & Ngoài giao diện
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-01 | Nhiều phiên trong 1 test (mỗi phiên = tài khoản/cookie riêng), hiển thị nhãn phiên trên từng step | v1 |
| F-02 | Lưu phiên đăng nhập, dùng lại cho các test sau (có hạn dùng) | v1 |
| F-03 | Gọi API: method, URL, header, body (JSON/form), lưu response vào biến, kiểm tra status/field | v1 |
| F-04 | Tự ghi nhận lỗi console JS và request 4xx/5xx; tùy chọn fail test khi có | v1 |
| F-05 | Chờ / kiểm tra một request mạng (URL, status, body) | v1.x |
| F-06 | Mock response API | v1.x |
| F-07 | Đọc email / OTP từ hộp thư test | v1.x |
| F-08 | Query DB chỉ đọc (SQL Server, Postgres, MySQL) | v1.x |
| F-09 | Sinh mã TOTP từ secret (2FA) | v1.x |

## G. Môi trường chạy
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| G-01 | Trình duyệt: Edge, Chrome (có sẵn trên máy); Chromium tải tự động | v1 |
| G-02 | Firefox, WebKit | v1.x |
| G-03 | Kích thước màn hình; giả lập thiết bị mobile | v1 |
| G-04 | Ngôn ngữ, múi giờ, vị trí địa lý giả lập | v1.x |
| G-05 | Chạy có hiện trình duyệt / chạy ngầm | v1 |
| G-06 | Proxy theo môi trường: HTTP/HTTPS/SOCKS5 (DNS phân giải qua proxy), có bypass list | v1 |
| G-07 | SSH tunnel tích hợp: người dùng nhập host, port, user, mật khẩu hoặc private key (lưu dạng Secret) → app tự mở SOCKS tunnel khi chạy test của môi trường đó, tự đóng khi xong; nút "Kiểm tra kết nối"; hỗ trợ jump host (bastion) | v1 |
| G-08 | Hướng dẫn trong app cho trường hợp VPN → SSH → web nội bộ | v1 |

## H. Chạy test
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| H-01 | Chạy 1 test, 1 suite, theo tag | v1 |
| H-02 | Chọn môi trường khi chạy | v1 |
| H-03 | Debug: chạy từng bước, breakpoint, chạy từ bước X, chạy chậm (slow-mo) | v1 |
| H-04 | Dừng khi lỗi đầu tiên hoặc chạy hết | v1 |
| H-05 | Chạy song song N test | v1.x |
| H-06 | Tự chạy lại test fail, đánh dấu flaky | v1.x |
| H-07 | CLI chạy test file/suite (cho CI, chạy theo lịch) | v1.x |
| H-08 | Hẹn giờ chạy trong app | v1.x |

## I. Kết quả & Báo cáo
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| I-01 | Pass/fail/skip từng step + thời gian | v1 |
| I-02 | Ảnh chụp mỗi step lỗi (khoanh đỏ phần tử), tùy chọn chụp mọi step | v1 |
| I-03 | Video lần chạy; trace (tua lại DOM, network) | v1 |
| I-04 | Thông báo lỗi tiếng Việt dễ hiểu + gợi ý cách sửa | v1 |
| I-05 | Xuất báo cáo HTML (1 file tự chứa) | v1 |
| I-06 | Xuất PDF, Excel | v1.x |
| I-07 | Xuất JUnit XML | v1.x |
| I-08 | So sánh 2 lần chạy | v1.x |

## J. Bảo trì
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| J-01 | Kho phần tử (Element repository): đặt tên phần tử, dùng lại; sửa 1 lần áp dụng mọi test | v1 |
| J-02 | Tìm nơi dùng (phần tử, step dùng chung, biến) | v1 |
| J-03 | Xuất / Nhập test, suite, project (`.kiemi.json` hoặc `.zip`) | v1 |
| J-04 | Nhân bản test / step | v1 |
| J-05 | Lịch sử thay đổi test, khôi phục bản cũ | v1.x |
| J-06 | Undo / Redo trong màn soạn test | v1 |

## K. Recorder
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| K-01 | Ghi: bấm, nhập, chọn, tick, phím, chuyển trang, tab mới, iframe | v1 |
| K-02 | Gộp thao tác thừa (nhiều lần gõ phím → 1 step Nhập) | v1 |
| K-03 | Thanh công cụ nổi khi ghi: Thêm kiểm tra (bấm phần tử → chọn loại kiểm tra), Lưu giá trị, Dừng | v1 |
| K-04 | Ghi chèn vào giữa test có sẵn (từ step X) | v1 |
| K-05 | Tự nhận ô password → đề nghị chuyển thành Secret | v1 |

## M. Tạo test nhanh
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| M-01 | Gợi ý kiểm tra tự động khi ghi: phát hiện thay đổi trên trang sau thao tác (toast/thông báo, dòng mới trong bảng, đổi URL, phần tử mới) → đề xuất step kiểm tra, người dùng bấm ✓ | v1 |
| M-02 | "Biến thành dữ liệu": chọn các giá trị đã nhập khi ghi → tự tạo cột dataset + thay bằng `{{row.x}}` | v1 |
| M-03 | Sinh biến thể từ form đã ghi (không cần AI): bỏ trống ô bắt buộc, sai định dạng (email, SĐT, ngày), giá trị biên (0, âm, quá dài), ký tự đặc biệt → người dùng tick chọn để tạo case negative | v1 |
| M-04 | AI (tùy chọn, người dùng nhập API key Claude): mô tả tiếng Việt → step; phần tử chưa xác định thì đánh dấu để Pick | v1.x |
| M-05 | Import test case từ Excel/Word (dạng bước thủ công) → AI chuyển thành step | v1.x |
| M-06 | AI tự khám phá web (crawl menu với tài khoản cho trước) → sinh bộ smoke test | v1.x |
| M-07 | Nhập từ Playwright codegen / Selenium IDE (`.side`) | v1.x |

## L. Mẫu & Onboarding
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| L-01 | Test mẫu: Đăng nhập, Điền form và kiểm tra thông báo, Tạo ở A kiểm tra ở B, Data-driven từ Excel | v1 |
| L-02 | Hướng dẫn trong app từng bước lần đầu | v1 |

## Ngoài phạm vi (không làm)
Load testing · Pentest · App mobile native · App desktop · Vượt captcha · Cloud/đồng bộ/tài khoản (để giai đoạn sau) · Tính phí/license.

---

## Lịch sử thay đổi
| Ngày | ID | Thay đổi | Lý do |
|---|---|---|---|
| 2026-11-16 | — | Phiên bản SPEC đầu tiên | |
| 2026-11-16 | N-11, N-12, N-13 | Thêm phát hành tự động, tự cập nhật, không cần cài thêm | Người dùng chỉ tải 1 lần rồi dùng |

---

## Phụ lục 1 — Step DSL v1 (định hướng)
```json
{
  "schemaVersion": 1,
  "id": "0193…",
  "name": "Tạo đơn ở A, quản lý thấy ở B",
  "tags": ["smoke"],
  "sessions": ["nhanvien", "quanly"],
  "dataset": { "source": "excel", "file": "don-nghi.xlsx" },
  "steps": [
    { "id": "s1", "session": "nhanvien", "action": "goto", "params": { "url": "{{env.portalUrl}}" } },
    { "id": "s2", "session": "nhanvien", "action": "call", "params": { "shared": "login", "args": { "user": "{{secret.nvUser}}", "pass": "{{secret.nvPass}}" } } },
    { "id": "s3", "session": "nhanvien", "action": "fill", "params": { "target": { "ref": "el_soNgay" }, "value": "{{row.soNgay}}" } },
    { "id": "s4", "session": "nhanvien", "action": "click", "params": { "target": { "ref": "el_btnGui" } } },
    { "id": "s5", "session": "nhanvien", "action": "extract", "params": { "target": { "ref": "el_maDon" }, "into": "maDon" } },
    { "id": "s6", "session": "quanly", "action": "waitUntil", "params": { "condition": { "assert": "visible", "target": { "text": "{{maDon}}" } }, "timeoutSec": 60, "reloadEverySec": 5 } },
    { "id": "s7", "session": "quanly", "action": "assertText", "params": { "target": { "ref": "el_lyDo" }, "op": "equals", "value": "{{row.lyDo}}" }, "mode": "soft" }
  ],
  "cleanup": [
    { "id": "c1", "session": "nhanvien", "action": "api", "params": { "method": "DELETE", "url": "{{env.apiUrl}}/don/{{maDon}}" } }
  ]
}
```

## Phụ lục 2 — Data model (định hướng)
`Workspace` · `Project` · `Folder` · `TestCase` · `Suite` · `SuiteItem` · `SharedStep` · `Element` (locator strategies + fingerprint) · `Environment` · `Variable` · `Secret` · `Dataset` · `Run` · `RunCase` · `RunStep` · `Artifact` (ảnh/video/trace) · `Setting`.
Mọi bảng: `id` UUIDv7, `workspaceId`, `createdAt`, `updatedAt`, `deletedAt`, `version`.
