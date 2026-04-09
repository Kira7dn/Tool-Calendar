using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    public static class DocumentExtractorService
    {
        public static DocumentRecord ExtractFromFile(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLower();
            string text = ext switch
            {
                ".pdf" => ExtractFromPdf(filePath),
                ".docx" or ".doc" => ExtractFromWord(filePath),
                _ => throw new NotSupportedException($"Định dạng '{ext}' không hỗ trợ. Chỉ hỗ trợ PDF và DOCX.")
            };

            return ParseText(text, filePath);
        }

        // ------- Đọc PDF -------
        private static string ExtractFromPdf(string filePath)
        {
            var sb = new StringBuilder();
            using var reader = new PdfReader(filePath);
            using var pdf = new PdfDocument(reader);

            for (int i = 1; i <= pdf.GetNumberOfPages(); i++)
            {
                var page = pdf.GetPage(i);
                var strategy = new SimpleTextExtractionStrategy();
                string pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                sb.AppendLine(pageText);
            }
            return sb.ToString();
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
        private static DocumentRecord ParseText(string text, string filePath)
        {
            var record = new DocumentRecord
            {
                FilePath = filePath,
                NgayThem = DateTime.Now
            };

            string t = text.Replace("\r\n", "\n").Replace("\r", "\n");

            // ── 1. Số văn bản (VD: "4233/SNN&MT-CNTY", "Số: 4233/SNN&MT-CNTY")
            var mSoVb = Regex.Match(t,
                @"[Ss]ố[:\s]*(\d+[/\-][A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ&\.\-/]+(?:[/\-][A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ]+)*)",
                RegexOptions.Multiline);
            if (mSoVb.Success) record.SoVanBan = mSoVb.Groups[1].Value.Trim();

            // ── 2. Ngày ban hành ("ngày 08 tháng 4 năm 2026")
            var mNgayBH = Regex.Match(t,
                @"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})",
                RegexOptions.IgnoreCase);
            if (mNgayBH.Success)
            {
                int d = int.Parse(mNgayBH.Groups[1].Value);
                int mo = int.Parse(mNgayBH.Groups[2].Value);
                int yr = int.Parse(mNgayBH.Groups[3].Value);
                try { record.NgayBanHanh = new DateTime(yr, mo, d); } catch { }
            }

            // ── 3. Thời hạn: "trước ngày DD/MM/YYYY"
            var mThoiHan = Regex.Match(t,
                @"trước ngày\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})",
                RegexOptions.IgnoreCase);
            if (mThoiHan.Success)
            {
                int d = int.Parse(mThoiHan.Groups[1].Value);
                int mo = int.Parse(mThoiHan.Groups[2].Value);
                int yr = int.Parse(mThoiHan.Groups[3].Value);
                try { record.ThoiHan = new DateTime(yr, mo, d); } catch { }
            }
            else
            {
                // "trước ngày NN tháng MM năm YYYY"
                var mThoiHan2 = Regex.Match(t,
                    @"trước ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})",
                    RegexOptions.IgnoreCase);
                if (mThoiHan2.Success)
                {
                    int d = int.Parse(mThoiHan2.Groups[1].Value);
                    int mo = int.Parse(mThoiHan2.Groups[2].Value);
                    int yr = int.Parse(mThoiHan2.Groups[3].Value);
                    try { record.ThoiHan = new DateTime(yr, mo, d); } catch { }
                }
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
            var mTrichYeu = Regex.Match(t,
                @"[Vv]/[vV]\s*[:\.]?\s*(.{10,200})",
                RegexOptions.Multiline);
            if (mTrichYeu.Success)
                record.TrichYeu = mTrichYeu.Groups[1].Value.Trim();
            else
            {
                var mVV = Regex.Match(t, @"[Vv]ề\s+việc\s+(.{10,200})", RegexOptions.Multiline);
                if (mVV.Success) record.TrichYeu = mVV.Groups[1].Value.Trim();
            }

            return record;
        }

    }
}
