namespace ToolCalendar.Services.Security;

using System;
using System.IO;
using System.Threading.Tasks;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;

/// <summary>
/// Xóa bỏ siêu dữ liệu (Metadata) như EXIF (GPS, Tên máy, Phần mềm) khỏi ảnh 
/// để bảo mật thông tin (OSINT prevention).
/// </summary>
public static class MetadataStripper
{
    /// <summary>
    /// Xóa EXIF data của file ảnh và lưu lại.
    /// Trả về true nếu thành công hoặc file không phải ảnh (bỏ qua an toàn).
    /// </summary>
    public static async Task<(bool Success, string? Error)> StripImageMetadataAsync(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLower();
        
        // Chỉ xử lý các file ảnh được hỗ trợ
        if (ext != ".jpg" && ext != ".jpeg" && ext != ".png")
        {
            return (true, null); // Bỏ qua file PDF, DOCX (sẽ xử lý riêng hoặc an toàn)
        }

        try
        {
            // ImageSharp tự động tải dữ liệu ảnh vào bộ nhớ
            using var image = await Image.LoadAsync(filePath);
            
            // Xóa bỏ tất cả các loại metadata nhạy cảm
            image.Metadata.ExifProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            // Lưu đè lại file đã làm sạch
            if (ext == ".png")
            {
                await image.SaveAsPngAsync(filePath, new PngEncoder { ColorType = PngColorType.RgbWithAlpha });
            }
            else
            {
                // JPEG, JPG
                await image.SaveAsJpegAsync(filePath, new JpegEncoder { Quality = 90 });
            }

            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, $"Lỗi khi làm sạch siêu dữ liệu ảnh: {ex.Message}");
        }
    }
}
