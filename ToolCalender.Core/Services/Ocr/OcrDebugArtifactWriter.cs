using SkiaSharp;

namespace ToolCalender.Services
{
    internal static class OcrDebugArtifactWriter
    {
        public static string? SaveBitmapDebug(SKBitmap bitmap, ResolvedOcrOptions options, string baseName, int pageNumber, string suffix)
        {
            if (!options.EnableDebug)
            {
                return null;
            }

            string filePath = Path.Combine(options.DebugPath, $"{baseName}_p{pageNumber}_{suffix}.png");
            using var fs = File.Create(filePath);
            bitmap.Encode(fs, SKEncodedImageFormat.Png, 100);
            return filePath;
        }

        public static string? SaveFinalDebugBitmap(SKBitmap bitmap, ResolvedOcrOptions options, string baseName, int pageNumber)
        {
            return SaveBitmapDebug(bitmap, options, baseName, pageNumber, "4_final_ocr");
        }
    }
}
