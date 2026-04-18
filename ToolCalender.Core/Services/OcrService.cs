using System.Text;
using TesseractOCR;
using TesseractOCR.Enums;
using TesseractOCR.Pix;
using OpenCvSharp;
using PDFtoImage;
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

            bool enableDebug = _configuration["OcrSettings:EnableDebug"] == "true";
            string debugPath = _configuration["OcrSettings:DebugPath"] ?? Path.Combine(Path.GetDirectoryName(filePath) ?? "", "debug_images");

            if (enableDebug && !Directory.Exists(debugPath)) Directory.CreateDirectory(debugPath);

            try
            {
                // 1. Lấy tổng số trang
                int totalPages = 0;
                using (var reader = new iText.Kernel.Pdf.PdfReader(filePath))
                using (var pdfDoc = new iText.Kernel.Pdf.PdfDocument(reader))
                {
                    totalPages = pdfDoc.GetNumberOfPages();
                }

                // 2. Khởi tạo các Engine (Tối ưu: dùng chung engine xuyên suốt các trang)
                using (var osdEngine = new Engine(tessDataPath, "osd", EngineMode.Default))
                using (var mainEngine = new Engine(tessDataPath, lang, EngineMode.Default))
                {
                    mainEngine.SetVariable("preserve_interword_spaces", "1");

                    for (int i = 0; i < totalPages; i++)
                    {
                        using var pdfStream = File.OpenRead(filePath);
                        using var pageImageStream = new MemoryStream();
                        
                        // Render trang PDF sang PNG (300 DPI)
                        Conversion.SavePng(pageImageStream, pdfStream, page: i, dpi: 300);
                        byte[] rawBytes = pageImageStream.ToArray();

                        if (enableDebug) File.WriteAllBytes(Path.Combine(debugPath, $"p{i + 1}_0_raw.png"), rawBytes);

                        // --- BƯỚC 1: Tiền xử lý với OpenCV (Mạnh mẽ & Chính xác) ---
                        // Load ảnh vào OpenCV Mat trực tiếp từ bytes để tránh lỗi Endianness của Leptonica Pix
                        using var src = Mat.FromImageData(rawBytes, ImreadModes.Grayscale);
                        if (src.Empty()) continue;

                        using var binary = new Mat();
                        // A. Nhận diện mật độ mực
                        Cv2.AdaptiveThreshold(src, binary, 255, AdaptiveThresholdTypes.GaussianC, ThresholdTypes.BinaryInv, 31, 2);
                        double inkDensity = (double)Cv2.CountNonZero(binary) / (src.Width * src.Height);
                        
                        if (inkDensity < 0.001) // 0.1% mực - Thường là trang trắng
                        {
                            sb.AppendLine($"--- Trang {i + 1} [Skipped: Blank Page / Ink Density: {inkDensity:P2}] ---");
                            continue;
                        }

                        // B. Lọc nhiễu & viền (Surgical Denoising)
                        Point[][] contours;
                        HierarchyIndex[] hierarchy;
                        Cv2.FindContours(binary, out contours, out hierarchy, RetrievalModes.External, ContourApproximationModes.ApproxSimple);
                        
                        int margin = 10;
                        foreach (var contour in contours)
                        {
                            var rect = Cv2.BoundingRect(contour);
                            double area = Cv2.ContourArea(contour);

                            // C1: Lọc nhiễu thông minh dựa trên diện tích và hình dạng (Aspect Ratio)
                            // Nhiễu hạt thường có dạng tròn (tỷ lệ 1:1), dấu tiếng Việt thường dẹt hoặc dọc.
                            double aspectRatio = (double)rect.Width / rect.Height;
                            bool isSmallNoise = area < 15 && (aspectRatio > 0.5 && aspectRatio < 2.0);
                            
                            bool isBorder = rect.Left < margin || rect.Top < margin || 
                                            rect.Right > src.Width - margin || rect.Bottom > src.Height - margin;

                            if (isSmallNoise || (isBorder && area > 200))
                            {
                                Cv2.DrawContours(src, new[] { contour }, -1, Scalar.White, -1);
                            }
                        }

                        if (enableDebug) File.WriteAllBytes(Path.Combine(debugPath, $"p{i + 1}_1_denoised.png"), src.ToBytes(".png"));

                        // --- BƯỚC 2: Nhận diện hướng (OSD Hardened) ---
                        int rotationDegrees = 0;
                        float confidence = 0;
                        string osdTag = "";
                        
                        using (var osdMat = new Mat())
                        {
                            // Cắt vùng trung tâm để OSD chính xác hơn, tránh nhiễu lề
                            int marginH = (int)(src.Height * 0.1);
                            int marginW = (int)(src.Width * 0.1);
                            var cropRect = new OpenCvSharp.Rect(marginW, marginH, src.Width - 2 * marginW, src.Height - 2 * marginH);
                            
                            using (var cropped = new Mat(src, cropRect))
                            {
                                Cv2.MedianBlur(cropped, osdMat, 3); // Làm mịn để Tesseract OSD không bị lừa bởi nhiễu point
                                byte[] osdBytes = osdMat.ToBytes(".png");
                                if (enableDebug) File.WriteAllBytes(Path.Combine(debugPath, $"p{i + 1}_2_osd_view.png"), osdBytes);

                                using var osdPixDetect = TesseractOCR.Pix.Image.LoadFromMemory(osdBytes);
                                osdPixDetect.XRes = 300; osdPixDetect.YRes = 300;
                                using (var osdPage = osdEngine.Process(osdPixDetect, PageSegMode.OsdOnly))
                                {
                                    osdPage.DetectOrientation(out rotationDegrees, out confidence);
                                }
                            }
                        }

                        // Áp dụng xoay ảnh vật lý nếu cần thiết
                        bool isPortrait = src.Height > src.Width;
                        bool isHallucination = isPortrait && (rotationDegrees == 90 || rotationDegrees == 270);

                        Mat orientedMat = src;
                        if (rotationDegrees != 0 && confidence > 25.0f && !isHallucination)
                        {
                            // Rotation in OpenCV: 90 CW, 180, 270 CW (90 CCW)
                            if (rotationDegrees == 90) Cv2.Rotate(src, orientedMat, RotateFlags.Rotate90Counterclockwise);
                            else if (rotationDegrees == 180) Cv2.Rotate(src, orientedMat, RotateFlags.Rotate180);
                            else if (rotationDegrees == 270) Cv2.Rotate(src, orientedMat, RotateFlags.Rotate90Clockwise);
                            
                            osdTag = $" [OSD Fix:{rotationDegrees}deg/Conf:{confidence:F1}]";
                        }
                        else if (rotationDegrees != 0)
                        {
                            string reason = isHallucination ? "Portrait-Lock" : "LowConf";
                            osdTag = $" [OSD Blocked:{rotationDegrees}deg/Conf:{confidence:F1}/Reason:{reason}]";
                        }

                        // --- BƯỚC 3: Nắn thẳng (Physical Deskew) ---
                        // Sử dụng Tesseract Pix Deskew (Leptonica) vì nó rất ổn định
                        using var pixBeforeOcr = TesseractOCR.Pix.Image.LoadFromMemory(orientedMat.ToBytes(".png"));
                        pixBeforeOcr.XRes = 300; pixBeforeOcr.YRes = 300;
                        
                        TesseractOCR.Pix.Image finalPix = pixBeforeOcr;
                        using var deskewedPix = pixBeforeOcr.Deskew();
                        if (deskewedPix != null)
                        {
                            deskewedPix.XRes = 300; deskewedPix.YRes = 300;
                            finalPix = deskewedPix;
                            osdTag += " [Deskewed]";
                        }

                        // --- BƯỚC 4: OCR Final ---
                        if (enableDebug) finalPix.Save(Path.Combine(debugPath, $"p{i + 1}_3_final_ocr.png"), TesseractOCR.Enums.ImageFormat.Png);

                        using (var page = mainEngine.Process(finalPix, PageSegMode.Auto))
                        {
                            string text = page.Text;
                            sb.AppendLine($"--- Trang {i + 1}{osdTag} ---");
                            sb.AppendLine(text ?? "");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[OCR Critical Error]: {ex.Message}");
            }

            return await Task.FromResult(sb.ToString());
        }
    }
}
