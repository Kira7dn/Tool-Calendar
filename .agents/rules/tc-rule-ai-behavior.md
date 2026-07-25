# TC-RULE-AI-BEHAVIOR

Quy tắc này định nghĩa chuẩn mực hành vi, tư duy phân tích và nguyên tắc viết code dành cho AI Agent khi làm việc trên dự án Tool-Calendar. AI Agent phải tuân thủ nghiêm ngặt để đảm bảo chất lượng cấp độ Enterprise (vượt qua hoặc đạt chuẩn OpenClaw).

> [!IMPORTANT]
> Mục tiêu tối thượng của AI Agent không phải là "sửa cho xong lỗi", mà là **"duy trì và nâng tầm kiến trúc tổng thể của hệ thống"**.

---

## 1. Nguyên Tắc Bằng Chứng Toàn Diện (Evidence-Based Review & Execution)

Tuyệt đối không đưa ra kết luận hoặc thay đổi mã nguồn chỉ dựa trên một đoạn diff ngắn hoặc mô tả lỗi từ người dùng. Mọi thay đổi phải đi kèm với **Bản đồ Bằng chứng (Evidence Map)**.

- **Đọc Rộng Khắp (Broad Context):** Trước khi sửa một hàm, AI BẮT BUỘC phải đọc:
  1. Các hàm đang gọi nó (Callers).
  2. Các hàm mà nó gọi tới (Callees).
  3. Các file interface/contracts liên quan.
  4. Unit Tests đi kèm (nếu có).
- **Best Fix vs Plausible Fix:** AI phải tự đặt câu hỏi và khẳng định bản vá đề xuất là **cách sửa tốt nhất (best fix)** cho toàn bộ hệ thống, chứ không chỉ là cách sửa lấp liếm tạm thời (plausible fix).
- **Không suy đoán:** Bất kỳ hàm nào không rõ đầu vào/đầu ra, AI phải dùng công cụ `grep_search` hoặc `view_file` để tìm bằng chứng chính xác trước khi code.

---

## 2. Kiểm Tra Tiền Trạm Dịch Vụ Có Sẵn (Existing-Solutions Preflight)

Không "phát minh lại cái bánh xe". Tool-Calendar sử dụng hệ sinh thái mạnh mẽ của `.NET 10`, `React 19`, và `Tailwind v4`.

- Trước khi đề xuất tự viết một hàm phức tạp (ví dụ: parse ngày tháng, format tiền tệ, xử lý đồ thị, retry policy), AI **phải** kiểm tra xem có thư viện/hàm native nào hỗ trợ sẵn không.
- Chỉ xây dựng custom logic khi không có sẵn giải pháp tốt, giải pháp có sẵn quá đắt đỏ, hoặc người dùng yêu cầu cụ thể.

---

## 3. Tư Duy Code Tinh Gọn (Lean Code) và LOC ROI

Chất lượng mã nguồn tỷ lệ nghịch với số dòng code (LOC - Lines of Code).

- **Không Thỏa Hiệp Tương Thích Ngược (No Silent Compat):** Chạy thực tế (Runtime) chỉ dùng một luồng dữ liệu chuẩn duy nhất. KHÔNG viết các đoạn `if/else` lồng nhau chỉ để xử lý dữ liệu cũ/lỗi thời. Nếu cần, hãy tạo công cụ/migration riêng để chuyển đổi dữ liệu chuẩn hóa trước, sau đó backend chỉ xử lý logic đúng chuẩn.
- **Xóa Code Thừa:** Các hàm fallback dự phòng không dùng tới, các biến tạm thừa thãi, và các file cũ phải bị **xóa bỏ**.
- **LOC Return On Investment:** Mọi bản refactor lý tưởng nhất là làm **giảm** số lượng dòng code. Nếu một bản refactor làm tăng số dòng code, AI phải để lại bình luận rõ ràng (hoặc báo cáo) để chứng minh giá trị cấu trúc/kiến trúc mà nó mang lại.

---

## 4. Giao Tiếp Cộc Lốc Nhưng Hiệu Quả (Telegraph Style)

- Khi giao tiếp với người dùng, AI phải trả lời **đi thẳng vào vấn đề**, rõ ràng, và súc tích. Không rườm rà.
- Trích dẫn file và dòng code trực tiếp (có link dạng `file:///`) thay vì giải thích dông dài.
- Nếu không chắc chắn, hãy chủ động dùng `grep_search` tự tìm hiểu, thay vì hỏi lại người dùng những câu hỏi có thể tự trả lời bằng cách tra cứu codebase.

---

## 5. Quy Trình Phân Xử Bug (Bug Triage Flow)

Khi gặp báo cáo Bug, thực hiện theo thứ tự:
1. **Reproduce & Trace:** Tìm đoạn code gây lỗi và lần ngược (trace) luồng dữ liệu thông qua ADO.NET/React.
2. **Contextualize:** Tìm trong `COMMIT_LOG.md` xem tính năng này được ai viết, sửa gần nhất khi nào và bối cảnh thiết kế là gì.
3. **Draft Fix:** Viết bản vá, đảm bảo vượt qua `tc-rule-backend-architecture.md` (nếu là backend) và `tc-rule-frontend-architecture.md` (nếu là frontend).
4. **Log & Commit:** Ghi chép chi tiết nguyên nhân gốc rễ và cách khắc phục vào `COMMIT_LOG.md`.

---
**Status:** ACTIVE — HIGH STANDARD  
**Priority:** LEVEL 1 — Ràng buộc tư duy cốt lõi
