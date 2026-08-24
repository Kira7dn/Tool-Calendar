# TC-RULE-BUG-LOGGING

Quy tắc này nhằm đảm bảo mọi lỗi (bug) được phát hiện và sửa chữa trong quá trình phát triển đều được ghi nhận lại làm bài học xương máu cho hệ thống.

## 1. Yêu Cầu Bắt Buộc

- AI Agent **BẮT BUỘC** phải ghi chép lại mọi lỗi (bug) mà Agent đã sửa hoặc được Developer chỉ ra vào file `.agents/rules/tc-rule-bloody-lessons.md`.
- File `tc-rule-bloody-lessons.md` là cuốn "sổ tay" ghi lại các bài học xương máu, các lỗi ngớ ngẩn, các lỗi chết người để các phiên làm việc sau không bao giờ lặp lại.

## 2. Quy Trình Ghi Chép Lỗi (Bug Logging)

Mỗi khi phát hiện ra một nguyên nhân gốc rễ của bug và đưa ra giải pháp sửa chữa, Agent phải:
1. Mở file `.agents/rules/tc-rule-bloody-lessons.md`.
2. Xác định chuyên mục phù hợp (ví dụ: Upload File, DB, Auth, v.v...) hoặc tạo chuyên mục mới nếu cần.
3. Thêm một gạch đầu dòng theo format:
   - **[TÊN NGẮN GỌN CỦA LỖI] Mô tả ngắn gọn biểu hiện:** Mô tả chi tiết nguyên nhân gốc rễ gây ra lỗi.
   - **Bài học:** Cách khắc phục và biện pháp phòng ngừa để không tái diễn (cấu hình, code pattern, v.v...).
4. Sau khi ghi vào sổ tay bài học, Agent phải cập nhật `COMMIT_LOG.md` (theo `tc-rule-commit-log.md`) để xác nhận việc cập nhật tài liệu.

## 3. Các Loại Lỗi Cần Được Ghi Nhận

- Các cấu hình mặc định (default configs) của framework hoặc server gây ra lỗi (ví dụ: Nginx proxy limits, Kestrel upload limits, Timeout mặc định của HTTP Client).
- Lỗi logic nghiệp vụ hoặc thuật toán bị đệ quy, lặp vô hạn.
- Lỗi liên quan đến Database schema, concurrency, hoặc ORM/ADO.NET mapping.
- Lỗi bảo mật, token expiration, phân quyền.
- Lỗi ngớ ngẩn do bất cẩn (typo, thiếu await, parse JSON lỗi do đầu vào sai).

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** LEVEL 1 — Bắt buộc không ngoại lệ
