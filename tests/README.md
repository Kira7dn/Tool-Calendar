# 🚀 Hướng dẫn Bàn giao Hệ thống OCR & Bóc tách Văn bản

Hệ thống đã được nâng cấp lên tiêu chuẩn công nghiệp, có khả năng tự đánh giá độ chính xác (Accuracy Metrics) và xử lý các văn bản hành chính phức tạp (nhiễu, nghiêng, có con dấu).

---

## 🏗️ 1. Kiến trúc Hệ thống

Hệ thống được xây dựng dựa trên 3 trụ cột chính:

- **Tesseract OCR (v5.5)**: Công cụ nhận diện ký tự quang học chính.
- **SkiaSharp**: Xử lý tiền xử lý ảnh (Làm nét, khử nhiễu, chống nghiêng) và sinh dữ liệu kiểm thử.
- **iText7**: Xử lý cấu trúc file PDF và tạo báo cáo đối chiếu.

### Các Component quan trọng:

1. **`OcrService.cs`**:
   - Tự động tìm kiếm thư mục `tessdata` trong project gốc.
   - Cấu hình nhận diện song ngữ `vie+eng` để tối ưu dấu tiếng Việt.
2. **`DocumentExtractorService.cs`**:
   - Sử dụng hệ thống **Priority Ranking (Tính điểm ưu tiên)** để chọn kết quả đúng nhất.
   - Hỗ trợ cả từ khóa **không dấu** (truoc, han, trinh) để chống lỗi OCR.
3. **`AccuracyCalculator.cs`**:
   - Sử dụng thuật toán **Levenshtein Distance** để tính tỷ lệ match (%) giữa văn bản gốc và văn bản OCR.

---

## 📂 2. Cấu trúc Thư mục Quan trọng

- `ToolCalender.Core/tessdata/`: Chứa các file ngôn ngữ (Bắt buộc phải có `vie.traineddata`, `eng.traineddata`, `osd.traineddata`).
- `tests/test_results/`:
  - `Comparison_*.md`: Báo cáo đối chiếu chi tiết (So sánh từng dòng giữa Văn bản gốc và AI đọc được).
- `ToolCalender.Tests/Helpers/AutomationDocHelper.cs`: Công cụ sinh dữ liệu giả lập chất lượng cao.

---

## 🛠️ 3. Hướng dẫn Thiết lập Môi trường mới

Khi mang sang phiên khác, anh cần đảm bảo các bước sau:

### Bước A: Cấu hình Tesseract

- Sao chép bộ dữ liệu ngôn ngữ từ thư mục cài đặt hệ thống vào project:
  ```powershell
  cp "C:\Program Files\Tesseract-OCR\tessdata\eng.traineddata" "d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata\"
  cp "C:\Program Files\Tesseract-OCR\tessdata\osd.traineddata" "d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata\"
  ```

### Bước B: Chạy Kiểm thử Accuracy

Dùng lệnh sau để chạy test và tự động xuất báo cáo Markdown:

```powershell
$tessDataPath = "d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata"
$env:TESSDATA_PREFIX = $tessDataPath
dotnet test --logger "console;verbosity=normal"
```

---

## 📈 4. Trạng thái Hiện tại & Mục tiêu Tiếp theo

- **Accuracy (Noisy/Skew Doc)**: Đạt ~88% (Vượt ngưỡng 85%).
- **Lưu ý quan trọng**: Luôn kiểm tra file `Comparison_Standard_Doc.md` sau mỗi lần chạy để biết chính xác AI đang đọc sai ký tự nào để tinh chỉnh Regex.
