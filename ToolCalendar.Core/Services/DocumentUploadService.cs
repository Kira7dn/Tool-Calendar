namespace ToolCalendar.Services;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.Security.Cryptography;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;
using ToolCalendar.Services.Security;

/// <summary>
/// Triển khai IDocumentUploadService — xử lý toàn bộ luồng upload file văn bản.
/// Logic này được tách ra từ DocumentsController để Controller chỉ còn trách nhiệm HTTP.
/// </summary>
public class DocumentUploadService : IDocumentUploadService
{
    private readonly IDocumentRepository _documentRepository;
    private readonly IOcrQueueService _ocrQueue;
    private readonly IClamAvService _clamAv;
    private readonly IWebHostEnvironment _env;

    public DocumentUploadService(
        IDocumentRepository documentRepository,
        IOcrQueueService ocrQueue,
        IClamAvService clamAv,
        IWebHostEnvironment env)
    {
        _documentRepository = documentRepository;
        _ocrQueue = ocrQueue;
        _clamAv = clamAv;
        _env = env;
    }

    /// <inheritdoc/>
    public async Task<UploadResult> UploadAsync(IFormFile file, int uploadedByUserId)
    {
        // ─── Tầng 1: Kiểm tra null ──────────────────────────────────────────
        if (file == null || file.Length == 0)
            return UploadResult.Failure("Không có file.");

        using var fileStream = file.OpenReadStream();

        // ─── Tầng 1.5: SHA-256 Deduplication (Chống trùng lặp nội dung) ─────
        string contentHash;
        using (var sha256 = SHA256.Create())
        {
            var hashBytes = await sha256.ComputeHashAsync(fileStream);
            contentHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
        }
        fileStream.Seek(0, SeekOrigin.Begin);

        var existingDoc = await _documentRepository.GetByContentHashAsync(contentHash);
        if (existingDoc != null)
        {
            string docName = !string.IsNullOrEmpty(existingDoc.SoVanBan) ? existingDoc.SoVanBan : existingDoc.TenCongVan;
            return UploadResult.Failure($"Tài liệu này đã tồn tại trong hệ thống (Trùng lặp nội dung với: {docName}).");
        }

        // ─── Tầng 2: Magic Bytes + Extension whitelist + Size limit ─────────
        var (isValidSignature, signatureError) = FileSignatureValidator.Validate(
            fileStream, file.FileName, file.Length);

        if (!isValidSignature)
            return UploadResult.Failure(signatureError!);

        // ─── Tầng 2.1: Chống Zip Bomb ───────────────────────────────────────
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (ext == ".docx" || ext == ".xlsx" || ext == ".zip")
        {
            var (isSafeZip, zipError) = ZipBombDetector.CheckZipBomb(fileStream, file.Length);
            if (!isSafeZip)
                return UploadResult.Failure(zipError!);
        }

        // ─── Tầng 3: Stream file trực tiếp xuống ổ cứng (TIẾT KIỆM RAM) ─────
        var quarantineDir = Path.Combine(_env.ContentRootPath, "Uploads", ".quarantine");
        Directory.CreateDirectory(quarantineDir);

        var safeFileName = FileSignatureValidator.SanitizeFileName(file.FileName);
        var quarantinePath = Path.Combine(quarantineDir, $"{Guid.NewGuid()}_{safeFileName}");

        fileStream.Seek(0, SeekOrigin.Begin);
        // Ghi thẳng xuống file tạm, dùng bộ đệm siêu nhỏ (4KB)
        using (var fs = new FileStream(quarantinePath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
        {
            await fileStream.CopyToAsync(fs);
        }

        // (Hash check đã thực hiện ở trên cùng để fail-fast, không cần tính lại ở đây)

        // ─── Tầng 4: ClamAV Virus Scan ──────────────────────────────────────
        ClamAvScanResult scanResult;
        try
        {
            scanResult = await _clamAv.ScanFileAsync(quarantinePath);
        }
        catch
        {
            scanResult = ClamAvScanResult.ServiceUnavailable; // Fail-closed
        }

        if (!scanResult.IsClean)
        {
            if (File.Exists(quarantinePath)) File.Delete(quarantinePath);
            
            if (scanResult.IsServiceUnavailable)
            {
                return UploadResult.Failure("❌ Hệ thống quét virus đang bảo trì hoặc quá tải. Vui lòng thử lại sau.");
            }
            
            return UploadResult.Failure(
                $"❌ File bị từ chối: phát hiện mã độc ({scanResult.VirusName}). Liên hệ quản trị viên.");
        }

        // ─── Tầng 4.1: Xóa siêu dữ liệu ảnh (EXIF/GPS) ────────────────────
        var (isMetadataStripped, metadataError) = await MetadataStripper.StripImageMetadataAsync(quarantinePath);
        if (!isMetadataStripped)
        {
            if (File.Exists(quarantinePath)) File.Delete(quarantinePath);
            return UploadResult.Failure(metadataError!);
        }

        // ─── File đã qua kiểm tra → chuyển vào Uploads chính thức ──────────
        var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "Documents");
        Directory.CreateDirectory(uploadsDir);

        var finalFileName = $"{Guid.NewGuid()}_{safeFileName}{ext}";
        var finalPath = Path.Combine(uploadsDir, finalFileName);
        File.Move(quarantinePath, finalPath);

        // ─── Lưu vào DB + enqueue OCR ───────────────────────────────────────
        var record = new DocumentRecord
        {
            SoVanBan = Path.GetFileNameWithoutExtension(safeFileName),
            FilePath = $"Uploads/Documents/{finalFileName}",
            Status = "Đang OCR",
            NgayThem = DateTime.Now,
            FullText = "Đang trích xuất tự động...",
            UploadedByUserId = uploadedByUserId,
            ContentHash = contentHash // Lưu hash vào DB để check trùng lặp lần sau
        };

        int id = 0;
        int maxRetries = 15; // Thử tối đa 15 lần
        int baseDelayMs = 50;

        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                id = await _documentRepository.InsertAsync(record);
                break; // Ghi thành công, thoát vòng lặp
            }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 5 || ex.SqliteErrorCode == 10 || ex.SqliteErrorCode == 14)
            {
                // Error 5: SQLITE_BUSY, Error 10: SQLITE_IOERR, Error 14: SQLITE_CANTOPEN
                if (i == maxRetries - 1)
                {
                    // Hết số lần thử mà vẫn lỗi -> Xóa file vừa lưu để tránh file rác
                    if (File.Exists(finalPath)) File.Delete(finalPath);
                    throw; 
                }
                
                // Exponential Backoff với Jitter (tránh đồng loạt thử lại cùng lúc)
                int delay = baseDelayMs * (int)Math.Pow(1.5, i) + Random.Shared.Next(10, 50);
                await Task.Delay(delay);
            }
        }
        
        record.Id = id;
        await _ocrQueue.EnqueueAsync(id);

        return UploadResult.Success(record);
    }
}
