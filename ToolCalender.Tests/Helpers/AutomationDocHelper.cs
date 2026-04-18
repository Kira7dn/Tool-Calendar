using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using SkiaSharp;
using System.IO;
using System;
using System.Text;

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
            fullText = string.Format(FullContentTemplate, thoiHan);
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
            
            // Nhúng font tiếng Việt để tránh lỗi font hệ thống của iText7
            try {
                var font = iText.Kernel.Font.PdfFontFactory.CreateFont(TimesPath, iText.IO.Font.PdfEncodings.IDENTITY_H);
                doc.SetFont(font);
            } catch { }

            doc.Add(new Paragraph("SO THONG TIN VA TRUYEN THONG").SetBold());
            doc.Add(new Paragraph("Số hiệu: " + soVb).SetBold());
            doc.Add(new Paragraph(fullText));
            doc.Close();

            return groundTruth;
        }
        private const string LongAdministrativeTemplate =
            "Căn cứ Quyết định số 749/QĐ-TTg ngày 03/6/2020 của Thủ tướng Chính phủ phê duyệt 'Chương trình Chuyển đổi số quốc gia đến năm 2025, định hướng đến năm 2030';\n" +
            "Sở Thông tin và Truyền thông xác định việc triển khai Hệ thống Điều phối Công văn tích hợp trí tuệ nhân tạo (AI) là nhiệm vụ trọng tâm nhằm nâng cao hiệu quả quản lý hành chính nhà nước, hiện thực hóa mục tiêu chuyển đổi số toàn diện của tỉnh.\n" +
            "Để đảm bảo đúng tiến độ đề ra, Giám đốc Sở yêu cầu các phòng, đơn vị trực thuộc tập trung thực hiện các nội dung sau:\n" +
            "1. Ban Chỉ đạo Chuyển đổi số của Sở chịu trách nhiệm rà soát toàn bộ quy trình tiếp nhận văn bản, đảm bảo tính đồng bộ giữa các hệ thống cũ và mới. Đặc biệt lưu ý việc chuẩn hóa mã định danh văn bản theo quy định hiện hành đối với các tài liệu lưu trữ từ năm 2010 đến nay.\n" +
            "2. Văn phòng Sở chủ trì phối hợp với các chuyên gia CNTT hoàn thiện bộ máy bóc tách dữ liệu OCR. Hệ thống phải đảm bảo nhận diện chính xác các văn bản có độ nhiễu cao, văn bản đã qua lưu trữ lâu năm hoặc văn bản có con dấu đè lên thông tin quan trọng. Mục tiêu tỉ lệ nhận diện phải đạt trên 95% đối với các trường thông tin cơ bản.\n" +
            "3. Các đơn vị thụ hưởng có trách nhiệm cung cấp dữ liệu kiểm thử và phản hồi kịp thời các lỗi phát sinh trong quá trình vận hành thử nghiệm. Yêu cầu hoàn thành báo cáo tổng kết giai đoạn 1 trước ngày 01/01/2027 để trình UBND tỉnh xem xét, đánh giá hiệu quả thực tế và phê duyệt kinh phí cho giai đoạn tiếp theo.\n" +
            "Trong quá trình triển khai, nếu có khó khăn, vướng mắc phát sinh vượt quá thẩm quyền, các đơn vị cần kịp thời báo cáo về Ban Chỉ đạo (qua Văn phòng Sở) để tổng hợp, trình Lãnh đạo Sở xem xét, quyết định. Yêu cầu các đơn vị nghiêm túc, khẩn trương thực hiện nhiệm vụ này để đảm bảo chỉ số đánh giá DDCI của Sở năm 2026 đạt kết quả tốt nhất.\n" +
            "Mọi sự chậm trễ không có lý do chính đáng sẽ được đưa vào tiêu chí đánh giá thi đua khen thưởng cuối năm của tập thể và cá nhân liên quan. Văn phòng Sở theo dõi và định kỳ báo cáo tiến độ vào ngày 25 hàng tháng.";

        public static string GenerateMultiPageScannedPdf(string outputPath, int pageCount)
        {
            var sbGroundTruth = new StringBuilder();
            using var writer = new PdfWriter(outputPath);
            using var pdf = new PdfDocument(writer);
            var doc = new Document(pdf);

            for (int i = 1; i <= pageCount; i++)
            {
                string pageHeader = $"--- BÁO CÁO CÔNG TÁC TRANG {i} ---\n";
                string pageContent = LongAdministrativeTemplate + $"\nNội dung bổ sung cho trang {i}: Đảm bảo tính bảo mật và an toàn thông tin trong suốt quá trình xử lý văn bản quy phạm pháp luật.";
                
                sbGroundTruth.AppendLine(pageHeader);
                sbGroundTruth.AppendLine(pageContent);

                // Sinh ảnh giả lập scan cho mỗi trang
                int width = 2480; int height = 3508;
                using var surface = SKSurface.Create(new SKImageInfo(width, height));
                var canvas = surface.Canvas;
                canvas.Clear(SKColors.White);

                using var paint = new SKPaint { Color = SKColors.Black, TextSize = 42, IsAntialias = true };
                using var typeface = SKTypeface.FromFile(TimesBoldPath);
                paint.Typeface = typeface;

                canvas.DrawText(pageHeader.Trim(), 200, 200, paint);
                paint.Typeface = SKTypeface.FromFile(TimesPath);
                
                float y = 350;
                foreach (var line in pageContent.Split('\n')) {
                    // Primitive text wrap
                    string text = line;
                    while (text.Length > 80) {
                        canvas.DrawText(text.Substring(0, 80), 200, y, paint);
                        text = text.Substring(80);
                        y += 60;
                    }
                    canvas.DrawText(text, 200, y, paint);
                    y += 80;
                }

                // Nhiễu scan nhẹ per page
                var rand = new Random();
                paint.Color = SKColors.Gray.WithAlpha(20);
                for (int n = 0; n < 800; n++) canvas.DrawCircle(rand.Next(width), rand.Next(height), 1, paint);

                using var snap = surface.Snapshot();
                using var encoded = snap.Encode(SKEncodedImageFormat.Png, 85);
                doc.Add(new Image(iText.IO.Image.ImageDataFactory.Create(encoded.ToArray())).SetAutoScale(true));
                if (i < pageCount) doc.Add(new AreaBreak());
            }

            doc.Close();
            return sbGroundTruth.ToString();
        }

        public static string GenerateRotatedScannedPdf(string outputPath)
        {
            string groundTruth = "VĂN BẢN QUÉT BỊ XOAY NGANG 90 ĐỘ\n" + LongAdministrativeTemplate;
            int width = 2480; int height = 3508; // Khổ đứng chuẩn
            using var surface = SKSurface.Create(new SKImageInfo(width, height));
            var canvas = surface.Canvas;
            canvas.Clear(SKColors.White);

            // Xoay canvas 90 độ để giả lập bản scan bị đặt ngang
            canvas.Translate(width, 0);
            canvas.RotateDegrees(90);

            using var paint = new SKPaint { Color = SKColors.Black, TextSize = 45, IsAntialias = true };
            using var typeface = SKTypeface.FromFile(ArialBoldPath);
            paint.Typeface = typeface;
            
            canvas.DrawText("VĂN BẢN QUÉT GÓC 90 ĐỘ (XOAY NGANG)", 100, 100, paint);
            paint.Typeface = SKTypeface.FromFile(TimesPath);
            float y = 250;
            foreach (var line in LongAdministrativeTemplate.Split('\n')) {
                canvas.DrawText(line, 100, y, paint);
                y += 80;
            }

            using var snap = surface.Snapshot();
            using var encoded = snap.Encode(SKEncodedImageFormat.Png, 90);
            
            using var writer = new PdfWriter(outputPath);
            using var pdf = new PdfDocument(writer);
            var doc = new Document(pdf);
            doc.Add(new Image(iText.IO.Image.ImageDataFactory.Create(encoded.ToArray())).SetAutoScale(true));
            doc.Close();

            return groundTruth;
        }

        public static string GenerateBorderNoiseScannedPdf(string outputPath)
        {
            string groundTruth = "VĂN BẢN CÓ NHIỄU VIỀN ĐEN MÁY SCAN\n" + LongAdministrativeTemplate;
            int width = 2480; int height = 3508;
            using var surface = SKSurface.Create(new SKImageInfo(width, height));
            var canvas = surface.Canvas;
            canvas.Clear(SKColors.White);

            using var paint = new SKPaint { Color = SKColors.Black, TextSize = 42, IsAntialias = true };
            canvas.DrawText("VĂN BẢN CÓ NHIỄU VIỀN ĐEN", 400, 400, paint);
            
            float y = 550;
            foreach (var line in LongAdministrativeTemplate.Split('\n')) {
                string text = line;
                while (text.Length > 80) {
                    canvas.DrawText(text.Substring(0, 80), 200, y, paint);
                    text = text.Substring(80);
                    y += 60;
                }
                canvas.DrawText(text, 200, y, paint);
                y += 80;
            }

            // Giả lập viền đen máy scan (Xấu)
            paint.Color = SKColors.Black;
            canvas.DrawRect(0, 0, 80, height, paint); 
            canvas.DrawRect(width - 80, 0, 80, height, paint);
            canvas.DrawRect(0, 0, width, 60, paint);

            using var snap = surface.Snapshot();
            using var encoded = snap.Encode(SKEncodedImageFormat.Png, 85);
            
            using var writer = new PdfWriter(outputPath);
            using var pdf = new PdfDocument(writer);
            var doc = new Document(pdf);
            doc.Add(new Image(iText.IO.Image.ImageDataFactory.Create(encoded.ToArray())).SetAutoScale(true));
            doc.Close();

            return groundTruth;
        }
    }
}
