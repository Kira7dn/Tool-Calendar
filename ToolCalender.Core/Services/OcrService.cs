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
            
            // Xác định thư mục debug tại Root Solution (Hỗ trợ cả .sln và .slnx)
            string rootDir = AppDomain.CurrentDomain.BaseDirectory;
            while (rootDir != null)
            {
                if (Directory.GetFiles(rootDir, "*.sln*").Length > 0) break;
                rootDir = Path.GetDirectoryName(rootDir);
            }
            string debugPath = Path.Combine(rootDir ?? AppDomain.CurrentDomain.BaseDirectory, "tests", "test_results", "actual_test", "debug_images");
            Directory.CreateDirectory(debugPath);

            try
            {
                // --- 1. LẤY TỔNG SỐ TRANG (Mở stream riêng để đếm trang) ---
                int totalPages = 0;
                using (var fsCount = File.OpenRead(filePath))
                using (var reader = new iText.Kernel.Pdf.PdfReader(fsCount))
                using (var pdfDoc = new iText.Kernel.Pdf.PdfDocument(reader))
                {
                    totalPages = pdfDoc.GetNumberOfPages();
                }

                // --- 2. KHỞI TẠO ENGINE MỘT LẦN DUY NHẤT (QUAN TRỌNG ĐỂ CỨU FLOW) ---
                using var mainEngine = new TesseractEngine(tessDataPath, lang, EngineMode.Default);
                using var osdEngine = new TesseractEngine(tessDataPath, "osd", EngineMode.Default);
                mainEngine.SetVariable("preserve_interword_spaces", "1");

                // --- 3. DUYỆT TỪNG TRANG ---
                for (int i = 0; i < totalPages; i++)
                {
                    try
                    {
                        using var pdfStream = File.OpenRead(filePath);
                        using var pageImageStream = new MemoryStream();
                    // Render từng trang (DPI 300 là tối ưu để tránh nhiễu hạt quá mức)
                    Conversion.SavePng(pageImageStream, pdfStream, page: i, dpi: 300);
                    pageImageStream.Position = 0;

                    using var bitmap = SKBitmap.Decode(pageImageStream);
                    if (bitmap == null) continue;

                    // --- LƯU DEBUG: STAGE 1 (RAW IMAGE) ---
                    try
                    {
                        string fileName = $"{Path.GetFileNameWithoutExtension(filePath)}_p{i + 1}_1_raw.png";
                        using var debugFs = File.Create(Path.Combine(debugPath, fileName));
                        bitmap.Encode(debugFs, SKEncodedImageFormat.Png, 100);
                    }
                    catch { }

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
                        
                        // Sharpening mạnh hơn để tăng độ tương phản nét chữ
                        float[] sharpenKernel = { -1, -1, -1, -1, 9, -1, -1, -1, -1 };
                        using var filter = SKImageFilter.CreateMatrixConvolution(
                            new SKSizeI(3, 3), sharpenKernel, 1f, 0f, new SKPointI(1, 1), 
                            SKShaderTileMode.Clamp, false);
                        
                        using var paint = new SKPaint { ColorFilter = cf, ImageFilter = filter };
                        canvas.DrawBitmap(bitmap, 0, 0, paint);
                    }

                    // --- LƯU DEBUG: STAGE 2 (PREPROCESSED) ---
                    try
                    {
                        string fileName = $"{Path.GetFileNameWithoutExtension(filePath)}_p{i + 1}_2_preprocessed.png";
                        using var debugFs = File.Create(Path.Combine(debugPath, fileName));
                        finalBitmap.Encode(debugFs, SKEncodedImageFormat.Png, 100);
                    }
                    catch { }

                    // --- 4. NHẬN DIỆN HƯỚNG VÀ XOAY ẢNH VẬT LÝ (OSD) ---
                    // --- 4. NHẬN DIỆN HƯỚNG CHUYÊN BIỆT (PROFESSIONAL OSD PIPELINE) ---
                    SKBitmap? rotatedBitmap = null;
                    string osdInfo = "";
                    
                    try
                    {
                        // Bước A: Chuẩn bị ảnh chuyên dụng cho OSD (Best Practice: Grayscale + Median Blur + 10% Crop)
                        int osdMargin = (int)(finalBitmap.Width * 0.1); 
                        var osdRect = new SKRectI(osdMargin, osdMargin, finalBitmap.Width - osdMargin, finalBitmap.Height - osdMargin);
                        
                        using var osdSurface = SKSurface.Create(new SKImageInfo(osdRect.Width, osdRect.Height, SKColorType.Gray8));
                        using var osdCanvas = osdSurface.Canvas;
                        
                        // Ma trận Gray BT.601
                        float[] GrayMatrix = {
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0.299f, 0.587f, 0.114f, 0, 0,
                            0, 0, 0, 1, 0
                        };

                        using (var osdPaint = new SKPaint { 
                            ColorFilter = SKColorFilter.CreateColorMatrix(GrayMatrix),
                            // Median Blur ẩn trong thư viện SkiaSharp thường được giả lập qua Blur nhẹ để giữ cạnh
                            ImageFilter = SKImageFilter.CreateBlur(0.8f, 0.8f) 
                        })
                        {
                            osdCanvas.DrawBitmap(finalBitmap, -osdMargin, -osdMargin, osdPaint);
                        }

                        using var osdImage = osdSurface.Snapshot();
                        using var osdData = osdImage.Encode(SKEncodedImageFormat.Png, 100);
                        byte[] osdBytes = osdData.ToArray();

                        // Bước B: Nhận diện với OSD Engine đã khởi tạo sẵn
                        using (var osdPix = Pix.LoadFromMemory(osdBytes))
                        using (var osdPage = osdEngine.Process(osdPix, PageSegMode.OsdOnly))
                        {
                            osdPage.DetectBestOrientation(out Orientation orientation, out float confidence);
                            
                            if (orientation != Orientation.PageUp && confidence > 10.0f) // OsdOnly confidence scale thường thấp hơn
                            {
                                bool isPortrait = finalBitmap.Height > finalBitmap.Width;
                                bool is180 = (orientation == Orientation.PageDown);
                                bool isSideways = (orientation == Orientation.PageLeft || orientation == Orientation.PageRight);

                                // Logic an toàn: 
                                // - Ưu tiên tuyệt đối xoay 180 vì không đổi Aspect Ratio.
                                // - Chỉ xoay 90/270 nếu cực kỳ tin tưởng (Confidence cao) để tránh phá layout A4 Portrait.
                                bool shouldRotate = is180 || (!isPortrait || !isSideways || confidence > 15.0f);

                                if (shouldRotate)
                                {
                                    rotatedBitmap = FixOrientation(finalBitmap, orientation);
                                    osdInfo = $" [OSD Fixed: {orientation}/Conf: {confidence:F1}]";
                                }
                                else
                                {
                                    osdInfo = $" [OSD Blocked: Portrait-Lock for {orientation}/Conf: {confidence:F1}]";
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        osdInfo = $" [OSD Error: {ex.Message}]";
                    }

                    // --- 5. OCR CHÍNH THỨC ---
                    var bitmapToProcess = rotatedBitmap ?? finalBitmap;
                    
                    using (var ms = new MemoryStream())
                    {
                        if (bitmapToProcess.Encode(ms, SKEncodedImageFormat.Png, 100))
                        {
                            byte[] finalImageBytes = ms.ToArray();
                            using (var finalPix = Pix.LoadFromMemory(finalImageBytes))
                            {
                                // --- 6. CHỐNG NGHIÊNG (DESKEW) ---
                                using var deskewedPix = finalPix.Deskew();
                                
                                // NHẬN DIỆN VĂN BẢN (Ưu tiên hàng đầu để cứu Flow)
                                using var page = mainEngine.Process(deskewedPix ?? finalPix, PageSegMode.Auto); 
                                string resultText = page.GetText();
                                if (!string.IsNullOrWhiteSpace(resultText)) {
                                    sb.AppendLine($"--- Trang {i + 1}{osdInfo} ---");
                                    sb.AppendLine(resultText);
                                }

                                // --- LƯU DEBUG (Sau khi đã OCR xong để an toàn) ---
                                try
                                {
                                    // Lưu ảnh Stage 3: Sau OSD, trước Deskew
                                    string osdFileName = $"{Path.GetFileNameWithoutExtension(filePath)}_p{i + 1}_3_osd_result.png";
                                    using var osdFs = File.Create(Path.Combine(debugPath, osdFileName));
                                    bitmapToProcess.Encode(osdFs, SKEncodedImageFormat.Png, 100);

                                    // Lưu ảnh Stage 4: Sau Deskew (Tạm thời tắt để đảm bảo build pass và OCR chạy trước)
                                    // string finalFileName = $"{Path.GetFileNameWithoutExtension(filePath)}_p{i + 1}_4_final_ocr.png";
                                    // using var deskewedMs = new MemoryStream();
                                    // (deskewedPix ?? finalPix).Save(deskewedMs, ImageFormat.Png);
                                    // File.WriteAllBytes(Path.Combine(debugPath, finalFileName), deskewedMs.ToArray());
                                }
                                catch { /* Bỏ qua lỗi debug */ }
                            }
                        }
                    }

                    rotatedBitmap?.Dispose();
                    }
                    catch (Exception pageEx)
                    {
                        sb.AppendLine($"--- Trang {i + 1} [Lỗi: {pageEx.Message}] ---");
                    }
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[OCR Total Error]: {ex.Message}");
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
