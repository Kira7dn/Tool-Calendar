using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Configuration;
using SkiaSharp;
using ToolCalender.Models;
using Tesseract;

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

                using var mainEngine = new TesseractEngine(tessDataPath, lang, EngineMode.Default);
                using var osdEngine = new TesseractEngine(tessDataPath, "osd", EngineMode.Default);
                mainEngine.SetVariable("preserve_interword_spaces", "1");

                for (int i = 0; i < result.TotalPages; i++)
                {
                    result.Pages.Add(ProcessPage(filePath, i, mainEngine, osdEngine, resolvedOptions));
                }
            }
            catch (Exception ex)
            {
                var sb = new StringBuilder();
                sb.AppendLine($"[OCR Total Error]: {ex.Message}");
                if (ex.InnerException != null)
                {
                    sb.AppendLine($"[Inner Error]: {ex.InnerException.Message}");
                    if (ex.InnerException.InnerException != null)
                        sb.AppendLine($"[Inner Inner Error]: {ex.InnerException.InnerException.Message}");
                }
                sb.AppendLine($"[Stack Trace]: {ex.StackTrace}");
                result.FullText = sb.ToString();
            }

            if (string.IsNullOrWhiteSpace(result.FullText))
            {
                result.FullText = BuildFullText(result.Pages);
            }

            totalStopwatch.Stop();
            result.ElapsedMs = totalStopwatch.ElapsedMilliseconds;
            return await Task.FromResult(result);
        }

        private OcrPageResult ProcessPage(string filePath, int pageIndex, TesseractEngine mainEngine, TesseractEngine osdEngine, ResolvedOcrOptions options)
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

                SKBitmap? rotatedBitmap = null;
                string osdInfo = "";
                if (options.EnableOsd)
                {
                    rotatedBitmap = OcrImageProcessor.TryApplyOrientation(preprocessedBitmap, osdEngine, options, out osdInfo);
                }

                pageResult.OrientationDecision = string.IsNullOrWhiteSpace(osdInfo) ? "No orientation change" : osdInfo.Trim();
                using var bitmapToProcess = rotatedBitmap ?? preprocessedBitmap.Copy();
                pageResult.Artifacts.OsdResultImagePath = OcrDebugArtifactWriter.SaveBitmapDebug(bitmapToProcess, options, baseName, pageResult.PageNumber, "3_osd_result");

                using var bitmapBytes = new MemoryStream();
                bitmapToProcess.Encode(bitmapBytes, SKEncodedImageFormat.Png, 100);
                using var finalPix = Pix.LoadFromMemory(bitmapBytes.ToArray());

                Pix? pixForOcr = finalPix;
                SKBitmap? finalDebugBitmap = null;
                Pix? deskewedPix = null;
                try
                {
                    if (options.EnableDeskew)
                    {
                        deskewedPix = finalPix.Deskew(out Scew scew);
                        pageResult.DeskewAngle = scew.Angle;
                        pageResult.DeskewApplied = deskewedPix != null && Math.Abs(scew.Angle) >= options.DeskewMinAbsAngle;

                        if (pageResult.DeskewApplied)
                        {
                            pixForOcr = deskewedPix;
                            finalDebugBitmap = PixBitmapConverter.TryConvertPixToBitmap(deskewedPix!);
                        }
                    }

                    pageResult.Artifacts.FinalOcrImagePath = OcrDebugArtifactWriter.SaveFinalDebugBitmap(finalDebugBitmap ?? bitmapToProcess, options, baseName, pageResult.PageNumber);

                    using var page = mainEngine.Process(pixForOcr, PageSegMode.Auto);
                    pageResult.Text = page.GetText();
                    pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber}{osdInfo}{OcrImageProcessor.BuildDeskewInfo(pageResult)} ---";
                }
                finally
                {
                    finalDebugBitmap?.Dispose();
                    deskewedPix?.Dispose();
                }
            }
            catch (Exception pageEx)
            {
                pageResult.Error = pageEx.Message;
                pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber} [Lỗi: {pageEx.Message}] ---";
            }
            finally
            {
                pageStopwatch.Stop();
                pageResult.ElapsedMs = pageStopwatch.ElapsedMilliseconds;
            }

            return pageResult;
        }

        private string BuildFullText(IEnumerable<OcrPageResult> pages)
        {
            var sb = new StringBuilder();
            foreach (var page in pages)
            {
                if (!string.IsNullOrWhiteSpace(page.Error))
                {
                    sb.AppendLine(page.OcrHeader);
                    continue;
                }

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
