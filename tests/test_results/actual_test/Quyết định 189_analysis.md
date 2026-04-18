# Backlog Phân tích OCR - Tệp: Quyết định 189.pdf

Tệp này đại diện cho văn bản hành chính thực tế (15 trang). Qua quá trình chạy thử nghiệm, tôi đã bóc tách các vấn đề tồn tại như sau:

## 1. Tình trạng hiện tại (Backlog Items)

| Phân loại | Trang gặp lỗi | Chi tiết vấn đề | Mức độ nghiêm trọng |
| :--- | :--- | :--- | :--- |
| **Rotate (OSD)** | 1, 7, 15 | **Bị xoay sai 180 độ**. OSD báo Confidence > 20.0 nhưng thực tế là sai. Điều này gây hỏng toàn bộ nội dung trang. | **Highest** |
| **Noise (Nhiễu)** | Tất cả | Diacritics count dao động 400 - 900. Có nhiễu lấm tấm từ máy quét (Salt & Pepper). OCR vẫn đọc được nhưng độ chính xác giảm ở các chữ nhỏ. | Medium |
| **Skew (Nghiêng)** | Rải rác | Các trang có độ nghiêng nhẹ (< 2 độ). Thuật toán Deskew hiện tại xử lý được nhưng làm mờ nét chữ do nội suy ảnh AreaMap. | Low |
| **Borders (Viền)** | 1, 15 | Có rác ký tự ở đầu và cuối trang. Có lỗi hệ thống `boxClipToRectangle: box outside rectangle`, báo hiệu vùng viền ảnh không sạch. | Medium |

## 2. Nguyên nhân sâu xa (Root Cause)

*   **OSD sai**: Do các trang 1, 7, 15 có các thành phần "nặng" (Dấu mộc đen/đỏ, chữ ký lớn, bảng biểu) chiếm ưu thế diện tích. Tesseract OSD bị nhầm các nét vẽ này là hướng chữ chính.
*   **Dẫm đạp diacritics**: Việc để Tesseract tự binarize (Sauvola) trên ảnh Grayscale là tốt cho tài liệu sạch, nhưng với ảnh quét có nhiễu, nó vẫn để lại các hạt pixel "mồ hôi" xung quanh chữ.
*   **Xoay ảnh nội suy**: Mỗi lần xoay (OSD/Deskew) là một lần làm mờ (alias). Nếu xoay 2 lần sẽ làm giảm đáng kể khả năng nhận diện chữ siêu nhỏ.

## 3. Kế hoạch hành động (Plan)

### Giai đoạn 1: Hardening OSD & Deskew (Ưu tiên số 1)
- [ ] **Khóa OSD**: Nếu Confidence < 30.0, tuyệt đối không xoay (Fallback về 0 độ).
- [ ] **Multi-Crop OSD**: Thay vì OSD cả trang, ta chỉ lấy vùng trung tâm (Center 60%) để tránh bị lừa bởi con dấu/viền đen ở các góc.
- [ ] **Single-pass Rotation**: Kết hợp góc Skew và góc OSD để xoay ảnh đúng 1 lần duy nhất, tránh làm mờ ảnh 2 lần.

### Giai đoạn 2: Surgical Denoising (Lọc nhiễu ngoại khoa)
- [ ] **Area-based Denoising**: Áp dụng lọc Contour với Area < 10px để xóa nhiễu "hạt vừng" mà không chạm vào dấu tiếng Việt (thường > 15px ở 300dpi).
- [ ] **Border Cleaning**: Tự động crop bỏ 5-10 pixel ở các cạnh để tránh lỗi vùng đệm (box outside rectangle).

### Giai đoạn 3: Tối ưu hóa Recognition
- [ ] **Double-Engine fallback**: Với những trang có Confidence thấp, thử chạy thêm một lượt binarize bằng Otsu để so sánh kết quả.

---
**Ghi chú**: Văn bản "Quyết định 189" là case-study cực tốt vì nó kết hợp cả văn bản máy tính và các trang có con dấu thật. Việc vượt qua được tệp này sẽ đảm bảo hệ thống đạt mức Production-ready.
