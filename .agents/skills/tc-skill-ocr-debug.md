---
trigger: on_demand
description: "Kỹ năng debug luồng OCR — RabbitMQ, PaddleOCR, SignalR pipeline."
---

# TC-SKILL-OCR-DEBUG

Kỹ năng này hướng dẫn cách debug và troubleshoot luồng OCR trong Tool-Calendar.

## Sơ đồ Luồng OCR

```
User upload file (PDF/Image)
        │
        ▼
DocumentsController.Upload()
        │ Lưu file vào /app/data/ hoặc data_dump/
        │ INSERT Documents với Status = 'Đang xử lý OCR'
        │
        ▼
RabbitMQ Queue (push message)
        │
        ▼
OcrQueueService (BackgroundService)
        │ Nhận message từ queue
        │
        ▼
DocumentExtractorService (Facade)
        │
        ├── OcrImageProcessingService
        │       │ PDF → Images (via ImageMagick/PdfPig)
        │       └── HTTP POST → PaddleOCR Python service
        │
        └── OcrTextProcessingService
                │ Regex bóc tách: SoVanBan, TrichYeu, NgayBanHanh, CoQuanBanHanh
                │
                ▼
        UPDATE Documents SET FullText, Status='Chưa xử lý'
                │
                ▼
        SignalR → Broadcast to Client (thông báo realtime)
```

## Debug Checklist

### Khi file upload xong nhưng OCR không chạy:
1. Kiểm tra RabbitMQ service đang chạy:
   ```bash
   docker ps | grep rabbitmq
   # Hoặc
   docker-compose logs rabbitmq
   ```
2. Kiểm tra `OcrQueueService` logs trong ASP.NET Core:
   ```bash
   docker-compose logs api | grep -i "ocr\|rabbit"
   ```
3. Kiểm tra PaddleOCR Python service:
   ```bash
   curl http://localhost:8000/health  # Nếu expose port
   docker-compose logs paddleocr
   ```

### Khi OCR chạy nhưng không bóc tách được metadata:
- Kiểm tra `OcrTextProcessingService` — các Regex pattern cho SoVanBan, NgayBanHanh.
- Test Regex bằng Unit Test trong `OcrTextRegexTests.cs`.
- Log full text OCR ra để xem format thực tế.

### Khi SignalR không push về Client:
1. Kiểm tra frontend đã connect Hub chưa (DevTools → Network → WS tab).
2. Kiểm tra CORS config trong `Program.cs` cho SignalR Hub.
3. Kiểm tra JWT token còn hạn không.

## Key Files

| File | Vai trò |
|---|---|
| `ToolCalendar.Core/Services/DocumentExtractorService.cs` | Facade điều phối |
| `ToolCalendar.Core/Services/OcrImageProcessingService.cs` | Xử lý Image/PDF |
| `ToolCalendar.Core/Services/OcrTextProcessingService.cs` | Regex bóc tách |
| `ToolCalendar.Core/Services/Ocr/OcrDebugArtifactWriter.cs` | Ghi debug artifacts |
| `ToolCalendar.Api/Program.cs` | OcrQueueService registration |

## Khi thêm loại file mới (ví dụ: .docx):
1. Thêm handler trong `OcrImageProcessingService`.
2. Cập nhật whitelist file type trong `DocumentsController.Upload()`.
3. Thêm Unit Test trong `ToolCalendar.Tests/`.
4. Ghi vào `SYSTEM_FEATURES.md` phần "4.2. Luồng OCR".

---
**Status:** ACTIVE  
**Use when:** Debug hoặc mở rộng luồng OCR
