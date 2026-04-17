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
    public class DocumentExtractorService : IDocumentExtractorService
    {
        private readonly IOcrService _ocrService;

        public DocumentExtractorService(IOcrService ocrService)
        {
            _ocrService = ocrService;
        }

        public async Task<DocumentRecord> ExtractFromFileAsync(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLower();
            string text = "";

            if (ext == ".pdf")
            {
                text = await _ocrService.ExtractTextFromPdfOcrAsync(filePath);
                
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
        private string ExtractFromPdf(string filePath)
        {
            var sb = new StringBuilder();
            using var reader = new PdfReader(filePath);
            using var pdf = new PdfDocument(reader);

            for (int i = 1; i <= pdf.GetNumberOfPages(); i++)
            {
                var page = pdf.GetPage(i);
                var strategy = new LocationTextExtractionStrategy();
                string pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                sb.AppendLine(pageText);

                foreach (var ann in page.GetAnnotations())
                {
                    var content = ann.GetContents();
                    if (content != null) sb.AppendLine(content.ToString());
                    
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

                ExtractTextFromXObjects(page.GetResources(), sb, new HashSet<PdfStream>());
            }

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

        private void ExtractTextFromXObjects(PdfResources resources, StringBuilder sb, HashSet<PdfStream> visited)
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
        private string ExtractFromWord(string filePath)
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
        private async Task<DocumentRecord> ParseTextAsync(string text, string filePath)
        {
            var record = new DocumentRecord
            {
                FilePath = filePath,
                NgayThem = DateTime.Now
            };

            string t = text.Normalize(NormalizationForm.FormC);
            t = t.Replace("ƣ", "ư").Replace("Ƣ", "Ư");
            t = Regex.Replace(t, @"\b[Ss][06óOô]\b", "Số");
            t = Regex.Replace(t, @"\b[Hh]ạn\s+[Xx]ử\s+[Ll]ỹ\b", "Hạn xử lý");
            t = Regex.Replace(t, @"\b[Tt]rƣớc\b", "trước");
            t = Regex.Replace(t, @"\s+", " ");

            int vVIndex = t.IndexOf("V/v", StringComparison.OrdinalIgnoreCase);
            if (vVIndex < 0) vVIndex = t.IndexOf("Về việc", StringComparison.OrdinalIgnoreCase);
            string searchArea = vVIndex > 0 ? t.Substring(0, vVIndex) : (t.Length > 1500 ? t.Substring(0, 1500) : t);

            var soPatterns = new[] {
                @"(?:Số|Số hiệu|Về việc)[:\s]*(\d{1,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪa-z0-9&\.\-/]+)",
                @"(?:Field_[^:]+)[:\s]*(\d{1,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪa-z0-9&\.\-/]+)"
            };

            string bestSo = "";
            int bestSoPrio = -1;

            foreach (var pattern in soPatterns) {
                var matches = Regex.Matches(text, pattern, RegexOptions.IgnoreCase);
                foreach (Match match in matches) {
                    int prio = 1;
                    if (match.Value.ToLower().Contains("số") || match.Value.ToLower().Contains("số hiệu")) prio = 10;
                    
                    if (prio > bestSoPrio) {
                        bestSoPrio = prio;
                        bestSo = $"{match.Groups[1].Value}{match.Groups[2].Value}";
                    }
                }
            }
            record.SoVanBan = bestSo.Replace(" ", "").Trim();
            
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                var mLegacy = Regex.Match(searchArea, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})", RegexOptions.IgnoreCase);
                if (mLegacy.Success) record.SoVanBan = mLegacy.Value.Replace(" ", "").Trim();
            }

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

            var deadlinePatterns = new[] {
                @"(?:trước|truoc|trướt|trình|xong|hạn|đến|ngày|kỳ)\s+(?:ngày|này|ngảy|ngay)?\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{4})",
                @"(?:trước|truoc|trình|xong|hạn|đến|ngày)\s+(?:ngày|này|ngay)\s*(\d{1,2})\s+(?:tháng|thảng|thang)\s*(\d{1,2})\s+(?:năm|nảm|nam)\s*(\d{4})",
                @"(?:Hạn|Thời hạn|Xong|Trình)\s+(?:giải\s+quyết|hoàn\s+thành|Xử\s+lý)?\s*[:\-]?\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{4})"
            };

            DateTime? bestMatchDate = null;
            int bestPriority = -1; 

            foreach (var pattern in deadlinePatterns)
            {
                var matches = Regex.Matches(t, pattern, RegexOptions.IgnoreCase);
                foreach (Match match in matches)
                {
                    if (int.TryParse(match.Groups[1].Value, out int day) &&
                        int.TryParse(match.Groups[2].Value, out int month) &&
                        int.TryParse(match.Groups[3].Value, out int year))
                    {
                        try {
                            var detectedDate = new DateTime(year, month, day);
                            int currentPriority = 1; 
                            string context = match.Value.ToLower();
                            
                            if (year > 2024) currentPriority += 2;

                            if (context.Contains("hạn") || context.Contains("han") || 
                                context.Contains("xong") || 
                                context.Contains("hoàn thành") || context.Contains("hoan thanh")) 
                                currentPriority += 10;
                            else if (context.Contains("trước") || context.Contains("truoc") || 
                                     context.Contains("trình") || context.Contains("trinh"))
                                currentPriority += 5;

                            if (currentPriority > bestPriority)
                            {
                                bestPriority = currentPriority;
                                bestMatchDate = detectedDate;
                            }
                        } catch { }
                    }
                }
            }

            if (bestMatchDate.HasValue) record.ThoiHan = bestMatchDate.Value;

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

            var lines = t.Split('\n');
            var coQuanLine = lines.Take(30).FirstOrDefault(l =>
                Regex.IsMatch(l, @"(Sở|UBND|Ủy ban|Phòng|Ban|Cục|Chi cục|Tổng cục)",
                RegexOptions.IgnoreCase));
            if (!string.IsNullOrWhiteSpace(coQuanLine))
                record.CoQuanBanHanh = coQuanLine.Trim();

            var mChuQuan = Regex.Match(t,
                @"\(qua\s+([^\)]{5,100})\)",
                RegexOptions.IgnoreCase);
            if (mChuQuan.Success)
                record.CoQuanChuQuan = mChuQuan.Groups[1].Value.Trim();
            else
            {
                var mCQ = Regex.Match(t,
                    @"(Chi cục[^\n,;\.]{3,60}|Phòng [^\n,;\.]{3,50})",
                    RegexOptions.IgnoreCase);
                if (mCQ.Success) record.CoQuanChuQuan = mCQ.Groups[1].Value.Trim();
            }

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

            var mTrichYeu = Regex.Match(t,
                @"[Vv]/[vV]\s*[:\.]?\s*([\s\S]{10,400}?)(\n\s*\n|\n\s*-|Kính gửi|Độc lập|Địa danh|Quảng Ninh|ngày\s+\d|tháng\s+\d|$)",
                RegexOptions.IgnoreCase);
            if (mTrichYeu.Success)
            {
                string val = mTrichYeu.Groups[1].Value.Trim();
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

            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                var mFile = Regex.Match(fileName, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})");
                if (mFile.Success) record.SoVanBan = mFile.Value.Trim();
            }

            return await Task.FromResult(record);
        }

    }
}
