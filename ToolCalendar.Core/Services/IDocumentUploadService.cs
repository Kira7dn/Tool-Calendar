namespace ToolCalendar.Services;

using Microsoft.AspNetCore.Http;
using ToolCalendar.Models;

/// <summary>
/// Kết quả trả về sau khi upload file.
/// </summary>
public class UploadResult
{
    /// <summary>Upload thành công hay không.</summary>
    public bool IsSuccess { get; init; }

    /// <summary>
    /// Nếu true: file này đã tồn tại trong hệ thống (trùng nội dung).
    /// Controller sẽ trả về 409 Conflict thay vì 200 OK.
    /// </summary>
    public bool IsDuplicate { get; init; }

    /// <summary>Bản ghi document (mới hoặc bản ghi cũ nếu trùng lặp).</summary>
    public DocumentRecord? Document { get; init; }

    /// <summary>Thông báo lỗi nếu IsSuccess = false.</summary>
    public string? ErrorMessage { get; init; }

    // --- Factory helpers ---
    public static UploadResult Success(DocumentRecord doc) =>
        new() { IsSuccess = true, Document = doc };

    public static UploadResult Duplicate(DocumentRecord existingDoc) =>
        new() { IsSuccess = true, IsDuplicate = true, Document = existingDoc };

    public static UploadResult Failure(string error) =>
        new() { IsSuccess = false, ErrorMessage = error };
}

/// <summary>
/// Service xử lý toàn bộ luồng nghiệp vụ upload file văn bản.
/// Tách logic ra khỏi Controller để Controller chỉ xử lý HTTP in/out.
/// </summary>
public interface IDocumentUploadService
{
    /// <summary>
    /// Xử lý upload một file văn bản:
    /// 1. Validate file (magic bytes, extension, size)
    /// 2. Kiểm tra Zip Bomb
    /// 3. Tính SHA-256 hash → kiểm tra trùng lặp
    /// 4. Quét virus ClamAV (trong thư mục quarantine)
    /// 5. Xóa siêu dữ liệu ảnh (EXIF)
    /// 6. Chuyển file vào Uploads chính thức
    /// 7. Lưu vào DB + enqueue OCR
    /// </summary>
    Task<UploadResult> UploadAsync(IFormFile file, int uploadedByUserId);
}
