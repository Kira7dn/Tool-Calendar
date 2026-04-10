using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using iText.Forms;
using iText.Forms.Fields;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    public static class DocumentExtractorService
    {
        public static async Task<DocumentRecord> ExtractFromFileAsync(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLower();
            string text = "";

            if (ext == ".pdf")
            {
                // Ưu tiên dùng OCR Native Windows theo yêu cầu của bạn
                // Quét hình ảnh để tránh lỗi font chữ/mã hóa
                text = await OcrService.ExtractTextFromPdfOcrAsync(filePath);
                
                // Bổ sung thêm text thô (nếu có) để tăng cường kết quả
                string rawText = ExtractFromPdf(filePath);
                if (!string.IsNullOrWhiteSpace(rawText)) text += "\n" + rawText;
            }
            else if (ext == ".doc" || ext == ".docx")
            {
                text = ExtractFromWord(filePath);
            }
            else
            {
                throw new NotSupportedException($"Định dạng '{ext}' không hỗ trợ.");
            }

            return await ParseTextAsync(text, filePath);
        }

        // ------- Đọc PDF -------
        private static string ExtractFromPdf(string filePath)
        {
            var sb = new StringBuilder();
            using var reader = new PdfReader(filePath);
            using var pdf = new PdfDocument(reader);

            // 1. Trích xuất text tĩnh từ các trang
            for (int i = 1; i <= pdf.GetNumberOfPages(); i++)
            {
                var page = pdf.GetPage(i);
                var strategy = new LocationTextExtractionStrategy();
                string pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                sb.AppendLine(pageText);

                // 2. Trích xuất text từ các Annotations (Ghi chú, Stamp...)
                foreach (var ann in page.GetAnnotations())
                {
                    // Lấy text trực tiếp từ nội dung ghi chú
                    var content = ann.GetContents();
                    if (content != null) sb.AppendLine(content.ToString());
                    
                    // Xử lý Appearance Streams (Phần hiển thị đồ họa của ghi chú)
                    var appearance = ann.GetAppearanceObject(PdfName.N);
                    if (appearance is PdfStream appStream)
                    {
                        try
                        {
                            var annStrategy = new LocationTextExtractionStrategy();
                            var processor = new PdfCanvasProcessor(annStrategy);
                            var resDict = appStream.GetAsDictionary(PdfName.Resources);
                            var res = resDict != null ? new PdfResources(resDict) : page.GetResources();
                            
                            processor.ProcessContent(appStream.GetBytes(), res);
                            var appText = annStrategy.GetResultantText();
                            if (!string.IsNullOrWhiteSpace(appText)) sb.AppendLine(appText);
                        }
                        catch { }
                    }
                }

                // 2.1 Quét đệ quy các XObjects (Form XObjects) - Đôi khi text nằm ẩn ở đây
                ExtractTextFromXObjects(page.GetResources(), sb, new HashSet<PdfStream>());
            }

            // 3. Trích xuất dữ liệu từ các ô nhập liệu (AcroForm)
            var form = PdfAcroForm.GetAcroForm(pdf, false);
            if (form != null)
            {
                var fields = form.GetAllFormFields();
                foreach (var field in fields)
                {
                    string val = field.Value.GetValueAsString();
                    if (!string.IsNullOrWhiteSpace(val))
                    {
                        sb.AppendLine($"Field_{field.Key}: {val}");
                    }
                }
            }

            return sb.ToString();
        }

        private static void ExtractTextFromXObjects(PdfResources resources, StringBuilder sb, HashSet<PdfStream> visited)
        {
            if (resources == null) return;
            var xObjectsDict = resources.GetResource(PdfName.XObject);
            if (!(xObjectsDict is PdfDictionary dict)) return;

            foreach (var key in dict.KeySet())
            {
                var obj = dict.GetAsStream(key);
                if (obj == null || visited.Contains(obj)) continue;
                visited.Add(obj);

                if (PdfName.Form.Equals(obj.GetAsName(PdfName.Subtype)))
                {
                    try
                    {
                        var strategy = new LocationTextExtractionStrategy();
                        var processor = new PdfCanvasProcessor(strategy);
                        var resDict = obj.GetAsDictionary(PdfName.Resources);
                        var subRes = resDict != null ? new PdfResources(resDict) : resources;
                        
                        processor.ProcessContent(obj.GetBytes(), subRes);
                        string text = strategy.GetResultantText();
                        if (!string.IsNullOrWhiteSpace(text)) sb.AppendLine(text);

                        if (resDict != null) ExtractTextFromXObjects(new PdfResources(resDict), sb, visited);
                    }
                    catch { }
                }
            }
        }

        // ------- Đọc Word -------
        private static string ExtractFromWord(string filePath)
        {
            var sb = new StringBuilder();
            using var doc = WordprocessingDocument.Open(filePath, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body != null)
                foreach (var para in body.Descendants<Paragraph>())
                    sb.AppendLine(para.InnerText);
            return sb.ToString();
        }

        // ------- Phân tích văn bản -------
        private static async Task<DocumentRecord> ParseTextAsync(string text, string filePath)
        {
            var record = new DocumentRecord
            {
                FilePath = filePath,
                NgayThem = DateTime.Now
            };

            // ── 0. Làm sạch văn bản (Xử lý lỗi mã hóa PDF: ƣ -> ư và khoảng trắng thừa)
            string t = text.Replace("ƣ", "ư").Replace("Ƣ", "Ư");
            t = Regex.Replace(t, @"\s+", " "); // Thu gọn mọi loại khoảng trắng (kể cả khoảng trắng khổng lồ)

            // ── 1. Số văn bản 
            // Chiến thuật OCR: Chữ "Số" rất hay bị đọc sai thành S6, S0, Sô...
            int vVIndex = t.IndexOf("V/v", StringComparison.OrdinalIgnoreCase);
            if (vVIndex < 0) vVIndex = t.IndexOf("Về việc", StringComparison.OrdinalIgnoreCase);
            string searchArea = vVIndex > 0 ? t.Substring(0, vVIndex) : (t.Length > 1500 ? t.Substring(0, 1500) : t);

            // Tìm có tiền tố (Số, S0, S6, Sô, Field...)
            var mSoVb = Regex.Match(searchArea,
                @"(?:[Ss][ốo06ô]|Field_[^:]+)[:\s]*(\d{1,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]+)",
                RegexOptions.IgnoreCase);
            
            if (mSoVb.Success)
            {
                record.SoVanBan = (mSoVb.Groups[1].Value + mSoVb.Groups[2].Value).Replace(" ", "").Trim();
            }
            else
            {
                // Fallback: Tìm thẳng mẫu Số/Ký hiệu (ví dụ: 1234/SNN-CNTY) mà không cần chữ "Số"
                var mLegacy = Regex.Match(searchArea, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})", RegexOptions.IgnoreCase);
                if (mLegacy.Success) record.SoVanBan = mLegacy.Value.Replace(" ", "").Trim();
            }

            // ── 2. Ngày ban hành (Cực kỳ linh hoạt)
            var mNgayBH = Regex.Match(t,
                @"(?:ngày|Ngày)\s*(\d{1,2})\s*(?:tháng|Tháng)\s*(\d{1,2})\s*(?:năm|Năm)\s*(\d{4})",
                RegexOptions.IgnoreCase);
            
            if (mNgayBH.Success)
            {
                if (int.TryParse(mNgayBH.Groups[1].Value, out int d) &&
                    int.TryParse(mNgayBH.Groups[2].Value, out int mo) &&
                    int.TryParse(mNgayBH.Groups[3].Value, out int yr))
                {
                    try { record.NgayBanHanh = new DateTime(yr, mo, d); } catch { }
                }
            }

            // ── 3. Thời hạn: Hỗ trợ cả chữ "trƣớc" (lỗi font) và "trước"
            var deadlinePatterns = new[] {
                @"(?:trước|trƣớc|đến|hạn|xong|trình)\s+ngày\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{4})",
                @"(?:trước|trƣớc|đến|hạn|xong|trình)\s+ngày\s*(\d{1,2})\s+tháng\s*(\d{1,2})\s+năm\s*(\d{4})"
            };

            foreach (var pattern in deadlinePatterns)
            {
                var match = Regex.Match(t, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    if (int.TryParse(match.Groups[1].Value, out int d) &&
                        int.TryParse(match.Groups[2].Value, out int mo) &&
                        int.TryParse(match.Groups[3].Value, out int yr))
                    {
                        try { record.ThoiHan = new DateTime(yr, mo, d); break; } catch { }
                    }
                }
            }

            // Nếu vẫn không thấy hạn, tìm ngày lớn nhất
            if (record.ThoiHan == DateTime.MinValue && record.NgayBanHanh.HasValue)
            {
                var allDates = Regex.Matches(t, @"(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{4})");
                DateTime maxD = record.NgayBanHanh.Value;
                foreach (Match m in allDates)
                {
                    if (DateTime.TryParseExact(m.Value.Replace(" ", ""), new[] { "d/M/yyyy", "dd/MM/yyyy" }, null, System.Globalization.DateTimeStyles.None, out var d))
                    {
                        if (d > maxD) maxD = d;
                    }
                }
                if (maxD != record.NgayBanHanh) record.ThoiHan = maxD;
            }

            // ── 4. Cơ quan ban hành (dòng đầu có "Sở", "UBND", "Ban", "Ủy ban")
            var lines = t.Split('\n');
            var coQuanLine = lines.Take(30).FirstOrDefault(l =>
                Regex.IsMatch(l, @"(Sở|UBND|Ủy ban|Phòng|Ban|Cục|Chi cục|Tổng cục)",
                RegexOptions.IgnoreCase));
            if (!string.IsNullOrWhiteSpace(coQuanLine))
                record.CoQuanBanHanh = coQuanLine.Trim();

            // ── 5. Cơ quan chủ quản tham mưu (sau "qua" hoặc "gửi" hoặc trong "Nơi nhận")
            var mChuQuan = Regex.Match(t,
                @"\(qua\s+([^\)]{5,100})\)",
                RegexOptions.IgnoreCase);
            if (mChuQuan.Success)
                record.CoQuanChuQuan = mChuQuan.Groups[1].Value.Trim();
            else
            {
                // Fallback: tìm Chi cục, Phòng... ở khoảng đầu
                var mCQ = Regex.Match(t,
                    @"(Chi cục[^\n,;\.]{3,60}|Phòng [^\n,;\.]{3,50})",
                    RegexOptions.IgnoreCase);
                if (mCQ.Success) record.CoQuanChuQuan = mCQ.Groups[1].Value.Trim();
            }

            // ── 6. Đơn vị bị chỉ đạo (phòng, ban nhận chỉ thị)
            var donViPatterns = new[]
            {
                @"Kinh tế[/\s]*Kinh tế",
                @"Hạ tầng và Đô thị",
                @"Trung tâm Cung ứng[^\n,;\.]{0,50}",
                @"Văn phòng[^\n,;\.]{0,30}",
                @"Nội vụ",
                @"Tài chính[^\n,;\.]{0,30}",
                @"Tư pháp"
            };

            var donViList = new List<string>();
            foreach (var pattern in donViPatterns)
            {
                var matches = Regex.Matches(t, pattern, RegexOptions.IgnoreCase);
                foreach (Match m in matches)
                {
                    string val = Regex.Replace(m.Value.Trim(), @"\s+", " ");
                    if (!donViList.Any(x => x.Contains(val, StringComparison.OrdinalIgnoreCase)))
                        donViList.Add(val);
                }
            }
            if (donViList.Count > 0)
                record.DonViChiDao = string.Join("; ", donViList.Distinct());

            // ── 7. Trích yếu (dòng có "V/v" hoặc "Về việc")
            // Cho phép lấy nhiều dòng vì trích yếu thường dài (dùng [\s\S] để match cả xuống dòng)
            // Thêm "Quảng Ninh", "ngày" và các từ khóa ngắt dòng để tránh lấy nhầm thông tin địa danh
            var mTrichYeu = Regex.Match(t,
                @"[Vv]/[vV]\s*[:\.]?\s*([\s\S]{10,400}?)(\n\s*\n|\n\s*-|Kính gửi|Độc lập|Địa danh|Quảng Ninh|ngày\s+\d|tháng\s+\d|$)",
                RegexOptions.IgnoreCase);
            if (mTrichYeu.Success)
            {
                string val = mTrichYeu.Groups[1].Value.Trim();
                // Làm sạch: bỏ các dấu xuống dòng thừa, thay bằng dấu cách để text liền mạch
                record.TrichYeu = Regex.Replace(val, @"\r?\n", " ").Replace("  ", " ").Trim();
            }
            else
            {
                var mVV = Regex.Match(t, @"[Vv]ề\s+việc\s+([\s\S]{10,400}?)(\n\s*\n|\n\s*-|Kính gửi|Quảng Ninh|ngày|$)", RegexOptions.IgnoreCase);
                if (mVV.Success)
                {
                    string val = mVV.Groups[1].Value.Trim();
                    record.TrichYeu = Regex.Replace(val, @"\r?\n", " ").Replace("  ", " ").Trim();
                }
            }

            // ── Fallback 1: Nếu vẫn chưa thấy số, thử tìm trong tên file
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                var mFile = Regex.Match(fileName, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})");
                if (mFile.Success) record.SoVanBan = mFile.Value.Trim();
            }

            return record;
        }

    }
}
