using System.Text;
using System.Text.Json;
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
            return await ExtractFromFileAsync(filePath, null);
        }

        public async Task<DocumentRecord> ExtractFromFileAsync(string filePath, OcrExtractionResult? ocrResult)
        {
            string ext = Path.GetExtension(filePath).ToLower();
            string text = "";
            string ocrPagesJson = "[]";

            if (ext == ".pdf")
            {
                var resolvedOcrResult = ocrResult ?? await _ocrService.ExtractPdfOcrResultAsync(filePath);
                text = resolvedOcrResult.FullText;
                ocrPagesJson = JsonSerializer.Serialize(
                    resolvedOcrResult.Pages
                        .OrderBy(page => page.PageNumber)
                        .Select(page => new
                        {
                            pageNumber = page.PageNumber,
                            text = page.Text ?? string.Empty
                        }));
                
                string rawText = ExtractFromPdf(filePath);
                if (!string.IsNullOrWhiteSpace(rawText)) text += "\n" + rawText;

                var parsedRecord = await ParseTextAsync(text, filePath, ocrPagesJson);
                if (resolvedOcrResult.HasCriticalError)
                {
                    parsedRecord.Status = "Lỗi OCR";
                }

                return parsedRecord;
            }
            else if (ext == ".doc" || ext == ".docx")
            {
                text = ExtractFromWord(filePath);
            }
            else
            {
                throw new NotSupportedException($"Định dạng '{ext}' không hỗ trợ.");
            }

            return await ParseTextAsync(text, filePath, ocrPagesJson);
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
            {
                foreach (var para in body.Descendants<Paragraph>())
                    sb.AppendLine(para.InnerText);
            }
            return sb.ToString();
        }

        private static string PostProcessExtractedText(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var normalized = text
                .Normalize(NormalizationForm.FormC)
                .Replace("\r\n", "\n")
                .Replace('\r', '\n')
                .Replace('\u00A0', ' ');

            var rawLines = normalized.Split('\n');
            var cleanedLines = new List<string>(rawLines.Length);
            var current = new StringBuilder();

            foreach (var rawLine in rawLines)
            {
                var line = Regex.Replace(rawLine, @"[^\S\n]+", " ").Trim();

                if (line.Length == 0)
                {
                    FlushCurrent(cleanedLines, current);
                    if (cleanedLines.Count > 0 && cleanedLines[^1].Length > 0)
                    {
                        cleanedLines.Add(string.Empty);
                    }
                    continue;
                }

                if (current.Length == 0)
                {
                    current.Append(line);
                    continue;
                }

                if (ShouldJoinWrappedLine(current.ToString(), line))
                {
                    if (current[^1] == '-')
                    {
                        current.Length -= 1;
                    }
                    else
                    {
                        current.Append(' ');
                    }

                    current.Append(line);
                    continue;
                }

                FlushCurrent(cleanedLines, current);
                current.Append(line);
            }

            FlushCurrent(cleanedLines, current);

            while (cleanedLines.Count > 0 && cleanedLines[^1].Length == 0)
            {
                cleanedLines.RemoveAt(cleanedLines.Count - 1);
            }

            return string.Join('\n', cleanedLines);
        }

        private static void FlushCurrent(List<string> cleanedLines, StringBuilder current)
        {
            if (current.Length == 0) return;
            cleanedLines.Add(current.ToString().Trim());
            current.Clear();
        }

        private static bool ShouldJoinWrappedLine(string currentLine, string nextLine)
        {
            if (string.IsNullOrWhiteSpace(currentLine) || string.IsNullOrWhiteSpace(nextLine)) return false;

            var current = currentLine.Trim();
            var next = nextLine.Trim();

            if (current.EndsWith(":") || current.EndsWith(";")) return false;
            if (Regex.IsMatch(next, @"^(Kính gửi|Nơi nhận|V/v|Về việc|Số|Ngày|Tháng|Năm|CỘNG HÒA|Độc lập|ỦY BAN|UBND)\b", RegexOptions.IgnoreCase)) return false;
            if (Regex.IsMatch(next, @"^[-•*]\s+")) return false;
            if (Regex.IsMatch(next, @"^\(?\d+[\.\)]\s+")) return false;
            if (Regex.IsMatch(next, @"^[A-ZÀ-Ỹ0-9\s\-/]{8,}$")) return false;

            if (current.EndsWith("-")) return true;
            if (Regex.IsMatch(next, @"^[,.;:!?]")) return true;
            if (char.IsLower(next[0])) return true;

            return current.Length >= 40 && !Regex.IsMatch(current, @"[.!?]$");
        }

        // ------- Phân tích văn bản -------
        private async Task<DocumentRecord> ParseTextAsync(string text, string filePath, string ocrPagesJson = "[]")
        {
            string cleanedText = PostProcessExtractedText(text);
            var record = new DocumentRecord
            {
                FilePath = filePath,
                FullText = cleanedText,
                OcrPagesJson = string.IsNullOrWhiteSpace(ocrPagesJson) ? "[]" : ocrPagesJson,
                NgayThem = DateTime.Now,
                Status = "Chưa xử lý"
            };

            string t = cleanedText;
            t = t.Replace("ƣ", "ư").Replace("Ƣ", "Ư");
            t = Regex.Replace(t, @"\b[Ss][06óOô]\b", "Số");
            t = Regex.Replace(t, @"\b[Hh]ạn\s+[Xx]ử\s+[Ll]ỹ\b", "Hạn xử lý");
            t = Regex.Replace(t, @"\b[Tt]rƣớc\b", "trước");
            t = Regex.Replace(t, @"[^\S\n]+", " ");
            t = Regex.Replace(t, @"\n{3,}", "\n\n");

            int vVIndex = t.IndexOf("V/v", StringComparison.OrdinalIgnoreCase);
            if (vVIndex < 0) vVIndex = t.IndexOf("Về việc", StringComparison.OrdinalIgnoreCase);
            string searchArea = vVIndex > 0 ? t.Substring(0, vVIndex) : (t.Length > 1500 ? t.Substring(0, 1500) : t);

            // Bóc tách Tên công văn (QUYẾT ĐỊNH, THÔNG BÁO, CÔNG VĂN...)
            var tenCVPatterns = new[] {
                @"QUYẾT[ ]+ĐỊNH", @"THÔNG[ ]+BÁO", @"CÔNG[ ]+VĂN", @"TỜ[ ]+TRÌNH", 
                @"KẾ[ ]+HOẠCH", @"PHƯƠNG[ ]+ÁN", @"BÁO[ ]+CÁO", @"CHỈ[ ]+THỊ", @"NGHỊ[ ]+QUYẾT"
            };
            foreach (var pattern in tenCVPatterns)
            {
                var match = Regex.Match(searchArea, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    record.TenCongVan = match.Value.ToUpper();
                    break;
                }
            }
            if (string.IsNullOrEmpty(record.TenCongVan)) record.TenCongVan = "CÔNG VĂN";

            // Xác định mức độ khẩn
            if (t.Contains("HỎA TỐC", StringComparison.OrdinalIgnoreCase)) record.Priority = "Hỏa tốc";
            else if (t.Contains("KHẨN", StringComparison.OrdinalIgnoreCase)) record.Priority = "Khẩn";
            else record.Priority = "Thường";

            var soPatterns = new[] {
                @"(?:Số|Số hiệu|Về việc)[:\s]*(\d{0,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪa-z0-9&\.\-/]+)",
                @"(?:Field_[^:]+)[:\s]*(\d{0,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪa-z0-9&\.\-/]+)"
            };

            string bestSo = "";
            int bestSoPrio = -1;

            foreach (var pattern in soPatterns) {
                var matches = Regex.Matches(t, pattern, RegexOptions.IgnoreCase);
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
            
            // Nếu "Số" chỉ lấy được phần đuôi (chữ) do số bị nhảy loạn xạ trên File
            if (record.SoVanBan.StartsWith("/") || record.SoVanBan.StartsWith("-"))
            {
                // Tìm một số cô đơn từ 2-5 chữ số đứng riêng một dòng (Ví dụ: 3551)
                var isolatedNum = Regex.Match(t, @"(?m)^\s*(\d{2,5})\s*$");
                if (isolatedNum.Success)
                {
                    record.SoVanBan = isolatedNum.Groups[1].Value + record.SoVanBan;
                }
                else
                {
                    string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                    var fparts = fileName.Split('_');
                    string realFileName = fparts.Length > 1 ? fparts[^1] : fileName;
                    var mFileNum = Regex.Match(realFileName, @"(\d{1,6})");
                    if (mFileNum.Success) record.SoVanBan = mFileNum.Groups[1].Value + record.SoVanBan;
                }
            }
            
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                var mLegacy = Regex.Match(searchArea, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})", RegexOptions.IgnoreCase);
                if (mLegacy.Success) record.SoVanBan = mLegacy.Value.Replace(" ", "").Trim();
            }

            var mNgayBH = Regex.Match(t,
                @"(?:ngày|Ngày)\s*(\d{0,2})\s*(?:tháng|Tháng)\s*(\d{1,2})\s*(?:năm|Năm)\s*(\d{4})",
                RegexOptions.IgnoreCase);
            
            if (mNgayBH.Success)
            {
                string dayStr = string.IsNullOrWhiteSpace(mNgayBH.Groups[1].Value) ? "" : mNgayBH.Groups[1].Value;
                if (string.IsNullOrEmpty(dayStr))
                {
                    // Nếu ngày trống, dò tìm số trơ trọi đóng vai trò là ngày (1-31)
                    var isolatedDayMatch = Regex.Match(t, @"(?m)^\s*([1-9]|[12]\d|3[01])\s*$");
                    if (isolatedDayMatch.Success) dayStr = isolatedDayMatch.Groups[1].Value;
                    else dayStr = "1";
                }

                if (int.TryParse(dayStr, out int d) &&
                    int.TryParse(mNgayBH.Groups[2].Value, out int mo) &&
                    int.TryParse(mNgayBH.Groups[3].Value, out int yr))
                {
                    try { record.NgayBanHanh = new DateTime(yr, mo, d); } catch { }
                }
            }

            // Lấy từ khóa từ cấu hình
            string kwSource = Data.DatabaseService.GetAppSetting("Document_DeadlineKeywords", "hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành, đến hạn, thực hiện trước, báo cáo trước, kết thúc, thời hạn, hạn cuối");
            var kwList = kwSource.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
            string kwPattern = string.Join("|", kwList.Select(x => Regex.Escape(x)));

            var deadlinePatterns = new List<string> {
                // 1. Mẫu: [Từ khóa] + [Từ đệm linh hoạt] + [Ngày/Tháng/Năm]
                $@"(?:{kwPattern})\s+[^0-9\n]{{0,20}}?\s*(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{4}})",
                // 2. Mẫu: [Từ khóa] + [Từ đệm linh hoạt] + [ngày... tháng... năm...]
                $@"(?:{kwPattern})\s+[^0-9\n]{{0,20}}?\s*(?:ngày|này|ngay)?\s*(\d{{1,2}})\s+(?:tháng|thang)\s+(\d{{1,2}})\s+(?:năm|nam)\s+(\d{{4}})",
                // 3. Mẫu: [Ngày/Tháng/Năm] + [Từ đệm linh hoạt] + [Từ khóa]
                $@"(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{4}})\s+[^0-9\n]{{0,20}}?\s*(?:{kwPattern})",
                // 4. Mẫu: [ngày... tháng... năm...] + [Từ đệm linh hoạt] + [Từ khóa]
                $@"(\d{{1,2}})\s+(?:tháng|thang)\s+(\d{{1,2}})\s+(?:năm|nam)\s+(\d{{4}})\s+[^0-9\n]{{0,20}}?\s*(?:{kwPattern})"
            };

            DateTime? bestMatchDate = null;
            int bestPriority = -1;

            foreach (var pattern in deadlinePatterns)
            {
                var matches = Regex.Matches(t, pattern, RegexOptions.IgnoreCase);
                foreach (Match m in matches)
                {
                    if (int.TryParse(m.Groups[1].Value, out int day) &&
                        int.TryParse(m.Groups[2].Value, out int month) &&
                        int.TryParse(m.Groups[3].Value, out int year))
                    {
                        try {
                            var detectedDate = new DateTime(year, month, day);
                            int currentPriority = 10; // Mặc định có Keyword là priority 10

                            // Cộng thêm điểm nếu khoảng cách cực gần (dưới 5 ký tự)
                            if (m.Length < 25) currentPriority += 5;

                            if (currentPriority > bestPriority)
                            {
                                bestPriority = currentPriority;
                                bestMatchDate = detectedDate;
                            }
                        } catch { }
                    }
                }
            }

            // Fallback: Tìm Ngày/Tháng/Năm đơn lẻ lớn nhất (nếu chưa tìm thấy qua Keyword)
            // Lưu ý: Ta bỏ qua ngày trùng với NgayBanHanh vì đó thường là meta-data, không phải hạn
            if (bestMatchDate == null)
            {
                var allDates = Regex.Matches(t, @"(\d{1,2})\s*[\/\-\.\s]\s*(\d{1,2})\s*[\/\-\.\s]\s*(\d{4})");
                string[] formats = { "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "dd.MM.yyyy", "dd/M/yyyy", "d/MM/yyyy", "d-M-yyyy", "dd-M-yyyy", "d-MM-yyyy", "d.M.yyyy", "dd.M.yyyy", "d.MM.yyyy" };
                
                foreach (Match m in allDates)
                {
                    string dateStr = Regex.Replace(m.Value, @"\s+", "");
                    if (DateTime.TryParseExact(dateStr, formats, null, System.Globalization.DateTimeStyles.None, out DateTime dt)
                        && dt > DateTime.Today.AddYears(-5))
                    {
                        if (record.NgayBanHanh.HasValue && dt.Date == record.NgayBanHanh.Value.Date) continue;

                        if (bestMatchDate == null || dt > bestMatchDate) bestMatchDate = dt;
                    }
                }
            }

            // Fallback 2: Tìm ngày dạng chữ Việt "ngày... tháng... năm..." đơn lẻ
            if (bestMatchDate == null)
            {
                var allVnDates = Regex.Matches(t, @"(?:ngày|ngay)\s+(\d{1,2})\s+(?:tháng|thang)\s+(\d{1,2})\s+(?:năm|nam)\s+(\d{4})", RegexOptions.IgnoreCase);
                foreach (Match m in allVnDates)
                {
                    if (int.TryParse(m.Groups[1].Value, out int day) &&
                        int.TryParse(m.Groups[2].Value, out int month) &&
                        int.TryParse(m.Groups[3].Value, out int year))
                    {
                        try {
                            var dt = new DateTime(year, month, day);
                            if (dt > DateTime.Today.AddYears(-5))
                            {
                                if (record.NgayBanHanh.HasValue && dt.Date == record.NgayBanHanh.Value.Date) continue;

                                if (bestMatchDate == null || dt > bestMatchDate) bestMatchDate = dt;
                            }
                        } catch { }
                    }
                }
            }

            if (bestMatchDate.HasValue) record.ThoiHan = bestMatchDate.Value;

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

            if (string.IsNullOrWhiteSpace(record.TrichYeu) && !string.IsNullOrEmpty(record.TenCongVan))
            {
                var mTitle = Regex.Match(t, $@"{record.TenCongVan}\s*[^:\n]{{0,50}}?\s*(?:số|Số)?\s*\d+[^\n]{{0,100}}?\s+([^ \n][^\n]{{10,300}})", RegexOptions.IgnoreCase);
                if (mTitle.Success)
                {
                    record.TrichYeu = mTitle.Groups[1].Value.Trim();
                }
            }

            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                var mFile = Regex.Match(fileName, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})");
                if (mFile.Success) record.SoVanBan = mFile.Value.Trim();
                else record.SoVanBan = fileName.Length > 20 ? fileName.Substring(0, 20) : fileName;
            }

            // --- TÍCH HỢP LUẬT TỰ ĐỘNG (AUTO RULES) ---
            var rules = Data.DatabaseService.GetAutoRules();
            foreach (var rule in rules)
            {
                if (!string.IsNullOrEmpty(rule.Keyword) && 
                    t.Contains(rule.Keyword, StringComparison.OrdinalIgnoreCase))
                {
                    // 1. Tự động dán nhãn
                    record.LabelId = rule.LabelId;

                    // 2. Tự động giao việc (Phòng ban)
                    if (rule.DepartmentId.HasValue)
                    {
                        record.DepartmentId = rule.DepartmentId;
                    }

                    // 3. Tự động tính hạn (nếu chưa tìm thấy hạn trong văn bản)
                    if (record.ThoiHan == null && rule.DefaultDeadlineDays > 0)
                    {
                        var baseDate = record.NgayBanHanh ?? DateTime.Today;
                        record.ThoiHan = baseDate.AddDays(rule.DefaultDeadlineDays);
                    }
                    
                    // Chỉ áp dụng luật đầu tiên khớp (có thể thay đổi nếu cần ưu tiên khác)
                    break;
                }
            }

            // --- BÓC TÁCH PHÒNG BAN TỰ ĐỘNG (DEPARTMENT AUTO-DETECTION) ---
            try
            {
                var allDepartments = Data.DatabaseService.GetDepartments();
                var matchedDeptIds = new List<int>();
                foreach (var dept in allDepartments)
                {
                    if (string.IsNullOrWhiteSpace(dept.Name)) continue;
                    string deptNameCore = Regex.Replace(dept.Name, @"^(Phòng|Ban|Trung tâm|Văn phòng)\s+", "", RegexOptions.IgnoreCase).Trim();
                    bool matched = t.Contains(dept.Name, StringComparison.OrdinalIgnoreCase);
                    if (!matched && deptNameCore.Length >= 4)
                        matched = t.Contains(deptNameCore, StringComparison.OrdinalIgnoreCase);
                    if (matched && !matchedDeptIds.Contains(dept.Id))
                        matchedDeptIds.Add(dept.Id);
                }
                if (matchedDeptIds.Count > 0)
                {
                    record.AssignedDepartmentIds = System.Text.Json.JsonSerializer.Serialize(matchedDeptIds);
                    if (!record.DepartmentId.HasValue) record.DepartmentId = matchedDeptIds[0];
                    var allUsers = Data.DatabaseService.GetUsers();
                    var matchedUserIds = allUsers
                        .Where(u => u.DepartmentId.HasValue && matchedDeptIds.Contains(u.DepartmentId.Value) && u.Role == "CanBo")
                        .Select(u => u.Id).ToList();
                    if (matchedUserIds.Count > 0)
                    {
                        record.AssignedUserIds = System.Text.Json.JsonSerializer.Serialize(matchedUserIds);
                        if (!record.AssignedTo.HasValue) record.AssignedTo = matchedUserIds[0];
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Dept auto-detect error: {ex.Message}");
            }

            EvaluateConfidence(record);
            return await Task.FromResult(record);
        }

        private void EvaluateConfidence(DocumentRecord record)
        {
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
                record.OcrWarnings.Add("Có vẻ chưa bóc tách được Số hiệu");
            
            if (record.ThoiHan == null)
                record.OcrWarnings.Add("Chưa tìm thấy Hạn xử lý");
            
            if (record.DepartmentId == null)
                record.OcrWarnings.Add("Chưa phân loại được Đơn vị xử lý");
            
            if (!string.IsNullOrWhiteSpace(record.TrichYeu))
            {
                if (Regex.IsMatch(record.TrichYeu, @"[a-zA-ZÀ-ỹ]\d[a-zA-ZÀ-ỹ]"))
                    record.OcrWarnings.Add("Trích yếu có vẻ kẹt số do quét lỗi");
                
                if (Regex.IsMatch(record.TrichYeu, @"[a-zA-ZÀ-ỹ]['\`\~^]"))
                    record.OcrWarnings.Add("Trích yếu bị rớt dấu nón hoặc nháy đơn");
                
                if (Regex.IsMatch(record.TrichYeu, @"[^a-zA-Z0-9\sÀ-ỹ\.\,\/\-]{3,}"))
                    record.OcrWarnings.Add("Trích yếu chứa cụm ký tự rác vô nghĩa");
            }

            if (!string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                if (Regex.IsMatch(record.SoVanBan, @"[^a-zA-Z0-9\sÀ-ỹ\.\,\/\-]{3,}"))
                    record.OcrWarnings.Add("Số hiệu chứa ký tự nhiễu rác");
            }
        }
    }
}
