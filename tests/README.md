# 🚀 Tài liệu Kỹ thuật & Bàn giao Hệ thống OCR (Industrial Edition)

Hệ thống đã hoàn thành việc nâng cấp lõi **Tesseract 5.5.0** và tích hợp **OpenCV Hardening**. Tài liệu này cung cấp các thông số kỹ thuật, cấu trúc mã nguồn và quy trình kiểm thử dành cho việc vận hành và bảo trì hệ thống.

---

## 🏗️ 1. Trạng thái & Chỉ số (Current State & Benchmarks)

Hệ thống đang sử dụng **Tesseract 5.5.0 (LSTM model)** kết hợp với Pipeline hậu kỳ OpenCV để đạt độ ổn định công nghiệp.

| Kịch bản | Độ chính xác | Ghi chú |
| :--- | :--- | :--- |
| **Standard Doc (Clean)** | **~97.09%** | Tài liệu Digital hoặc Scan sạch. Hiện tại đang bám sát mức này. |
| **Noisy Doc (Industrial)** | **~67.67%** | Kết hợp lọc Contour < 15px và Border Purge. |
| **Surgical Purge** | **Đang đo lường** | Dự kiến đạt >85% sau khi tối ưu Blob Purge & Single-pass rotation. |

---

## 📂 2. Cấu trúc Mã nguồn (Source Hierarchy)

- `ToolCalender.Core\Services\OcrService.cs`: Pipeline 5 giai đoạn chính (Denoise -> OSD -> Deskew -> OCR).
- `ToolCalender.Tests\Helpers\AutomationDocHelper.cs`: Logic sinh văn bản giả lập và nhiễu nhân tạo.
- `ToolCalender.Tests\ActualTests\RealDocumentTests.cs`: Controller chạy kiểm thử trên tệp mẫu thực tế.

---

## ⚙️ 3. Đặc tả Logic Xử lý (Full Tech Spec)

Hệ thống vận hành theo cơ chế phối hợp đa tầng:

### Tầng A: Trích xuất Hỗn hợp (Hybrid Extraction)
Hệ thống sử dụng cơ chế **Nối kết quả (Concatenation Path)** để đảm bảo không bỏ sót dữ liệu:
1.  **Imaging Path (Ưu tiên)**: Chạy toàn bộ Pipeline OCR để bóc tách văn bản từ ảnh/scan.
2.  **Digital Path (Làm giàu)**: Sử dụng iText 7 để trích xuất lớp kỹ thuật số (Text trực tiếp, Form Fields, XObject). 
3.  **Hợp nhất**: Kết quả từ Digital Path được nối vào sau OCR để bổ sung các metadata mà OCR có thể bỏ lỡ.

### Tầng B: Quy trình xử lý tuần tự trong `OcrService.cs`
Với mỗi trang tài liệu, hệ thống kích hoạt Pipeline 5 bước kỹ thuật:

1.  **Rendering**: PDF được render ở mức **300 DPI** cố định. Lưu debug: `pX_0_raw.png`.
2.  **Surgical Denoising & Skip Logic**:
    - **Ink Density**: Nếu mật độ mực `< 0.1%`, hệ thống sẽ trả về `[Skipped: Blank Page]`.
    - **Edge Purge**: Tự động xóa vật thể bám biên 10px nếu Diện tích **> 200px**.
    - **Salt-and-pepper**: Tự động xóa vật thể có Diện tích **< 15px**. Lưu debug: `pX_1_denoised.png`.
3.  **Hardened OSD (Orientation)**:
    - **Center-weighted**: Chỉ nhận diện hướng trên 80% diện tích trọng tâm. Chạy `MedianBlur(3)` trước khi nhận diện để làm mịn nét. Lưu debug: `pX_2_osd_view.png`.
    - **Portrait-Lock**: Chặn các lệnh xoay 90/270 độ nếu ảnh đứng (`Height > Width`).
    - **Trust Level**: Ngưỡng tin cậy tối thiểu để xoay hướng là **25.0**. 
4.  **Physical Deskew**: Sử dụng thuật toán Leptonica để nắn thẳng độ nghiêng.
5.  **Forced 8-bit Gray**: Toàn bộ ảnh được ép kiểu về 8-bit Grayscale trước khi đưa vào Engine **LSTM** với ngôn ngữ **`vie+eng`**. Lưu debug: `pX_3_final_ocr.png`.

### Tầng C: Bóc tách Nghiệp vụ (Data Parsing)
Văn bản tổng hợp từ cả hai nguồn (Hybrid) sẽ được đưa vào bộ lọc thông minh tại `ParseTextAsync`:
- **Normalization**: Chuẩn hóa Unicode Form C, xử lý lỗi ký tự đặc thù (`ƣ` -> `ư`, `trƣớc` -> `trước`) và chuẩn hóa từ khóa (`S0` -> `Số`).
- **Extraction (Regex Intelligence)**: 
    - **Số hiệu**: Ưu tiên tìm định dạng số hiệu văn bản hành chính và trường Form.
    - **Ngày tháng**: Nhận diện ngày ban hành.
    - **Thời hạn (Priority-based)**: Tự động tính toán độ ưu tiên dựa trên ngữ cảnh ("hạn xử lý" > "trước ngày").
    - **Trích yếu**: Tự động bóc tách nội dung sau từ khóa "V/v" hoặc "Về việc".


### 🎯 Chiến lược cải thiện "Lean & Smart" (Tập trung mục tiêu)
1.  **Cơ chế "Digital First" (Tăng tốc xử lý)**: Thay đổi trình tự: Nếu `DocumentExtractor` đọc được lớp Text kỹ thuật số > 100 ký tự, hệ thống sẽ **bỏ qua hoàn toàn** bước OCR để tiết kiệm 95% thời gian xử lý cho các tệp sạch.
2.  **Khóa hướng OSD (Sửa lỗi Quyết định 189)**: Thiết lập ngưỡng cứng: Nếu Confidence của OSD < 30.0, tuyệt đối không thực hiện xoay ảnh. Điều này giúp bảo vệ nội dung trang 1, 7, 15 của mẫu QĐ 189 không bị xoay ngược do AI bị lừa bởi con dấu.
3.  **Hợp nhất phép xoay (Tăng độ sắc nét)**: Tính toán góc OSD và góc Skew (nghiêng) cùng lúc, sau đó chỉ thực hiện xịch chuyển/xoay ảnh **duy nhất 01 lần**. Tránh làm mờ ảnh (anti-aliasing) do xoay nhiều lượt, giúp Tesseract nhận diện chính xác các chữ nhỏ.
4.  **Lọc nhiễu thông minh (Sạch dữ liệu)**: Bổ sung bước lọc theo tỷ lệ dài/rộng (Aspect Ratio) để giữ lại các dấu gạch ngang/gạch nối, tránh bị xóa nhầm như hiện tại, giúp câu văn giữ đúng ngữ pháp.
5.  **Chuẩn hóa dữ liệu sau OCR (Normalization)**: Bổ sung thêm các từ điển sửa lỗi chính tả phổ biến dành riêng cho văn bản hành chính (ví dụ: `v/v` thường bị OCR đọc thành `v/v.` hoặc `v/v:`).

---

## 🧪 4. Hướng dẫn Kiểm thử & Đối soát (Testing & Verification Guide)

### 🚀 Lệnh thực thi & Vị trí kết quả
| Kịch bản | Lệnh thực thi (PowerShell) | Vị trí kiểm tra kết quả |
| :--- | :--- | :--- |
| **Kiểm thử Thực tế** | `dotnet test --filter "ActualTests" ; type "tests\test_results\actual_test\Quyết định 189_result.md"` | `tests\test_results\actual_test\` |
| **Kiểm thử Thuật toán** | `dotnet test --filter "UnitTests"` | `tests\test_results\unit_test\` |

### 🔍 Quy trình Đối soát & Bắt lỗi (Verification Protocol)
Khi thực hiện kiểm thử, cần đối soát các chỉ số sau để xác định lỗi:

1.  **Kiểm tra Console Log**:
    - `--- Trang X [OSD Fix: .../Conf: ...] ---`: Xác nhận hướng trang đã được xử lý và độ tin cậy của AI.
    - `OSD Blocked [Reason: Portrait-Lock]`: Xác nhận hệ thống đã nhận diện đúng văn bản đứng và chặn xoay sai 90/270 độ.
    - *Ghi chú*: Chỉ số Diacritics hiện đang được đo lường thủ công trong các tệp Phân tích (`_analysis.md`).
2.  **Kiểm tra Artifacts (.md)**:
    - **Tại `actual_test\`**: Đọc các tag kỹ thuật đầu trang (`[OSD Fix]`, `[Deskewed]`, `[Skipped]`) để hiểu diễn biến tiền xử lý và đối chiếu nội dung với văn bản gốc.
    - **Tại `unit_test\`**: Đọc file có tiền tố `Comparison_*`. File này chứa bảng đối chiếu trực tiếp giữa **Ground Truth** (Đáp án chuẩn) và **Extracted Text** đi kèm chỉ số **Accuracy %** tự động.

3.  **Kiểm tra Debug Images (`actual_test\debug_images\`)**:
    - **Audit mật độ**: So sánh dung lượng file giữa `pX_0_raw` và `pX_1_denoised`. Nếu kích thước giảm > 70%, phải kiểm tra bằng mắt xem có bị mất nét chữ không.
    - **Audit hướng**: Nếu OCR sai hướng, kiểm tra ảnh `pX_2_osd_view` để xác định OSD bị lừa bởi vật thể nào.

---
*Cập nhật bởi: Antigravity AI (Phiên 18/04/2026 - Bản Đặc tả Hợp nhất 4.0)*
