using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Extensions.Configuration;
using PDFtoImage;
using SkiaSharp;
using ToolCalender.Models;
using Tesseract;

namespace ToolCalender.Services
{
    public class OcrService : IOcrService
    {
        private readonly IConfiguration _configuration;
        private const int DefaultRenderDpi = 300;
        private const float DefaultDeskewMinAbsAngle = 0.3f;
        private const float DefaultOsdMinConfidence = 10.0f;

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
            var result = await ExtractPdfOcrResultAsync(filePath);
            return result.FullText;
        }

        public async Task<OcrExtractionResult> ExtractPdfOcrResultAsync(string filePath, OcrRunOptions? options = null)
        {
            var result = new OcrExtractionResult();
            var totalStopwatch = Stopwatch.StartNew();
            string tessDataPath = GetTessDataPath();
            string lang = _configuration["OcrSettings:Language"] ?? "vie+eng";
            var resolvedOptions = ResolveRunOptions(options);

            if (resolvedOptions.EnableDebug)
            {
                Directory.CreateDirectory(resolvedOptions.DebugPath);
            }

            try
            {
                result.TotalPages = CountPdfPages(filePath);

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
                result.FullText = $"[OCR Total Error]: {ex.Message}";
            }

            if (string.IsNullOrWhiteSpace(result.FullText))
            {
                result.FullText = BuildFullText(result.Pages);
            }

            totalStopwatch.Stop();
            result.ElapsedMs = totalStopwatch.ElapsedMilliseconds;
            return await Task.FromResult(result);
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

        private ResolvedOcrOptions ResolveRunOptions(OcrRunOptions? options)
        {
            bool enableDebug = options?.EnableDebug
                ?? bool.TryParse(_configuration["OcrSettings:EnableDebug"], out bool parsedEnableDebug) && parsedEnableDebug;

            string debugPath = options?.DebugPath
                ?? _configuration["OcrSettings:DebugPath"]
                ?? ResolveDefaultDebugPath();

            int renderDpi = options?.RenderDpi
                ?? ParseIntConfig("OcrSettings:RenderDpi", DefaultRenderDpi);

            bool enableOsd = options?.EnableOsd
                ?? ParseBoolConfig("OcrSettings:EnableOsd", true);

            bool enableDeskew = options?.EnableDeskew
                ?? ParseBoolConfig("OcrSettings:EnableDeskew", true);

            float deskewMinAbsAngle = options?.DeskewMinAbsAngle
                ?? ParseFloatConfig("OcrSettings:DeskewMinAbsAngle", DefaultDeskewMinAbsAngle);

            float osdMinConfidence = options?.OsdMinConfidence
                ?? ParseFloatConfig("OcrSettings:OsdMinConfidence", DefaultOsdMinConfidence);

            return new ResolvedOcrOptions
            {
                EnableDebug = enableDebug,
                DebugPath = debugPath,
                RenderDpi = renderDpi,
                EnableOsd = enableOsd,
                EnableDeskew = enableDeskew,
                DeskewMinAbsAngle = deskewMinAbsAngle,
                OsdMinConfidence = osdMinConfidence
            };
        }

        private string ResolveDefaultDebugPath()
        {
            string? rootDir = AppDomain.CurrentDomain.BaseDirectory;
            while (!string.IsNullOrEmpty(rootDir))
            {
                if (Directory.GetFiles(rootDir, "*.sln*").Length > 0) break;
                rootDir = Path.GetDirectoryName(rootDir);
            }

            return Path.Combine(rootDir ?? AppDomain.CurrentDomain.BaseDirectory, "tests", "test_results", "actual_test", "debug_images");
        }

        private int CountPdfPages(string filePath)
        {
            using var fsCount = File.OpenRead(filePath);
            using var reader = new iText.Kernel.Pdf.PdfReader(fsCount);
            using var pdfDoc = new iText.Kernel.Pdf.PdfDocument(reader);
            return pdfDoc.GetNumberOfPages();
        }

        private OcrPageResult ProcessPage(string filePath, int pageIndex, TesseractEngine mainEngine, TesseractEngine osdEngine, ResolvedOcrOptions options)
        {
            var pageResult = new OcrPageResult { PageNumber = pageIndex + 1 };
            var pageStopwatch = Stopwatch.StartNew();
            string baseName = Path.GetFileNameWithoutExtension(filePath);

            try
            {
                using var rawBitmap = RenderPageBitmap(filePath, pageIndex, options.RenderDpi);
                if (rawBitmap == null)
                {
                    pageResult.Error = "Không thể render trang PDF.";
                    pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber} [Lỗi: {pageResult.Error}] ---";
                    return pageResult;
                }

                pageResult.Artifacts.RawImagePath = SaveBitmapDebug(rawBitmap, options, baseName, pageResult.PageNumber, "1_raw");

                using var preprocessedBitmap = PreprocessBitmap(rawBitmap);
                pageResult.Artifacts.PreprocessedImagePath = SaveBitmapDebug(preprocessedBitmap, options, baseName, pageResult.PageNumber, "2_preprocessed");

                SKBitmap? rotatedBitmap = null;
                string osdInfo = "";
                if (options.EnableOsd)
                {
                    rotatedBitmap = TryApplyOrientation(preprocessedBitmap, osdEngine, options, out osdInfo);
                }

                pageResult.OrientationDecision = string.IsNullOrWhiteSpace(osdInfo) ? "No orientation change" : osdInfo.Trim();
                using var bitmapToProcess = rotatedBitmap ?? preprocessedBitmap.Copy();
                pageResult.Artifacts.OsdResultImagePath = SaveBitmapDebug(bitmapToProcess, options, baseName, pageResult.PageNumber, "3_osd_result");

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
                            finalDebugBitmap = TryConvertPixToBitmap(deskewedPix);
                        }
                    }

                    pageResult.Artifacts.FinalOcrImagePath = SaveFinalDebugBitmap(finalDebugBitmap ?? bitmapToProcess, options, baseName, pageResult.PageNumber);

                    using var page = mainEngine.Process(pixForOcr, PageSegMode.Auto);
                    pageResult.Text = page.GetText();
                    pageResult.OcrHeader = $"--- Trang {pageResult.PageNumber}{osdInfo}{BuildDeskewInfo(pageResult)} ---";
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

        private SKBitmap? RenderPageBitmap(string filePath, int pageIndex, int dpi)
        {
            using var pdfStream = File.OpenRead(filePath);
            using var pageImageStream = new MemoryStream();
            Conversion.SavePng(pageImageStream, pdfStream, page: pageIndex, dpi: dpi);
            pageImageStream.Position = 0;
            return SKBitmap.Decode(pageImageStream);
        }

        private SKBitmap PreprocessBitmap(SKBitmap bitmap)
        {
            var finalBitmap = new SKBitmap(bitmap.Width, bitmap.Height);
            using var canvas = new SKCanvas(finalBitmap);
            canvas.Clear(SKColors.White);

            float[] grayscaleMatrix = {
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0, 0, 0, 1, 0
            };
            using var cf = SKColorFilter.CreateColorMatrix(grayscaleMatrix);

            float[] sharpenKernel = { -1, -1, -1, -1, 9, -1, -1, -1, -1 };
            using var filter = SKImageFilter.CreateMatrixConvolution(
                new SKSizeI(3, 3), sharpenKernel, 1f, 0f, new SKPointI(1, 1),
                SKShaderTileMode.Clamp, false);

            using var paint = new SKPaint { ColorFilter = cf, ImageFilter = filter };
            canvas.DrawBitmap(bitmap, 0, 0, paint);
            return finalBitmap;
        }

        private SKBitmap? TryApplyOrientation(SKBitmap finalBitmap, TesseractEngine osdEngine, ResolvedOcrOptions options, out string osdInfo)
        {
            osdInfo = "";

            try
            {
                using var osdBitmap = BuildOsdBitmap(finalBitmap);
                byte[] osdData = EncodeBitmap(osdBitmap);
                using var osdPix = Pix.LoadFromMemory(osdData);
                using var osdPage = osdEngine.Process(osdPix, PageSegMode.OsdOnly);
                osdPage.DetectBestOrientation(out Orientation orientation, out float confidence);

                if (orientation == Orientation.PageUp || confidence <= options.OsdMinConfidence)
                {
                    return null;
                }

                bool isPortrait = finalBitmap.Height > finalBitmap.Width;
                bool is180 = orientation == Orientation.PageDown;
                bool isSideways = orientation == Orientation.PageLeft || orientation == Orientation.PageRight;
                bool shouldRotate = is180 || (!isPortrait || !isSideways || confidence > options.OsdMinConfidence + 5.0f);

                if (!shouldRotate)
                {
                    osdInfo = $" [OSD Blocked: Portrait-Lock for {orientation}/Conf: {confidence:F1}]";
                    return null;
                }

                osdInfo = $" [OSD Fixed: {orientation}/Conf: {confidence:F1}]";
                return FixOrientation(finalBitmap, orientation);
            }
            catch (Exception ex)
            {
                osdInfo = $" [OSD Error: {ex.Message}]";
                return null;
            }
        }

        private SKBitmap BuildOsdBitmap(SKBitmap finalBitmap)
        {
            int osdMargin = (int)(finalBitmap.Width * 0.1);
            var osdRect = new SKRectI(osdMargin, osdMargin, finalBitmap.Width - osdMargin, finalBitmap.Height - osdMargin);
            var info = new SKImageInfo(osdRect.Width, osdRect.Height, SKColorType.Gray8);
            var bitmap = new SKBitmap(info);

            using var canvas = new SKCanvas(bitmap);
            float[] grayMatrix = {
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0, 0, 0, 1, 0
            };

            using var paint = new SKPaint
            {
                ColorFilter = SKColorFilter.CreateColorMatrix(grayMatrix),
                ImageFilter = SKImageFilter.CreateBlur(0.8f, 0.8f)
            };

            canvas.DrawBitmap(finalBitmap, -osdMargin, -osdMargin, paint);
            return bitmap;
        }

        private byte[] EncodeBitmap(SKBitmap bitmap)
        {
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }

        private int ParseIntConfig(string key, int defaultValue)
        {
            return int.TryParse(_configuration[key], out int parsedValue) ? parsedValue : defaultValue;
        }

        private bool ParseBoolConfig(string key, bool defaultValue)
        {
            return bool.TryParse(_configuration[key], out bool parsedValue) ? parsedValue : defaultValue;
        }

        private float ParseFloatConfig(string key, float defaultValue)
        {
            return float.TryParse(_configuration[key], out float parsedValue) ? parsedValue : defaultValue;
        }

        private string? SaveBitmapDebug(SKBitmap bitmap, ResolvedOcrOptions options, string baseName, int pageNumber, string suffix)
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

        private string? SaveFinalDebugBitmap(SKBitmap bitmap, ResolvedOcrOptions options, string baseName, int pageNumber)
        {
            return SaveBitmapDebug(bitmap, options, baseName, pageNumber, "4_final_ocr");
        }

        private SKBitmap? TryConvertPixToBitmap(Pix pix)
        {
            try
            {
                var pixData = pix.GetData();
                int width = pix.Width;
                int height = pix.Height;
                int rowStride = pixData.WordsPerLine * 4;
                byte[] source = new byte[rowStride * height];
                Marshal.Copy(pixData.Data, source, 0, source.Length);

                var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Gray8, SKAlphaType.Opaque));
                IntPtr destPtr = bitmap.GetPixels();
                byte[] grayBytes = new byte[width * height];

                if (pix.Depth == 1)
                {
                    for (int y = 0; y < height; y++)
                    {
                        int srcRow = y * rowStride;
                        int dstRow = y * width;
                        for (int x = 0; x < width; x++)
                        {
                            int byteIndex = srcRow + (x / 8);
                            int bitIndex = 7 - (x % 8);
                            bool isSet = (source[byteIndex] & (1 << bitIndex)) != 0;
                            grayBytes[dstRow + x] = isSet ? (byte)0 : (byte)255;
                        }
                    }
                }
                else if (pix.Depth == 8)
                {
                    for (int y = 0; y < height; y++)
                    {
                        Buffer.BlockCopy(source, y * rowStride, grayBytes, y * width, width);
                    }
                }
                else if (pix.Depth == 32)
                {
                    for (int y = 0; y < height; y++)
                    {
                        int srcRow = y * rowStride;
                        int dstRow = y * width;
                        for (int x = 0; x < width; x++)
                        {
                            int srcIndex = srcRow + (x * 4);
                            byte b = source[srcIndex];
                            byte g = source[srcIndex + 1];
                            byte r = source[srcIndex + 2];
                            grayBytes[dstRow + x] = (byte)((0.114 * b) + (0.587 * g) + (0.299 * r));
                        }
                    }
                }
                else
                {
                    bitmap.Dispose();
                    return null;
                }

                Marshal.Copy(grayBytes, 0, destPtr, grayBytes.Length);
                return bitmap;
            }
            catch
            {
                return null;
            }
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

        private string BuildDeskewInfo(OcrPageResult pageResult)
        {
            if (pageResult.DeskewApplied && pageResult.DeskewAngle.HasValue)
            {
                return $" [Deskewed: {pageResult.DeskewAngle.Value:F2}deg]";
            }

            return "";
        }

        private sealed class ResolvedOcrOptions
        {
            public bool EnableDebug { get; set; }
            public string DebugPath { get; set; } = "";
            public int RenderDpi { get; set; }
            public bool EnableOsd { get; set; }
            public bool EnableDeskew { get; set; }
            public float DeskewMinAbsAngle { get; set; }
            public float OsdMinConfidence { get; set; }
        }
    }
}
