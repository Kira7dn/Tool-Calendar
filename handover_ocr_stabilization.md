# Báo cáo Bàn giao: Tuyến OCR Chẩn đoán (Diagnostic OCR Pipeline)

**Trạng thái**: Đã khôi phục thành công Flow xử lý sau sự cố "Recognition failed". Pipeline hiện đang chạy ổn định qua 15 trang.

## 1. Công việc đã thực hiện
*   **Ổn định hóa Orchestration**: Đã di chuyển việc khởi tạo `TesseractEngine` và `osdEngine` ra ngoài vòng lặp. Điều này xóa bỏ hoàn toàn lỗi cạn kiệt tài nguyên và lỗi "Recognition failed".
*   **Fix tranh chấp PDF Stream**: Sử dụng các luồng độc lập cho việc đếm trang và Render trang, đảm bảo không bị `ObjectDisposedException`.
*   **Hệ thống Chẩn đoán (Always-Save)**: 
    *   Hỗ trợ phát hiện Root Solution cho cả tệp `.sln` và `.slnx`.
    *   Tự động lưu 3 chặng ảnh (Raw, Preprocessed, OSD Result) vào `tests/test_results/actual_test/debug_images/`.
*   **An toàn hóa (Hardening)**: Đã tách biệt việc lưu ảnh Debug khỏi Engine Tesseract. Hiện tại sử dụng `SkiaSharp` để lưu ảnh Stage 1, 2, 3 nhằm đảm bảo Engine không bị sập.

## 2. Kết quả kiểm thử mới nhất (Quyết định 189)
*   **Flow**: Chạy mượt qua cả 15 trang mà không có lỗi Recognition nào trong log Console/MD.
*   **Audit**: Đã có ảnh Stage 1, 2, 3 xuất hiện tại `tests/test_results/actual_test/debug_images/`.

## 3. Các vấn đề tồn đọng (Cần làm ngay ở phiên sau)
*   **Khôi phục Stage 4 (Deskew Image)**: Hiện tại Stage 4 đang bị comment (Dòng 242-246 trong `OcrService.cs`) vì `Pix.Save` không ổn định. Cần tìm cách lưu ảnh đã được Deskew thông qua MemoryStream hoặc SkiaSharp.
*   **Xác thực độ chính xác**: Cần chạy lại toàn bộ bài test `RealDocumentTests` và kiểm tra logic xoay 180 độ (Trang 1 của QĐ 189) để đảm bảo OSD hoạt động chuẩn.
*   **Dọn dẹp mã nguồn**: Loại bỏ các đoạn code xử lý Stream cũ đã bị thay thế.

## 4. Ghi chú kỹ thuật
*   Tệp quan trọng: [OcrService.cs](file:///d:/Business%20Analyze/ToolCalendar/ToolCalender.Core/Services/OcrService.cs)
*   Thư mục ảnh chẩn đoán: `tests/test_results/actual_test/debug_images/`
*   Logic OSD: Đang sử dụng phương pháp `OsdOnly` với `Confidence > 10.0` để đảm bảo an toàn.

---
*Phiên kết thúc lúc: 17:38 - 18/04/2026*
