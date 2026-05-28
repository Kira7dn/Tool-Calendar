namespace ToolCalendar.Services.Security;

using System.IO;
using System.IO.Compression;

/// <summary>
/// Bảo vệ hệ thống khỏi tấn công Decompression Bomb (Zip Bomb) đối với các file .docx, .xlsx (bản chất là file zip).
/// </summary>
public static class ZipBombDetector
{
    // Cấu hình giới hạn an toàn
    private const long MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024; // Tối đa 100MB sau giải nén
    private const long MAX_COMPRESSION_RATIO = 100;               // Tỷ lệ nén tối đa 100:1
    private const int MAX_FILES_IN_ZIP = 5000;                    // Tối đa 5000 file con để chống CPU Exhaustion

    /// <summary>
    /// Kiểm tra nhanh cấu trúc file nén trước khi lưu trữ hoặc trích xuất (OCR).
    /// </summary>
    /// <returns>(isSafe, errorMessage)</returns>
    public static (bool IsSafe, string? Error) CheckZipBomb(Stream fileStream, long compressedSize)
    {
        try
        {
            var originalPosition = fileStream.Position;
            
            // Đọc cấu trúc zip (không giải nén toàn bộ dữ liệu ra RAM)
            using (var archive = new ZipArchive(fileStream, ZipArchiveMode.Read, leaveOpen: true))
            {
                long totalUncompressedSize = 0;
                int fileCount = 0;

                foreach (var entry in archive.Entries)
                {
                    fileCount++;
                    if (fileCount > MAX_FILES_IN_ZIP)
                        return (false, "Phát hiện tệp tin có quá nhiều cấu trúc con (nghi ngờ tấn công CPU Exhaustion).");

                    totalUncompressedSize += entry.Length;
                    
                    if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE)
                        return (false, $"Phát hiện Decompression Bomb! Dung lượng sau giải nén vượt ngưỡng an toàn ({MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB).");
                }

                // Kiểm tra tỷ lệ nén (Compression Ratio)
                if (compressedSize > 0)
                {
                    long ratio = totalUncompressedSize / compressedSize;
                    if (ratio > MAX_COMPRESSION_RATIO)
                        return (false, $"Phát hiện Decompression Bomb! Tỷ lệ nén bất thường ({ratio}:1) vượt ngưỡng an toàn.");
                }
            }

            fileStream.Seek(originalPosition, SeekOrigin.Begin);
            return (true, null);
        }
        catch (InvalidDataException)
        {
            // Không phải file zip hợp lệ, bỏ qua (có thể là định dạng khác)
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, $"Lỗi cấu trúc tệp tin: {ex.Message}");
        }
    }
}
