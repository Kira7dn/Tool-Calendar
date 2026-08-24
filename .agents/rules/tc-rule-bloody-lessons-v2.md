# TC-RULE-BLOODY-LESSONS-V2

Tài liệu này là phần tiếp theo (Part 2) của các "bài học máu xương" (Bloody Lessons) — những lỗi ngớ ngẩn, những cái bẫy kỹ thuật, hoặc những lỗi nghiêm trọng có thể làm sập hệ thống đã gặp phải trong quá trình phát triển Tool-Calendar. **AI Agent BẮT BUỘC phải tham khảo tài liệu này để không lặp lại sai lầm.**

## 10. Xử lý File & Bảo mật (File Processing & Security)

- **[LỖI KỸ THUẬT SỐ] Tải lên File PDF Ký số (`.signed.pdf`) báo lỗi sai định dạng:** Khi cấu hình hệ thống kiểm tra Magic Bytes rất chặt chẽ (chỉ soi 4 byte đầu tiên `0x25, 0x50, 0x44, 0x46` tương ứng `%PDF`), các file `.pdf` thông thường sẽ pass. Tuy nhiên, khi upload các file **PDF đã được ký số** bởi các nhà mạng (VNPT, Viettel...), hệ thống ngay lập tức báo "File có nội dung không khớp với định dạng .pdf. Có thể file bị giả mạo extension." và trả về mã lỗi 400 Bad Request.
  - **Nguyên nhân cốt lõi:** Các phần mềm ký số thường thực hiện bọc file PDF vào một phong bì bảo mật (CMS envelope) hoặc thêm ký tự ẩn (UTF-8 BOM) ngay ở vị trí byte 0 của file. Điều này đẩy chuỗi nhận diện `%PDF` lùi xuống bên dưới. Thuật toán cũ chỉ đọc từ index 0 đến 3 sẽ trượt mất chữ ký này, khiến file bị từ chối oan dù đây hoàn toàn là file PDF hợp lệ.
  - **Bài học:** 
    - Tuyệt đối không hard-code index `0` khi kiểm tra Magic Bytes cho file PDF.
    - Theo tiêu chuẩn chính thức của Adobe, chuỗi `%PDF` có thể nằm ở **bất kỳ đâu trong phạm vi 1024 bytes đầu tiên** của file.
    - Bắt buộc phải thay đổi thuật toán trong `FileSignatureValidator.cs` để đọc tối đa 1024 bytes và quét tuyến tính (linear scan) tìm chuỗi `%PDF` bên trong mảng byte đó. Đối với các loại file khác (PNG, DOCX, v.v.), vẫn có thể check từ byte 0 bình thường.

---
**Status:** ACTIVE  
**Priority:** CAUTION — Những bài học phải ghi nhớ để tránh "đổ máu" lần 2.
**Phần 1:** Xem tại `tc-rule-bloody-lessons.md`
