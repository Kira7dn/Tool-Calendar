using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using SkiaSharp;
using System.IO;
using System;

namespace ToolCalender.Tests.Helpers
{
    public static class AutomationDocHelper
    {
        private static string ArialPath = @"C:\Windows\Fonts\arial.ttf";
        private static string ArialBoldPath = @"C:\Windows\Fonts\arialbd.ttf";
        private static string TimesPath = @"C:\Windows\Fonts\times.ttf";
        private static string TimesBoldPath = @"C:\Windows\Fonts\timesbd.ttf";

        private const string FullContentTemplate = 
            "Căn cứ Quyết định số 749/QĐ-TTg ngày 03/6/2020 của Thủ tướng Chính phủ phê duyệt 'Chương trình Chuyển đổi số quốc gia đến năm 2025, định hướng đến năm 2030';\n" +
            "Căn cứ Nghị quyết số 01-NQ/TU ngày 16/11/2020 của Ban Chấp hành Đảng bộ tỉnh về chuyển đổi số tỉnh Quảng Ninh đến năm 2025, định hướng đến năm 2030;\n" +
            "Sở Thông tin và Truyền thông xác định việc triển khai Hệ thống Điều phối Công văn tích hợp trí tuệ nhân tạo (AI) là nhiệm vụ trọng tâm nhằm nâng cao hiệu quả quản lý hành chính nhà nước.\n\n" +
            "Để đảm bảo đúng tiến độ đề ra, Giám đốc Sở yêu cầu các phòng, đơn vị trực thuộc tập trung thực hiện các nội dung sau:\n" +
            "1. Ban Chỉ đạo Chuyển đổi số của Sở chịu trách nhiệm rà soát toàn bộ quy trình tiếp nhận văn bản, đảm bảo tính đồng bộ giữa các hệ thống cũ và mới. Đặc biệt lưu ý việc chuẩn hóa mã định danh văn bản theo quy định hiện hành.\n" +
            "2. Văn phòng Sở chủ trì phối hợp với các chuyên gia CNTT hoàn thiện bộ máy bóc tách dữ liệu OCR. Hệ thống phải đảm bảo nhận diện chính xác các văn bản có độ nhiễu cao, văn bản đã qua lưu trữ lâu năm hoặc văn bản có con dấu đè lên thông tin quan trọng.\n" +
            "3. Các đơn vị thụ hưởng có trách nhiệm cung cấp dữ liệu kiểm thử và phản hồi kịp thời các lỗi phát sinh trong quá trình vận hành thử nghiệm. Yêu cầu hoàn thành báo cáo tổng kết giai đoạn 1 trước ngày {0} để trình UBND tỉnh xem xét.\n\n" +
            "Trong quá trình triển khai, nếu có khó khăn, vướng mắc phát sinh vượt quá thẩm quyền, các đơn vị cần kịp thời báo cáo về Ban Chỉ đạo (qua Văn phòng Sở) để tổng hợp, trình Lãnh đạo Sở xem xét, quyết định. Yêu cầu các đơn vị nghiêm túc, khẩn trương thực hiện nhiệm vụ này.";

        public static string GenerateProfessionalImagePdf(string outputPath, string soVb, string thoiHan)
        {
            int width = 2480; int height = 3508;
            var rand = new Random();
            using var surface = SKSurface.Create(new SKImageInfo(width, height));
            var canvas = surface.Canvas;
            canvas.Clear(SKColors.White);

            string fullText = string.Format(FullContentTemplate, thoiHan);
            string header = $"SO THONG TIN VA TRUYEN THONG\nCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\nSố hiệu: {soVb}\n";
            string groundTruth = header + fullText;

            // --- GIẢ LẬP ĐỘ NGHIÊNG (5 độ) ---
            canvas.RotateDegrees(5.0f, width/2, height/2);

            using var arialBold = SKTypeface.FromFile(ArialBoldPath);
            using var times = SKTypeface.FromFile(TimesPath);
            using var timesBold = SKTypeface.FromFile(TimesBoldPath);
            
            using var blurFilter = SKImageFilter.CreateBlur(1.2f, 1.2f);
            using var paint = new SKPaint { IsAntialias = true, Color = SKColors.Black, ImageFilter = blurFilter };

            // Header
            paint.Typeface = arialBold; paint.TextSize = 40;
            canvas.DrawText("SO THONG TIN VA TRUYEN THONG", 150, 200, paint);
            paint.Typeface = timesBold; paint.TextSize = 42;
            canvas.DrawText("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", width - 1000, 150, paint);
            canvas.DrawText("Độc lập - Tự do - Hạnh phúc", width - 850, 210, paint);

            paint.Typeface = timesBold; paint.TextSize = 65;
            canvas.DrawText("Số hiệu: " + soVb, 150, 400, paint);

            // Body
            paint.Typeface = times; paint.TextSize = 44;
            string fullText = string.Format(FullContentTemplate, thoiHan);
            float y = 700;
            foreach (var line in fullText.Split('\n')) {
                // Xử lý xuống dòng đơn giản cho bài test
                if (line.Length > 85) {
                    canvas.DrawText(line.Substring(0, 85), 200, y, paint); y += 60;
                    canvas.DrawText(line.Substring(85), 200, y, paint);
                } else {
                    canvas.DrawText(line, 200, y, paint);
                }
                y += 75;
            }

            // Stamp
            string stampPath = @"d:\Business Analyze\ToolCalendar\tests\assets\stamp.png";
            if (File.Exists(stampPath)) {
                using var stampBmp = SKBitmap.Decode(stampPath);
                canvas.DrawBitmap(stampBmp, new SKRect(width - 900, y + 50, width - 400, y + 550));
            }

            // Heavy Noise
            paint.ImageFilter = null;
            paint.Color = SKColors.Gray.WithAlpha(50);
            for (int i = 0; i < 3000; i++) canvas.DrawCircle(rand.Next(width), rand.Next(height), 2, paint);

            using var snap = surface.Snapshot();
            using var encoded = snap.Encode(SKEncodedImageFormat.Png, 85);
            byte[] bytes = encoded.ToArray();

            using var writer = new PdfWriter(outputPath);
            using var pdf = new PdfDocument(writer);
            var doc = new Document(pdf);
            doc.Add(new Image(iText.IO.Image.ImageDataFactory.Create(bytes)).SetAutoScale(true));
            doc.Close();

            return groundTruth;
        }

        public static string GenerateStandardPdf(string outputPath, string soVb, string ngay, string thoiHan)
        {
            string fullText = string.Format(FullContentTemplate, thoiHan);
            string header = $"SO THONG TIN VA TRUYEN THONG\nSố hiệu: {soVb}\n";
            string groundTruth = header + fullText;

            using var writer = new PdfWriter(outputPath);
            using var pdf = new PdfDocument(writer);
            var doc = new Document(pdf);
            doc.Add(new Paragraph("SO THONG TIN VA TRUYEN THONG").SetBold());
            doc.Add(new Paragraph("Số hiệu: " + soVb).SetBold());
            doc.Add(new Paragraph(fullText));
            doc.Close();

            return groundTruth;
        }
    }
}
