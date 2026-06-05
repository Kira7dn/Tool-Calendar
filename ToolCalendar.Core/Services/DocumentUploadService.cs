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

        // ─── Tầng 3: Tính SHA-256 ───────────────────────────────────────────
        // Tính hash một lần, dùng cho 2 mục đích:
        //   (a) Kiểm tra tính toàn vẹn file khi truyền (integrity check)
        //   (b) Phát hiện file trùng lặp (deduplication)
        fileStream.Seek(0, SeekOrigin.Begin);
        byte[] fileBytes;
        using (var ms = new MemoryStream())
        {
            await fileStream.CopyToAsync(ms);
            fileBytes = ms.ToArray();
        }

        using var sha256 = SHA256.Create();
        var contentHash = Convert.ToHexString(sha256.ComputeHash(fileBytes)).ToLowerInvariant();

        // ─── Tầng 3.1: Deduplication — tra cứu hash trong DB ────────────────
        var existingDoc = await _documentRepository.GetByContentHashAsync(contentHash);
        if (existingDoc != null)
        {
            // File đã tồn tại — trả về bản ghi cũ, không lưu file mới
            return UploadResult.Duplicate(existingDoc);
        }

        // ─── Lưu file vào thư mục QUARANTINE tạm thời để quét virus ─────────
        var quarantineDir = Path.Combine(_env.ContentRootPath, "Uploads", ".quarantine");
        Directory.CreateDirectory(quarantineDir);

        var safeFileName = FileSignatureValidator.SanitizeFileName(file.FileName);
        var quarantinePath = Path.Combine(quarantineDir, $"{Guid.NewGuid()}_{safeFileName}");

        await File.WriteAllBytesAsync(quarantinePath, fileBytes);

        // ─── Tầng 4: ClamAV Virus Scan ──────────────────────────────────────
        ClamAvScanResult scanResult;
        try
        {
            scanResult = await _clamAv.ScanFileAsync(quarantinePath);
        }
        catch
        {
            scanResult = ClamAvScanResult.ServiceUnavailable; // Fail-open
        }

        if (!scanResult.IsClean)
        {
            if (File.Exists(quarantinePath)) File.Delete(quarantinePath);
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
        var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads");
        Directory.CreateDirectory(uploadsDir);

        var finalFileName = $"{Guid.NewGuid()}_{safeFileName}";
        var finalPath = Path.Combine(uploadsDir, finalFileName);
        File.Move(quarantinePath, finalPath);

        // ─── Lưu vào DB + enqueue OCR ───────────────────────────────────────
        var record = new DocumentRecord
        {
            SoVanBan = Path.GetFileNameWithoutExtension(safeFileName),
            FilePath = $"Uploads/{finalFileName}",
            Status = "Đang xử lý",
            NgayThem = DateTime.Now,
            FullText = "Đang trích xuất tự động...",
            UploadedByUserId = uploadedByUserId,
            ContentHash = contentHash   // ← Lưu hash để dedup về sau
        };

        int id = await _documentRepository.InsertAsync(record);
        record.Id = id;

        await _ocrQueue.EnqueueAsync(id);

        return UploadResult.Success(record);
    }
}
