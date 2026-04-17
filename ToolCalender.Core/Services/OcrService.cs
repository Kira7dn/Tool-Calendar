using System.Text;
using Tesseract;
using PDFtoImage;
using SkiaSharp;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Services
{
    public class OcrService : IOcrService
    {
        private readonly IConfiguration _configuration;

        public OcrService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetTessDataPath()
        {
            // 1. Ưu tiên đọc từ Config (Cả Local appsettings và Docker Env)
            string? configPath = _configuration["OcrSettings:TessDataPath"];
            if (!string.IsNullOrEmpty(configPath) && Directory.Exists(configPath))
            {
                return configPath;
            }

            // 2. Tự động nhận diện trên Linux (Docker System Path)
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Linux))
            {
                if (Directory.Exists("/usr/share/tesseract-ocr/5/tessdata")) 
                    return "/usr/share/tesseract-ocr/5/tessdata";
            }

            // 3. Tự động tìm thư mục ToolCalender.Core/tessdata (Dành cho Dev Local khi không set config)
            var currentDir = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            while (currentDir != null)
            {
                var potentialPath = Path.Combine(currentDir.FullName, "ToolCalender.Core", "tessdata");
                if (Directory.Exists(potentialPath)) return potentialPath;
                
                // Trường hợp chạy ngay tại thư mục Core
                var subPath = Path.Combine(currentDir.FullName, "tessdata");
                if (currentDir.Name == "ToolCalender.Core" && Directory.Exists(subPath)) return subPath;

                currentDir = currentDir.Parent;
            }

            // 4. Fallback cuối cùng
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tessdata");
        }

        public async Task<string> ExtractTextFromPdfOcrAsync(string filePath)
        {
            var sb = new StringBuilder();
            string tessDataPath = GetTessDataPath();
            string lang = _configuration["OcrSettings:Language"] ?? "vie+eng";

            try
            {
                // --- 1. LẤY TỔNG SỐ TRANG ---
                int totalPages = 0;
                using (var reader = new iText.Kernel.Pdf.PdfReader(filePath))
                using (var pdfDoc = new iText.Kernel.Pdf.PdfDocument(reader))
                {
                    totalPages = pdfDoc.GetNumberOfPages();
                }

                // --- 2. DUYỆT TỪNG TRANG ĐỂ OCR ---
                for (int i = 0; i < totalPages; i++)
                {
                    using var pdfStream = File.OpenRead(filePath);
                    using var pageImageStream = new MemoryStream();
                    
                    // Render từng trang (DPI 300 để cân bằng tốc độ/chất lượng cho file dài)
                    Conversion.SavePng(pageImageStream, pdfStream, page: i, dpi: 300);
                    pageImageStream.Position = 0;

                    using var bitmap = SKBitmap.Decode(pageImageStream);
                    if (bitmap == null) continue;

                    // --- 3. TIỀN XỬ LÝ ẢNH TỪNG TRANG ---
                    using var finalBitmap = new SKBitmap(bitmap.Width, bitmap.Height);
                    using (var canvas = new SKCanvas(finalBitmap)) {
                        canvas.Clear(SKColors.White);
                        
                        // Grayscale chuẩn
                        float[] grayscaleMatrix = {
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0, 0, 0, 1, 0
                        };
                        using var cf = SKColorFilter.CreateColorMatrix(grayscaleMatrix);
                        
                        // Sharpening
                        float[] sharpenKernel = { 0, -1, 0, -1, 5, -1, 0, -1, 0 };
                        using var filter = SKImageFilter.CreateMatrixConvolution(
                            new SKSizeI(3, 3), sharpenKernel, 1f, 0f, new SKPointI(1, 1), 
                            SKShaderTileMode.Clamp, false);
                        
                        using var paint = new SKPaint { ColorFilter = cf, ImageFilter = filter };
                        canvas.DrawBitmap(bitmap, 0, 0, paint);
                    }

                    // --- 4. NHẬN DIỆN HƯỚNG VÀ XOAY ẢNH VẬT LÝ (OSD) ---
                    using var stream = new SKDynamicMemoryWStream();
                    finalBitmap.Encode(stream, SKEncodedImageFormat.Png, 100);
                    using var pix = Pix.LoadFromMemory(stream.DetachAsData().ToArray());

                    SKBitmap rotatedBitmap = null;
                    string osdInfo = "";
                    using (var osdEngine = new TesseractEngine(tessDataPath, lang, EngineMode.Default))
                    {
                        using (var osdPage = osdEngine.Process(pix, PageSegMode.AutoOsd))
                        {
                            osdPage.DetectBestOrientation(out Orientation orientation, out float confidence);
                            osdInfo = $" [OSD: {orientation}({confidence:F1})]";
                            
                            // Nếu phát hiện ảnh bị xoay và độ tự tin đủ tốt
                            if (orientation != Orientation.PageUp && confidence > 3.0f)
                            {
                                rotatedBitmap = FixOrientation(finalBitmap, orientation);
                            }
                        }
                    }

                    // --- 5. OCR CHÍNH THỨC ---
                    using (var engine = new TesseractEngine(tessDataPath, lang, EngineMode.Default)) 
                    {
                        engine.SetVariable("preserve_interword_spaces", "1");
                        
                        using var finalStream = new SKDynamicMemoryWStream();
                        var bitmapToProcess = rotatedBitmap ?? finalBitmap;
                        bitmapToProcess.Encode(finalStream, SKEncodedImageFormat.Png, 100);
                        
                        using var finalPix = Pix.LoadFromMemory(finalStream.DetachAsData().ToArray());
                        // Sau khi xoay vật lý, ta dùng PageSegMode.Auto (PSM 3) để bóc tách tốt nhất
                        using var page = engine.Process(finalPix, PageSegMode.Auto); 
                        
                        string resultText = page.GetText();
                        if (!string.IsNullOrWhiteSpace(resultText)) {
                            sb.AppendLine($"--- Trang {i + 1}{osdInfo} ---");
                            sb.AppendLine(resultText);
                        }
                    }

                    rotatedBitmap?.Dispose();
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[OCR Error]: {ex.Message}");
            }

            return await Task.FromResult(sb.ToString());
        }

        private SKBitmap FixOrientation(SKBitmap bitmap, Orientation orientation)
        {
            float degrees = 0;
            switch (orientation)
            {
                case Orientation.PageRight: degrees = -90; break;
                case Orientation.PageDown: degrees = 180; break;
                case Orientation.PageLeft: degrees = 90; break;
            }

            if (degrees == 0) return null;

            // Tính toán kích thước mới sau khi xoay
            int newWidth = (degrees % 180 == 0) ? bitmap.Width : bitmap.Height;
            int newHeight = (degrees % 180 == 0) ? bitmap.Height : bitmap.Width;

            var rotated = new SKBitmap(newWidth, newHeight);
            using (var canvas = new SKCanvas(rotated))
            {
                canvas.Clear(SKColors.White);
                canvas.Translate(newWidth / 2f, newHeight / 2f);
                canvas.RotateDegrees(degrees);
                canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
                canvas.DrawBitmap(bitmap, 0, 0);
            }
            return rotated;
        }
    }
}
