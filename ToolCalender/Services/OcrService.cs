using System.Text;
using Windows.Data.Pdf;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

namespace ToolCalender.Services
{
    public class OcrService
    {
        public static async Task<string> ExtractTextFromPdfOcrAsync(string filePath)
        {
            var sb = new StringBuilder();

            try
            {
                // 1. Load file PDF thông qua Windows Storage
                StorageFile file = await StorageFile.GetFileFromPathAsync(filePath);
                
                PdfDocument pdfDoc = await PdfDocument.LoadFromFileAsync(file);
                if (pdfDoc.PageCount == 0) return string.Empty;

                // Chỉ quét trang 1 (thường chứa đủ thông tin Header) để đảm bảo tốc độ
                PdfPage page = pdfDoc.GetPage(0);
                
                using (var stream = new InMemoryRandomAccessStream())
                {
                    // 2. Render trang PDF thành hình ảnh trong bộ nhớ (DPI cao để OCR chuẩn)
                    var options = new PdfPageRenderOptions { DestinationWidth = 2048 }; 
                    await page.RenderToStreamAsync(stream, options);

                    // 3. Khởi tạo bộ giải mã hình ảnh
                    BitmapDecoder decoder = await BitmapDecoder.CreateAsync(stream);
                    using (SoftwareBitmap softwareBitmap = await decoder.GetSoftwareBitmapAsync())
                    {
                        // 4. Khởi tạo bộ máy OCR (Ưu tiên tiếng Việt)
                        OcrEngine ocrEngine;
                        var language = new Windows.Globalization.Language("vi-VN");
                        
                        if (OcrEngine.IsLanguageSupported(language))
                        {
                            ocrEngine = OcrEngine.TryCreateFromLanguage(language);
                        }
                        else
                        {
                            // Fallback về ngôn ngữ hệ thống nếu chưa cài gói tiếng Việt
                            ocrEngine = OcrEngine.TryCreateFromUserProfileLanguages();
                        }

                        if (ocrEngine != null)
                        {
                            // 5. Thực hiện nhận diện
                            var result = await ocrEngine.RecognizeAsync(softwareBitmap);
                            sb.AppendLine(result.Text);
                        }
                    }
                }
                
                page.Dispose(); // PdfPage thường có Dispose hoặc Close
            }
            catch (Exception ex)
            {
                sb.AppendLine($"[OCR Error]: {ex.Message}");
            }

            return sb.ToString();
        }
    }
}
