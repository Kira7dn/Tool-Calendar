# TC-RULE-AUTO-COMMIT

Quy tắc này nhằm đảm bảo tính toàn vẹn của mã nguồn, tránh việc mất code hoặc sót file sau khi AI Agent đã hoàn thành một yêu cầu chỉnh sửa.

## 1. Yêu Cầu Bắt Buộc

- Ngay khi Agent hoàn thành việc viết code, fix bug, hoặc bổ sung tính năng mới và đã kiểm tra (verify) code chạy ổn định, Agent **BẮT BUỘC** phải tự động tạo commit đẩy lên Git nội bộ (Local) hoặc Remote.
- Không được để trạng thái working tree bị "bẩn" (unstaged/uncommitted changes) sau khi kết thúc một cuộc hội thoại hoặc trước khi bắt tay vào sửa một lỗi mới.

## 2. Quy Trình Tự Động Commit

Mỗi khi code xong, Agent phải tự động thực hiện chuỗi lệnh sau:
1. **Kiểm tra trạng thái:** `git status`
2. **Cập nhật lịch sử:** Ghi chú các thay đổi vào file `COMMIT_LOG.md`.
3. **Staging:** `git add .`
4. **Commit:** `git commit -m "<type>(<scope>): <mô tả chi tiết>"` (Tuân thủ nghiêm ngặt chuẩn `tc-rule-conventional-commits.md`).
5. **Push (Tùy chọn/Bắt buộc tuỳ ngữ cảnh):** Nếu luồng công việc yêu cầu, tự động `git push origin <branch_name>` luôn.

## 3. Lý Do

Việc AI Agent tự động commit code ngay khi làm xong giúp:
- Developer có thể dễ dàng revert/rollback nếu đoạn code mới gây ra lỗi.
- Tránh tình trạng AI ở phiên sau bị mất ngữ cảnh hoặc vô tình xóa/sửa đè lên đoạn code chưa được commit của phiên trước.
- Đảm bảo Quality Gate (các Git hook kiểm tra format, linting, secret quét) được kích hoạt kịp thời.

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** LEVEL 1 — Bắt buộc thực hiện ở cuối mỗi thao tác code.
