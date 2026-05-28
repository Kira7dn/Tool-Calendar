namespace ToolCalendar.Services.Security;

/// <summary>
/// Kiểm tra chữ ký nhị phân (Magic Bytes) thực sự của file.
/// KHÔNG tin vào tên file hay Content-Type header — hacker có thể giả mạo cả hai.
/// Chỉ tin vào các byte đầu tiên của nội dung file (file signature).
/// </summary>
public static class FileSignatureValidator
{
    // ─── Whitelist: Định dạng được phép upload ───────────────────────────────
    public static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"
    };

    // ─── Magic bytes của từng định dạng ──────────────────────────────────────
    // Tham khảo: https://en.wikipedia.org/wiki/List_of_file_signatures
    private static readonly Dictionary<string, List<byte[]>> Signatures = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"]  = new() { new byte[] { 0x25, 0x50, 0x44, 0x46 } },           // %PDF
        [".doc"]  = new() { new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } }, // OLE2 (Word 97-2003)
        [".xls"]  = new() { new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } }, // OLE2 (Excel 97-2003)
        [".docx"] = new() { new byte[] { 0x50, 0x4B, 0x03, 0x04 } },           // PK (ZIP-based: docx/xlsx/pptx)
        [".xlsx"] = new() { new byte[] { 0x50, 0x4B, 0x03, 0x04 } },           // PK (ZIP-based)
        [".png"]  = new() { new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A } }, // PNG
        [".jpg"]  = new() {
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 },   // JPEG/JFIF
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE1 },   // JPEG/EXIF
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE8 },   // JPEG/SPIFF
            new byte[] { 0xFF, 0xD8, 0xFF, 0xDB },   // JPEG raw
        },
        [".jpeg"] = new() {
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 },
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE1 },
            new byte[] { 0xFF, 0xD8, 0xFF, 0xDB },
        },
    };

    // ─── Kích thước file tối đa cho từng loại ────────────────────────────────
    private static readonly Dictionary<string, long> MaxFileSizes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"]  = 50 * 1024 * 1024,   // 50MB
        [".doc"]  = 30 * 1024 * 1024,   // 30MB
        [".docx"] = 30 * 1024 * 1024,   // 30MB
        [".xls"]  = 20 * 1024 * 1024,   // 20MB
        [".xlsx"] = 20 * 1024 * 1024,   // 20MB
        [".png"]  = 10 * 1024 * 1024,   // 10MB
        [".jpg"]  = 10 * 1024 * 1024,   // 10MB
        [".jpeg"] = 10 * 1024 * 1024,   // 10MB
    };

    /// <summary>
    /// Kiểm tra toàn bộ: extension whitelist + magic bytes + file size
    /// </summary>
    /// <returns>(isValid, errorMessage)</returns>
    public static (bool IsValid, string? Error) Validate(Stream fileStream, string fileName, long fileSize)
    {
        // 1. Kiểm tra extension có trong whitelist không
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
            return (false, $"Định dạng file '{ext}' không được phép. Chỉ chấp nhận: {string.Join(", ", AllowedExtensions)}");

        // 2. Kiểm tra kích thước file
        if (fileSize == 0)
            return (false, "File rỗng, không thể xử lý.");

        if (MaxFileSizes.TryGetValue(ext, out var maxSize) && fileSize > maxSize)
            return (false, $"File quá lớn. Giới hạn cho {ext}: {maxSize / 1024 / 1024}MB, file của bạn: {fileSize / 1024 / 1024}MB");

        // 3. Kiểm tra Magic Bytes — phát hiện file giả extension
        if (!Signatures.TryGetValue(ext, out var validSigs))
            return (false, $"Không có chữ ký nhị phân cho định dạng {ext}.");

        // Đọc tối đa 8 bytes đầu (đủ để kiểm tra tất cả magic bytes)
        var header = new byte[8];
        var originalPosition = fileStream.Position;
        var bytesRead = fileStream.Read(header, 0, header.Length);
        fileStream.Seek(originalPosition, SeekOrigin.Begin); // Reset stream về vị trí ban đầu

        if (bytesRead < 4)
            return (false, "File bị hỏng hoặc quá nhỏ để xác thực.");

        var isSignatureValid = validSigs.Any(sig =>
            bytesRead >= sig.Length &&
            header.Take(sig.Length).SequenceEqual(sig)
        );

        if (!isSignatureValid)
            return (false, $"File '{Path.GetFileName(fileName)}' có nội dung không khớp với định dạng {ext}. Có thể file bị giả mạo extension.");

        return (true, null);
    }

    /// <summary>
    /// Tên file an toàn: xóa ký tự đặc biệt, giữ lại chữ cái, số, dấu gạch
    /// </summary>
    public static string SanitizeFileName(string fileName)
    {
        var ext = Path.GetExtension(fileName);
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);

        // Giữ lại chữ cái, số, dấu gạch dưới, dấu gạch ngang, khoảng trắng
        var sanitized = string.Concat(
            nameWithoutExt
                .Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-' || c == ' ')
                .Take(100)
        ).Trim();

        if (string.IsNullOrEmpty(sanitized)) sanitized = "document";

        return sanitized + ext.ToLower();
    }
}
