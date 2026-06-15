using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SkiaSharp;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using ToolCalendar.Models;
using OpenCvSharp;
using Sdcb.PaddleOCR;
using Sdcb.PaddleOCR.Models.Online;
using Sdcb.PaddleOCR.Models;
using Sdcb.PaddleInference;

namespace ToolCalendar.Services
{
    public class OcrService : IOcrService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<OcrService> _logger;
        private static FullOcrModel? _paddleOcrModel;
        private static readonly SemaphoreSlim _modelLock = new SemaphoreSlim(1, 1);

        public OcrService(IConfiguration configuration, ILogger<OcrService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        private async Task<FullOcrModel> GetModelAsync()
        {
            if (_paddleOcrModel == null)
            {
                await _modelLock.WaitAsync();
                try
                {
                    if (_paddleOcrModel == null)
                    {
                        _logger.LogInformation("[OCR] Đang tải mô hình PaddleOCR tiếng Việt về máy...");
                        _paddleOcrModel = await OnlineFullModels.EnglishV4.DownloadAsync();
                        _logger.LogInformation("[OCR] Tải mô hình PaddleOCR thành công.");
                    }
                }
                finally
                {
                    _modelLock.Release();
                }
            }
            return _paddleOcrModel;
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
            
            var resolvedOptions = OcrOptionsResolver.Resolve(_configuration, options);

            if (resolvedOptions.EnableDebug)
            {
                Directory.CreateDirectory(resolvedOptions.DebugPath);
            }

            try
            {
                // Ensure model is downloaded first before spawning threads
                var model = await GetModelAsync();

                result.TotalPages = PdfPageRenderer.CountPdfPages(filePath);

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
                        return await ProcessPageAsync(filePath, pageIndex, model, resolvedOptions);
                    }
                    finally
                    {
                        concurrencyLimit.Release();
                    }
                }).ToList();

                var pageResults = await Task.WhenAll(pageTasks);
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

        private async Task<OcrPageResult> ProcessPageAsync(string filePath, int pageIndex, FullOcrModel model, ResolvedOcrOptions options)
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

                // Preprocess for PaddleOCR (Usually less required than Tesseract, but deskewing is good)
                using var preprocessedBitmap = OcrImageProcessor.PreprocessBitmap(rawBitmap);
                pageResult.Artifacts.PreprocessedImagePath = OcrDebugArtifactWriter.SaveBitmapDebug(preprocessedBitmap, options, baseName, pageResult.PageNumber, "2_preprocessed");

                SKBitmap? deskewedBitmap = null;
                if (options.EnableDeskew)
                {
                    float? deskewAngle = OcrImageProcessor.EstimateDeskewAngle(preprocessedBitmap, options.DeskewMinAbsAngle);
                    if (deskewAngle.HasValue)
                    {
                        deskewedBitmap = OcrImageProcessor.RotateBitmap(preprocessedBitmap, -deskewAngle.Value);
                        if (deskewedBitmap != null)
                        {
                            pageResult.DeskewApplied = true;
                            pageResult.DeskewAngle = deskewAngle.Value;
                        }
                    }
                }

                using var bitmapToProcess = deskewedBitmap ?? preprocessedBitmap.Copy();
                pageResult.Artifacts.FinalOcrImagePath = OcrDebugArtifactWriter.SaveFinalDebugBitmap(bitmapToProcess, options, baseName, pageResult.PageNumber);
                
                // Convert SKBitmap to MemoryStream for OpenCvSharp
                using var ms = new MemoryStream();
                bitmapToProcess.Encode(ms, SKEncodedImageFormat.Png, 100);
                ms.Position = 0;

                // Run PaddleOCR
                using Mat mat = Mat.FromStream(ms, ImreadModes.Color);
                using PaddleOcrAll ocr = new PaddleOcrAll(model)
                {
                    AllowRotateDetection = true,
                    Enable180Classification = true
                };

                PaddleOcrResult ocrResult = ocr.Run(mat);
                pageResult.Text = ocrResult.Text;
                
                string angleInfo = ocr.AllowRotateDetection ? " [Auto Orient]" : "";
                pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber}{angleInfo}{OcrImageProcessor.BuildDeskewInfo(pageResult)} ---";
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

        private int GetMaxParallelPages()
        {
            string? configured = _configuration["OcrSettings:MaxParallelPages"];
            if (int.TryParse(configured, out int value) && value > 0)
            {
                return value;
            }

            return 2; // Default lowered to 2 for PaddleOCR RAM safety
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
