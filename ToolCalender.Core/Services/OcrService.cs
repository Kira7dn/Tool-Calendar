using System.Diagnostics;
using System.Globalization;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SkiaSharp;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    public class OcrService : IOcrService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<OcrService> _logger;

        public OcrService(IConfiguration configuration, ILogger<OcrService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        internal string GetTessDataPath()
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
                {
                    Environment.SetEnvironmentVariable("TESSDATA_PREFIX", "/usr/share/tesseract-ocr/5/tessdata");
                    return "/usr/share/tesseract-ocr/5/tessdata";
                }
                if (Directory.Exists("/usr/share/tesseract-ocr/tessdata"))
                {
                    Environment.SetEnvironmentVariable("TESSDATA_PREFIX", "/usr/share/tesseract-ocr/tessdata");
                    return "/usr/share/tesseract-ocr/tessdata";
                }
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
            var result = await ExtractPdfOcrResultAsync(filePath);
            return result.FullText;
        }

        public async Task<OcrExtractionResult> ExtractPdfOcrResultAsync(string filePath, OcrRunOptions? options = null)
        {
            var result = new OcrExtractionResult();
            var totalStopwatch = Stopwatch.StartNew();
            string tessDataPath = GetTessDataPath();
            string lang = _configuration["OcrSettings:Language"] ?? "vie+eng";
            var resolvedOptions = OcrOptionsResolver.Resolve(_configuration, options);

            if (resolvedOptions.EnableDebug)
            {
                Directory.CreateDirectory(resolvedOptions.DebugPath);
            }

            try
            {
                result.TotalPages = PdfPageRenderer.CountPdfPages(filePath);

                // ── Idea 3: Đọc cấu hình số trang quét từ Database (mặc định 0 = scan hết)
                string maxPagesConfig = Data.DatabaseService.GetAppSetting("OcrSettings_MaxPagesToScan", "0");
                int maxPages = int.TryParse(maxPagesConfig, out int mp) ? mp : 0;
                int pagesToProcess = maxPages > 0 ? Math.Min(result.TotalPages, maxPages) : result.TotalPages;

                int maxParallelPages = GetMaxParallelPages();
                using var concurrencyLimit = new SemaphoreSlim(maxParallelPages, maxParallelPages);
                var pageTasks = Enumerable.Range(0, pagesToProcess).Select(async pageIndex =>
                {
                    await concurrencyLimit.WaitAsync();
                    try
                    {
                        return await ProcessPageAsync(filePath, pageIndex, tessDataPath, lang, resolvedOptions);
                    }
                    finally
                    {
                        concurrencyLimit.Release();
                    }
                }).ToList();

                var pageResults = await Task.WhenAll(pageTasks);

                // Giữ đúng thứ tự trang sau khi xử lý song song
                result.Pages = pageResults.OrderBy(p => p.PageNumber).ToList();
            }
            catch (Exception ex)
            {
                result.HasCriticalError = true;
                result.ErrorMessage = ex.InnerException?.Message ?? ex.Message;
                result.FullText = string.Empty;
                _logger.LogError(ex, "[OCR] Lỗi OCR tổng khi xử lý file {FilePath}", filePath);
            }

            if (string.IsNullOrWhiteSpace(result.FullText))
            {
                result.FullText = BuildFullText(result.Pages);
            }

            totalStopwatch.Stop();
            result.ElapsedMs = totalStopwatch.ElapsedMilliseconds;
            return await Task.FromResult(result);
        }

        private async Task<OcrPageResult> ProcessPageAsync(string filePath, int pageIndex, string tessDataPath, string lang, ResolvedOcrOptions options)
        {
            var pageResult = new OcrPageResult { PageNumber = pageIndex + 1 };
            var pageStopwatch = Stopwatch.StartNew();
            string baseName = Path.GetFileNameWithoutExtension(filePath);

            try
            {
                using var rawBitmap = PdfPageRenderer.RenderPageBitmap(filePath, pageIndex, options.RenderDpi);
                if (rawBitmap == null)
                {
                    pageResult.Error = "Không thể render trang PDF.";
                    pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber} [Lỗi: {pageResult.Error}] ---";
                    return pageResult;
                }

                pageResult.Artifacts.RawImagePath = OcrDebugArtifactWriter.SaveBitmapDebug(rawBitmap, options, baseName, pageResult.PageNumber, "1_raw");

                using var preprocessedBitmap = OcrImageProcessor.PreprocessBitmap(rawBitmap);
                pageResult.Artifacts.PreprocessedImagePath = OcrDebugArtifactWriter.SaveBitmapDebug(preprocessedBitmap, options, baseName, pageResult.PageNumber, "2_preprocessed");

                using var osdBitmap = options.EnableOsd ? OcrImageProcessor.BuildOsdBitmap(preprocessedBitmap) : null;
                var osdResult = options.EnableOsd && osdBitmap != null
                    ? await DetectOrientationAsync(osdBitmap, tessDataPath)
                    : OcrOsdResult.None;

                SKBitmap? orientedBitmap = null;
                string osdInfo = "";
                if (options.EnableOsd)
                {
                    (orientedBitmap, osdInfo) = ApplyOrientation(preprocessedBitmap, osdResult, options);
                }

                pageResult.OrientationDecision = string.IsNullOrWhiteSpace(osdInfo) ? "No orientation change" : osdInfo.Trim();
                using var bitmapToDeskew = orientedBitmap ?? preprocessedBitmap.Copy();
                pageResult.Artifacts.OsdResultImagePath = OcrDebugArtifactWriter.SaveBitmapDebug(bitmapToDeskew, options, baseName, pageResult.PageNumber, "3_osd_result");

                SKBitmap? deskewedBitmap = null;
                if (options.EnableDeskew)
                {
                    float? deskewAngle = OcrImageProcessor.EstimateDeskewAngle(bitmapToDeskew, options.DeskewMinAbsAngle);
                    if (deskewAngle.HasValue)
                    {
                        deskewedBitmap = OcrImageProcessor.RotateBitmap(bitmapToDeskew, -deskewAngle.Value);
                        if (deskewedBitmap != null)
                        {
                            pageResult.DeskewApplied = true;
                            pageResult.DeskewAngle = deskewAngle.Value;
                        }
                    }
                }

                using var bitmapToProcess = deskewedBitmap ?? bitmapToDeskew.Copy();
                pageResult.Artifacts.FinalOcrImagePath = OcrDebugArtifactWriter.SaveFinalDebugBitmap(bitmapToProcess, options, baseName, pageResult.PageNumber);
                pageResult.Text = await RunTesseractCliAsync(bitmapToProcess, tessDataPath, lang, 3);
                pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber}{osdInfo}{OcrImageProcessor.BuildDeskewInfo(pageResult)} ---";
            }
            catch (Exception pageEx)
            {
                pageResult.Error = "Lỗi OCR trang.";
                pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber} [Lỗi OCR] ---";
                _logger.LogError(pageEx, "[OCR] Lỗi OCR tại file {FilePath}, trang {PageNumber}", filePath, pageResult.PageNumber);
            }
            finally
            {
                pageStopwatch.Stop();
                pageResult.ElapsedMs = pageStopwatch.ElapsedMilliseconds;
            }

            return pageResult;
        }

        private async Task<string> RunTesseractCliAsync(SKBitmap bitmap, string tessDataPath, string lang, int pageSegMode)
        {
            string tempDirectory = Path.Combine(Path.GetTempPath(), "toolcalender-ocr");
            Directory.CreateDirectory(tempDirectory);

            string inputPath = Path.Combine(tempDirectory, $"{Guid.NewGuid():N}.png");

            try
            {
                using (var fs = File.Create(inputPath))
                {
                    bitmap.Encode(fs, SKEncodedImageFormat.Png, 100);
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = "tesseract",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = false,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                startInfo.ArgumentList.Add(inputPath);
                startInfo.ArgumentList.Add("stdout");
                startInfo.ArgumentList.Add("--tessdata-dir");
                startInfo.ArgumentList.Add(tessDataPath);
                startInfo.ArgumentList.Add("-l");
                startInfo.ArgumentList.Add(lang);
                startInfo.ArgumentList.Add("--psm");
                startInfo.ArgumentList.Add(pageSegMode.ToString(CultureInfo.InvariantCulture));
                startInfo.ArgumentList.Add("-c");
                startInfo.ArgumentList.Add("preserve_interword_spaces=1");

                using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Không thể khởi tạo tiến trình tesseract.");
                string stdout = await process.StandardOutput.ReadToEndAsync();
                string stderr = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    throw new InvalidOperationException(string.IsNullOrWhiteSpace(stderr)
                        ? $"tesseract CLI trả về exit code {process.ExitCode}."
                        : stderr.Trim());
                }

                return stdout.Trim();
            }
            finally
            {
                TryDeleteFile(inputPath);
            }
        }

        private async Task<OcrOsdResult> DetectOrientationAsync(SKBitmap bitmap, string tessDataPath)
        {
            string tempDirectory = Path.Combine(Path.GetTempPath(), "toolcalender-ocr");
            Directory.CreateDirectory(tempDirectory);
            string inputPath = Path.Combine(tempDirectory, $"{Guid.NewGuid():N}-osd.png");

            try
            {
                using (var fs = File.Create(inputPath))
                {
                    bitmap.Encode(fs, SKEncodedImageFormat.Png, 100);
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = "tesseract",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                startInfo.ArgumentList.Add(inputPath);
                startInfo.ArgumentList.Add("stdout");
                startInfo.ArgumentList.Add("--tessdata-dir");
                startInfo.ArgumentList.Add(tessDataPath);
                startInfo.ArgumentList.Add("-l");
                startInfo.ArgumentList.Add("osd");
                startInfo.ArgumentList.Add("--psm");
                startInfo.ArgumentList.Add("0");

                using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Không thể khởi tạo tiến trình tesseract OSD.");
                string stdout = await process.StandardOutput.ReadToEndAsync();
                string stderr = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                string osdPayload = string.IsNullOrWhiteSpace(stdout) ? stderr : stdout;
                if (process.ExitCode != 0 && string.IsNullOrWhiteSpace(osdPayload))
                {
                    return OcrOsdResult.None;
                }

                return ParseOsdResult(osdPayload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[OCR] OSD detection failed. Continuing without rotation.");
                return OcrOsdResult.None;
            }
            finally
            {
                TryDeleteFile(inputPath);
            }
        }

        private int GetMaxParallelPages()
        {
            string? configured = _configuration["OcrSettings:MaxParallelPages"];
            if (int.TryParse(configured, out int value) && value > 0)
            {
                return value;
            }

            return 2;
        }

        private static void TryDeleteFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
            catch
            {
            }
        }

        private (SKBitmap? bitmap, string osdInfo) ApplyOrientation(SKBitmap bitmap, OcrOsdResult osdResult, ResolvedOcrOptions options)
        {
            string baseInfo = osdResult.RotateDegrees == 0 ? "" : $" [OSD Detected: {osdResult.RotateDegrees}deg/Conf: {osdResult.Confidence:F1}]";

            if (osdResult.RotateDegrees == 0 || osdResult.Confidence <= options.OsdMinConfidence)
            {
                return (null, baseInfo + (osdResult.RotateDegrees != 0 && osdResult.Confidence <= options.OsdMinConfidence ? " (Below Threshold)" : ""));
            }

            bool isPortrait = bitmap.Height > bitmap.Width;
            bool isSideways = osdResult.RotateDegrees == 90 || osdResult.RotateDegrees == 270;
            bool shouldRotate = osdResult.RotateDegrees == 180 || !isPortrait || !isSideways || osdResult.Confidence > options.OsdMinConfidence + 5.0f;

            if (!shouldRotate)
            {
                return (null, $" [OSD Blocked: Portrait-Lock for Rotate {osdResult.RotateDegrees}deg/Conf: {osdResult.Confidence:F1}]");
            }

            var rotated = OcrImageProcessor.RotateBitmap(bitmap, osdResult.RotateDegrees);
            return rotated == null
                ? (null, "")
                : (rotated, $" [OSD Fixed: Rotate {osdResult.RotateDegrees}deg/Conf: {osdResult.Confidence:F1}]");
        }

        private static OcrOsdResult ParseOsdResult(string text)
        {
            int rotateDegrees = 0;
            float confidence = 0;

            foreach (string rawLine in text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (rawLine.StartsWith("Rotate:", StringComparison.OrdinalIgnoreCase))
                {
                    int.TryParse(rawLine["Rotate:".Length..].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out rotateDegrees);
                }
                else if (rawLine.StartsWith("Orientation confidence:", StringComparison.OrdinalIgnoreCase))
                {
                    float.TryParse(rawLine["Orientation confidence:".Length..].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out confidence);
                }
            }

            return new OcrOsdResult(rotateDegrees, confidence);
        }

        private readonly record struct OcrOsdResult(int RotateDegrees, float Confidence)
        {
            public static OcrOsdResult None => new(0, 0);
        }

        private string BuildFullText(IEnumerable<OcrPageResult> pages)
        {
            var sb = new StringBuilder();
            foreach (var page in pages)
            {
                if (!string.IsNullOrWhiteSpace(page.Text))
                {
                    sb.AppendLine(page.OcrHeader);
                    sb.AppendLine(page.Text);
                }
            }

            return sb.ToString();
        }
    }
}
