# 🚀 Tài liệu Kỹ thuật & Cách chạy OCR Tests (Current Code Baseline)

Tài liệu này mô tả **flow OCR hiện tại trong code** và **cách chạy test đúng theo kiến trúc mới**.

Lưu ý quan trọng:

- Runtime OCR hiện tại dùng **`tesseract` CLI**, không còn dùng `TesseractEngine` .NET wrapper cũ.
- Môi trường chuẩn để chạy OCR là **Docker/Linux container**.
- README cũ từng mô tả pipeline wrapper-based; khi README và code khác nhau thì **code hiện tại là nguồn sự thật**.

---

## 🏗️ 1. Trạng thái hiện tại

Hệ thống hiện dùng:

- **`tesseract` CLI 5.x** với ngôn ngữ `vie+eng` cho OCR chính.
- **`tesseract -l osd --psm 0`** cho nhận diện hướng trang.
- **PDFtoImage** để render PDF sang ảnh theo từng trang.
- **SkiaSharp** để tiền xử lý ảnh và lưu debug image.
- **iText 7** để trích xuất lớp text số bổ sung cho PDF.

Pipeline hiện đã được harden lại để tránh lỗi native binding trong Docker/Linux và vẫn giữ các config OCR cũ như `EnableOsd`, `EnableDeskew`, `DeskewMinAbsAngle`, `OsdMinConfidence`.

---

## 📂 2. Cấu trúc Mã nguồn

- `ToolCalender.Core\Services\OcrService.cs`: Pipeline OCR thực tế đang chạy qua `tesseract` CLI.
- `ToolCalender.Core\Services\DocumentExtractorService.cs`: Ghép OCR text với text số từ PDF và parse dữ liệu nghiệp vụ.
- `ToolCalender.Tests\Helpers\AutomationDocHelper.cs`: Sinh dữ liệu PDF test giả lập.
- `ToolCalender.Tests\Helpers\TestPathHelper.cs`: Resolve đường dẫn repo/tests/fonts theo môi trường Windows hoặc Docker/Linux.
- `ToolCalender.Tests\OcrAutomationTests.cs`: Test OCR + parse trên tài liệu chuẩn và noisy document.
- `ToolCalender.Tests\OcrStressTests.cs`: Test stress cho multi-page, rotated page, border noise.
- `ToolCalender.Tests\RealDocumentTests.cs`: Test trên tài liệu thực tế.

---

## ⚙️ 3. Flow thực tế trong code

### Tầng A: Trích xuất hỗn hợp (Hybrid Extraction)

Với file PDF, `DocumentExtractorService` hiện chạy theo thứ tự:

1. Gọi `IOcrService.ExtractTextFromPdfOcrAsync(filePath)` để OCR toàn bộ PDF.
2. Gọi `ExtractFromPdf(filePath)` để lấy thêm text số trực tiếp từ PDF:
   - text trên page,
   - annotation contents,
   - appearance stream,
   - XObject/Form XObject,
   - AcroForm fields.
3. Nối 2 nguồn text lại rồi đưa vào `ParseTextAsync(...)`.

Lưu ý:

- Đây là cơ chế **concatenation**.
- Hiện **không có** logic `Digital First` hoặc bỏ qua OCR nếu PDF đã có text layer tốt.

### Tầng B: OCR pipeline trong `OcrService.cs`

Với mỗi file PDF, `OcrService` hiện chạy như sau:

1. **Xác định tessdata path**
   - Ưu tiên `OcrSettings:TessDataPath`.
   - Nếu chạy Linux thì thử `/usr/share/tesseract-ocr/5/tessdata`.
   - Nếu không có thì dò lên cây thư mục để tìm `ToolCalender.Core/tessdata`.

2. **Xác định thư mục debug**
   - Tự dò root solution qua `.sln` hoặc `.slnx`.
   - Luôn tạo thư mục:
     `tests/test_results/actual_test/debug_images/`

3. **Đếm số trang PDF**
   - Mở một stream riêng để lấy `totalPages`.

4. **Xác định parallelism theo trang**
   - Đọc `OcrSettings:MaxParallelPages` nếu có.
   - Mặc định giới hạn song song ở mức an toàn cho Docker.

5. **Duyệt từng trang**
   - Mỗi trang được render bằng `PDFtoImage` ở **300 DPI**.

6. **Stage 1: Raw image**
   - Ảnh render gốc được lưu thành:
     `*_p{page}_1_raw.png`

7. **Stage 2: Preprocessed image**
   - Ảnh được tiền xử lý bằng SkiaSharp:
     - grayscale BT.601,
     - sharpen kernel 3x3: `{ -1, -1, -1, -1, 9, -1, -1, -1, -1 }`
   - Kết quả được lưu thành:
     `*_p{page}_2_preprocessed.png`

8. **OSD pipeline**
   - Tạo ảnh phụ cho OSD bằng cách:
     - crop 10% viền,
     - grayscale,
     - blur nhẹ `0.8`.
   - Chạy `tesseract <image> stdout -l osd --psm 0`.
   - Parse output `Rotate:` và `Orientation confidence:`.
   - Nếu `Rotate != 0` và `confidence > OsdMinConfidence`, service mới xem xét xoay.
   - Logic an toàn hiện tại:
     - ưu tiên xoay `180°`,
     - với xoay `90°/270°`, chỉ xoay nếu điều kiện tin cậy đủ tốt theo logic portrait-lock hiện đang cài trong code.
   - Nếu xoay, service tạo `rotatedBitmap` bằng `FixOrientation(...)`.
   - Thông tin OSD được gắn vào header output dạng:
     - `[OSD Fixed: .../Conf: ...]`
     - hoặc `[OSD Blocked: Portrait-Lock for .../Conf: ...]`
     - hoặc `[OSD Error: ...]`

9. **Deskew + OCR**
   - Ảnh cuối trước OCR là `rotatedBitmap ?? finalBitmap`.
   - Nếu `EnableDeskew=true`, service ước lượng góc nghiêng bằng projection score trên ảnh đã preprocess.
   - Chỉ deskew khi `abs(angle) >= DeskewMinAbsAngle`.
   - OCR chính chạy bằng:
     `tesseract <image> stdout -l vie+eng --psm 3 -c preserve_interword_spaces=1`

10. **Stage 3: OSD result image**
   - Sau khi OCR xong, ảnh đang dùng để OCR trước deskew được lưu thành:
     `*_p{page}_3_osd_result.png`

11. **Output text**
   - Mỗi trang thành công sẽ append:
     `--- Trang X{osdInfo} ---`
   - Nếu lỗi ở mức trang sẽ append:
     `--- Trang X [Lỗi OCR] ---`

### Tầng C: Parse nghiệp vụ trong `DocumentExtractorService`

Sau khi có text tổng hợp, service parse các trường:

- `SoVanBan`
- `NgayBanHanh`
- `ThoiHan`
- `CoQuanBanHanh`
- `CoQuanChuQuan`
- `DonViChiDao`
- `TrichYeu`

Logic parse hiện dùng:

- Unicode normalization `FormC`
- sửa một số lỗi ký tự OCR phổ biến
- regex ưu tiên ngữ cảnh cho số văn bản
- regex ưu tiên ngữ cảnh cho thời hạn
- fallback đọc số văn bản từ tên file nếu cần

---

## 🧪 4. Cách chạy test đúng

### Môi trường khuyến nghị

Chạy OCR tests **bên trong container backend** vì đó là runtime chuẩn có sẵn `tesseract`, `tessdata`, và Linux native libs.

### Lệnh chạy trong Docker

Chạy đúng 2 suite OCR automation + real document:

```bash
docker exec doc-coordination-system dotnet test /app/ToolCalender.Tests/ToolCalender.Tests.csproj --filter "FullyQualifiedName~ToolCalender.Tests.OcrAutomationTests|FullyQualifiedName~ToolCalender.Tests.RealDocumentTests" -v minimal
```

Chạy stress tests:

```bash
docker exec doc-coordination-system dotnet test /app/ToolCalender.Tests/ToolCalender.Tests.csproj --filter "FullyQualifiedName~ToolCalender.Tests.OcrStressTests" -v minimal
```

Chạy toàn bộ OCR tests:

```bash
docker exec doc-coordination-system dotnet test /app/ToolCalender.Tests/ToolCalender.Tests.csproj --filter "FullyQualifiedName~ToolCalender.Tests.Ocr" -v minimal
```

### Chạy trên host

Chỉ nên chạy trên host nếu máy host có `tesseract` trong `PATH`.

Nếu host không có `tesseract`, các OCR tests sẽ không phản ánh đúng runtime production và không nên coi là nguồn sự thật.

## 📌 5. Các suite test hiện có

### OcrAutomationTests

Các test hiện có:

- `OcrProfessional_FullLongDocument_WithNoiseAndSkew_ShouldSucceed`
- `FullWorkflow_StandardDocument_ShouldPass`

Đặc điểm:

- Dùng `AutomationDocHelper` để sinh PDF test.
- `DocumentExtractorService` được gọi để kiểm tra parse dữ liệu.
- Sau đó test còn gọi OCR thêm một lần nữa để tính accuracy và ghi report Markdown.

### OcrStressTests

Các test stress hiện có:

- `ExtractMultiPage_ShouldReadEverything`
- `ExtractRotatedPage_ShouldAutoFixOrientation`
- `ExtractBorderNoisePage_ShouldIgnoreBorders`

Các case này đo độ chính xác OCR trên tài liệu scan giả lập nhiều trang, xoay ngang và có viền nhiễu.

### RealDocumentTests

Test thực tế hiện có:

- `Manual_Ocr_QuyetDinh189`

Đặc điểm:

- Chạy OCR trực tiếp trên file thực tế trong:
  `tests/test_results/actual_test/Quyết định 189.pdf`
- Ghi report ra:
  `tests/test_results/actual_test/Quyết định 189_result.md`

Lưu ý:

- Các test OCR hiện đã resolve path động theo repo root, không phụ thuộc cứng vào `d:\...`.
- Font test được resolve theo hệ điều hành:
  - Windows dùng font hệ thống `Arial/Times`
  - Docker/Linux dùng `DejaVu Sans/Serif`
- Mỗi run của OCR test tự tạo SQLite DB riêng để tránh va chạm file lock khi chạy trong Docker/Linux.
- Trên Linux/Docker, SQLite test DB được đặt ở `/tmp/test_dbs` để tránh lỗi `disk I/O error` trên mounted volume.

---

## 🔍 6. Artifacts hiện có

### Markdown reports

- `tests/test_results/Comparison_*.md`
- `tests/test_results/stress_tests/Comparison_*.md`
- `tests/test_results/actual_test/Quyết định 189_result.md`

### Debug images

Hiện code lưu 4 chặng ảnh:

- `*_1_raw.png`
- `*_2_preprocessed.png`
- `*_3_osd_result.png`
- `*_4_final_ocr.png`

---

## 🎯 7. Chiến lược cải thiện "Lean & Smart" (Tập trung mục tiêu)

Các hạng mục dưới đây **chưa phản ánh đầy đủ code hiện tại** hoặc mới là hướng cải tiến:

1. **Digital First**
   - Nếu PDF đã có text layer đủ tốt thì bỏ qua OCR để tăng tốc.

2. **Đưa debug path/debug mode ra cấu hình thật**
   - Tôn trọng `OcrSettings:EnableDebug` và `OcrSettings:DebugPath` thay vì hard-code trong service.

3. **Khôi phục Stage 4 debug image**
   - Lưu được ảnh sau deskew mà không dùng nhánh native không ổn định.

4. **Hợp nhất phép xoay**
   - Tính orientation + skew rồi chỉ xoay một lần để giảm mờ ảnh.

5. **Deskew có điều kiện**
   - Chỉ deskew khi góc nghiêng đủ lớn, tránh tốn thời gian và tránh làm ảnh mềm đi không cần thiết.

6. **Skip blank page**
   - Bỏ qua trang trắng bằng đo mật độ điểm ảnh.

7. **Border purge**
   - Xóa viền đen máy scan trước OCR.

8. **Adaptive thresholding**
   - Nhị phân hóa thích nghi cho tài liệu ánh sáng xấu hoặc scan không đều.

9. **Blob filtering**
   - Lọc nhiễu hạt theo diện tích vùng mực.

10. **Line retention / tabular logic**
   - Hỗ trợ tốt hơn cho tài liệu có bảng biểu, đường kẻ.

11. **Tối ưu hiệu năng test**
   - Tránh gọi OCR hai lần trong cùng một test automation.

12. **Phân loại rõ test groups**
   - Chuẩn hóa trait/category để `dotnet test --filter ...` phản ánh đúng nhóm test thực tế.

---

## 📝 8. Ghi chú vận hành

- Khi cần hiểu tình trạng thực tế của pipeline, ưu tiên đọc:
  - `ToolCalender.Core\Services\OcrService.cs`
  - `ToolCalender.Core\Services\DocumentExtractorService.cs`
- Khi tài liệu README và code khác nhau, **code hiện tại là nguồn sự thật**.
