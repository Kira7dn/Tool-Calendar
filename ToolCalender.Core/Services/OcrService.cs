using System.Text;
using Tesseract;
using PDFtoImage;
using SkiaSharp;

namespace ToolCalender.Services
{
    public class OcrService
    {
        private static string GetTessDataPath()
        {
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Linux))
            {
                if (Directory.Exists("/usr/share/tesseract-ocr/5/tessdata")) return "/usr/share/tesseract-ocr/5/tessdata";
            }
            string localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tessdata");
            if (!Directory.Exists(localPath)) Directory.CreateDirectory(localPath);
            return localPath;
        }

        public static async Task<string> ExtractTextFromPdfOcrAsync(string filePath)
        {
            var sb = new StringBuilder();
            string tessDataPath = GetTessDataPath();

            try
            {
                using var pdfStream = File.OpenRead(filePath);
                using var rawImageStream = new MemoryStream();
                Conversion.SavePng(rawImageStream, pdfStream, page: 0, dpi: 300);
                rawImageStream.Position = 0;

                using var bitmap = SKBitmap.Decode(rawImageStream);
                if (bitmap == null) throw new Exception("Không thể decode ảnh.");

                // --- 1. LÀM SẮC NÉT (SHARPENING) ---
                using var sharpenedBitmap = new SKBitmap(bitmap.Width, bitmap.Height);
                using (var canvas = new SKCanvas(sharpenedBitmap)) {
                    canvas.Clear(SKColors.White);
                    // Ma trận làm nét 3x3
                    float[] kernel = { 0, -1, 0, -1, 5, -1, 0, -1, 0 };
                    using var filter = SKImageFilter.CreateMatrixConvolution(
                        new SKSizeI(3, 3), kernel, 1f, 0f, new SKPointI(1, 1), 
                        SKShaderTileMode.Clamp, false);
                    using var paint = new SKPaint { ImageFilter = filter };
                    canvas.DrawBitmap(bitmap, 0, 0, paint);
                }

                // --- 2. XỬ LÝ NHỊ PHÂN & CHỐNG NGHIÊNG (DESKEW) ---
                using (var engine = new TesseractEngine(tessDataPath, "vie", EngineMode.Default)) {
                    // Chuyển bitmap sang Pix
                    using var stream = new SKDynamicMemoryWStream();
                    sharpenedBitmap.Encode(stream, SKEncodedImageFormat.Png, 100);
                    using var originalPix = Pix.LoadFromMemory(stream.DetachAsData().ToArray());

                    // Tự động chống nghiêng bằng Leptonica (Tích hợp trong Tesseract)
                    using var deskewedPix = originalPix.Deskew();

                    // Nhận diện chính thức trên ảnh đã xoay thẳng
                    using var finalPage = engine.Process(deskewedPix ?? originalPix);
                    string resultText = finalPage.GetText();
                    if (!string.IsNullOrWhiteSpace(resultText)) sb.AppendLine(resultText);
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[OCR Error]: {ex.Message}");
            }

            return await Task.FromResult(sb.ToString());
        }
    }
}
