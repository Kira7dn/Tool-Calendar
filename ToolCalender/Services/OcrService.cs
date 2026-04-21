using System.Text;
using Tesseract;
using PDFtoImage;

namespace ToolCalender.Services
{
    public class OcrService
    {
        private static string GetTessDataPath()
        {
            // Kiểm tra đường dẫn mặc định trên Linux (Docker)
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Linux))
            {
                if (Directory.Exists("/usr/share/tesseract-ocr/5/tessdata")) return "/usr/share/tesseract-ocr/5/tessdata";
                if (Directory.Exists("/usr/share/tesseract-ocr/4.00/tessdata")) return "/usr/share/tesseract-ocr/4.00/tessdata";
            }
            
            // Mặc định cho Windows hoặc local
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
                // 1. Chuyển đổi trang PDF đầu tiên thành hình ảnh (PNG stream)
                // Sử dụng PDFtoImage (dựa trên PDFium & SkiaSharp) - chạy được trên Linux
                using var pdfStream = File.OpenRead(filePath);
                
                // Render trang 0 với DPI 300 để OCR chính xác
                using var imageStream = new MemoryStream();
                Conversion.SavePng(
                    imageStream,
                    pdfStream,
                    page: 0,
                    password: null,
                    options: new RenderOptions
                    {
                        Dpi = 300,
                        WithAnnotations = true,
                        WithFormFill = true,
                        WithAspectRatio = false,
                        Rotation = PdfRotation.Rotate0,
                        AntiAliasing = PdfAntiAliasing.All,
                        BackgroundColor = SkiaSharp.SKColors.White
                    });
                imageStream.Position = 0;

                // 2. Khởi tạo Tesseract Engine
                // Lưu ý: Cần có thư mục 'tessdata' chứa file 'vie.traineddata'
                if (!Directory.Exists(tessDataPath))
                {
                    Directory.CreateDirectory(tessDataPath);
                }

                using var engine = new TesseractEngine(tessDataPath, "vie", EngineMode.Default);
                using var img = Pix.LoadFromMemory(imageStream.ToArray());
                using var page = engine.Process(img);

                string text = page.GetText();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    sb.AppendLine(text);
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[Tesseract OCR Error]: {ex.Message}");
                // Nếu thiếu dữ liệu ngôn ngữ, thông báo cho người dùng
                if (ex.Message.Contains("tessdata"))
                {
                    sb.AppendLine("Gợi ý: Đảm bảo thư mục 'tessdata' tồn tại và chứa file 'vie.traineddata'.");
                }
            }

            return await Task.FromResult(sb.ToString());
        }
    }
}
