---
trigger: always_on
description: "Quy tắc bắt buộc AI phải tự động dọn dẹp các file tạm, script test sau khi sử dụng."
---

# TC-RULE-NO-TEMPORARY-FILES

Quy tắc này nhằm giữ cho không gian làm việc (workspace) luôn sạch sẽ và không bị rác bởi các file sinh ra trong quá trình AI debug hoặc kiểm tra hệ thống.

## 1. Yêu Cầu Bắt Buộc

- AI **phải tự động xóa** bất kỳ file tạm nào được sinh ra trong quá trình kiểm tra (ví dụ: script check lỗi, dump file, test account, script Python/Bash tạm thời, file log rác).
- Việc xóa phải được thực hiện **ngay sau khi hoàn thành** mục đích kiểm tra.
- Tuyệt đối không để sót file rác khi kết thúc phiên làm việc hoặc trước khi commit code.

## 2. Các Loại File Nằm Trong Diện Dọn Dẹp

- Các script kiểm tra nhanh (vd: `test.js`, `check_db.py`, `script.sh`).
- Các file kết xuất dữ liệu tạm (vd: `dump.json`, `output.txt`, `temp.sql`).
- Các file zip/tar được nén hoặc giải nén dùng một lần.

## 3. Ngoại Lệ (Không Xóa)

- Các file được tạo ra theo yêu cầu rõ ràng của người dùng nhằm mục đích lưu trữ lâu dài.
- Các file tài liệu, artifact do AI tạo ra để báo cáo (nằm trong thư mục `.gemini/` hoặc `docs/`).

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** HIGH — Dọn dẹp không gian làm việc
