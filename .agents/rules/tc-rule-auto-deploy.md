# TC-RULE-AUTO-DEPLOY

Quy tắc này bắt buộc AI Agent phải tự động thực hiện commit, push, deploy lên server VNPT và dọn dẹp file tạm ngay sau khi hoàn thành một yêu cầu sửa lỗi hoặc phát triển tính năng mới.

## 1. Điều Kiện Kích Hoạt (Always On)

Quy tắc này áp dụng **bắt buộc** vào cuối mỗi luồng công việc (workflow) khi AI đã xác nhận code hoạt động chính xác (đã test local).

## 2. Quy Trình 3 Bước Bắt Buộc

Mỗi khi hoàn thành một task, AI phải tự động làm các bước sau mà không cần hỏi lại Developer:

### Bước 1: Commit & Push lên Git
1. Cập nhật `COMMIT_LOG.md` theo chuẩn (`tc-rule-commit-log.md`).
2. Chạy kiểm tra chất lượng code (`tc-rule-quality-gate.md`): `npx prettier --write .`, `eslint`, v.v.
3. Commit theo chuẩn Conventional Commits.
4. Push code lên nhánh hiện tại (`git push origin phonghopkhonggiayto`).

### Bước 2: Deploy lên VNPT Server
1. Sử dụng script `deploy_to_vnpt.sh` có sẵn ở thư mục gốc để tự động deploy:
   ```bash
   chmod +x deploy_to_vnpt.sh
   ./deploy_to_vnpt.sh
   ```
2. Nếu script thất bại, tự động chẩn đoán lỗi (ví dụ: sshpass không cài đặt, permission denied) và thông báo ngay cho Developer.

### Bước 3: Dọn Dẹp File Tạm (Clean Up)
1. Xóa mọi file tạm trên local (ví dụ: `test.js`, `test.cs`, `*.log`, `*.tmp`, `dump.sql`).
2. Đảm bảo môi trường làm việc sạch sẽ hoàn toàn trước khi báo cáo kết thúc. (Theo đúng `tc-rule-no-temporary-files.md`).

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** HIGH — Đảm bảo liên tục CI/CD
