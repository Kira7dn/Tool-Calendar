# Kế hoạch tích hợp Cấu hình chung vào việc bóc tách Thời Hạn

1. **Backend (C#): ToolCalendar.Core**
   - Sửa `DocumentProcessingService.cs` để gọi `IAppSettingRepository` lấy `Document_DeadlineKeywords` và `Document_DeadlineExcludeKeywords`.
   - Truyền chúng vào `aiService.ExtractMetadataAsync(...)`.

2. **Backend (C#): ToolCalendar.Core/Services/PythonAiService.cs**
   - Sửa `ExtractMetadataAsync` để nhận thêm tham số `deadlineKeywords`, `excludeKeywords`.
   - Sửa request truyền lên Python chứa các tham số mới.

3. **Python AI Service (Python): python-ai-service/main.py**
   - Thêm `deadline_keywords` và `deadline_exclude_keywords` vào `ExtractMetadataRequest`.
   - Cập nhật hàm `_regex_extract` để xử lý logic: tìm các từ khóa thời hạn trong văn bản, kết hợp regex bắt ngày/tháng/năm để suy ra `ThoiHan`.
