# Prompt dùng với Claude Code

## Lần đầu tiên (paste vào Claude Code trong VS Code, đã mở thư mục dự án)
```
Đây là dự án mới. Hãy đọc CLAUDE.md, docs/SPEC.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/PROGRESS.md.
Khởi tạo git repo (nếu chưa có), commit bộ tài liệu này, rồi làm task trong mục "Tiếp theo" của PROGRESS.md.
Tuân thủ đúng quy trình trong CLAUDE.md.
```

## Mỗi phiên sau (chat mới)
```
Làm tiếp.
```

## Làm task cụ thể
```
Làm task M1-03.
```

## Thêm / sửa / bỏ yêu cầu
```
Yêu cầu mới: <mô tả>.
```
→ Claude đề xuất (ID, ưu tiên, tiêu chí chấp nhận, ảnh hưởng). Bạn trả lời:
```
Chốt.            (cập nhật SPEC/ROADMAP, chưa code)
Chốt, làm luôn.  (cập nhật tài liệu rồi code ngay)
```
Muốn bỏ qua bước đề xuất:
```
Yêu cầu mới: <mô tả>. Chốt luôn, làm luôn.
```

## Kiểm tra tiến độ
```
Tóm tắt tiến độ theo ROADMAP: đã xong gì, còn gì, có vấn đề gì.
```
