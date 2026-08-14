using System.Text;
using System.Text.RegularExpressions;
using ToolCalendar.Models;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

using Microsoft.Extensions.DependencyInjection;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Services
{
    public class OcrTextProcessingService : IOcrTextProcessingService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public OcrTextProcessingService(
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _scopeFactory = scopeFactory;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
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
                // DOCLING: Pseudo Table-Structure Recovery
                // Khoảng trắng lớn (từ 3 space hoặc tab) sẽ biến thành cột Markdown '|'
                var line = Regex.Replace(rawLine, @"[ \t]{3,}|\t+", " | ");
                line = Regex.Replace(line, @"[^\S\n|]+", " ").Trim();

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
            if (Regex.IsMatch(next, @"^(Kính gửi|Nơi nhận|V/v|Về việc|Số|Ngày|Tháng|Năm|CỘNG HÒA|Độc lập|ỦY BAN|UBND|SỞ|BAN|PHÒNG|CỤC|CHI CỤC|TRUNG TÂM)\b", RegexOptions.IgnoreCase)) return false;
            if (Regex.IsMatch(next, @"^[-•*]\s+")) return false;
            if (Regex.IsMatch(next, @"^\(?\d+[\.\)]\s+")) return false;
            if (Regex.IsMatch(next, @"^[A-ZÀ-Ỹ0-9\s\-/]{8,}$")) return false;

            if (current.EndsWith("-")) return true;
            if (Regex.IsMatch(next, @"^[,.;:!?]")) return true;
            if (char.IsLower(next[0])) return true;

            return current.Length >= 40 && !Regex.IsMatch(current, @"[.!?]$");
        }

        // ------- Phân tích văn bản bằng Ollama (VNPT Server) -------
        private async Task<DocumentRecord?> ParseTextWithOllamaAsync(string text)
        {
            try
            {
                var chatUrl = _configuration["Ollama:ChatUrl"] ?? "http://host.docker.internal:11434/api/chat";
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(30);
                
                string cleanedText = PostProcessExtractedText(text);

                var prompt = @"Bạn là chuyên gia bóc tách dữ liệu công văn. Hãy đọc nội dung thô dưới đây và trả về JSON chuẩn với các trường:
- SoVanBan: Số và ký hiệu văn bản (vd: 9679/SNN&MT-QLĐĐ).
- TenCongVan: Tên loại công văn (vd: CÔNG VĂN, QUYẾT ĐỊNH, BÁO CÁO).
- TrichYeu: Trích yếu/tóm tắt nội dung chính của công văn (rất quan trọng, bắt buộc có).
- NgayBanHanh: Ngày ban hành định dạng YYYY-MM-DD.
- CoQuanBanHanh: Tên cơ quan ban hành.
- CoQuanChuQuan: Tên cơ quan chủ quản (nếu có).
- Priority: Chọn 1 trong 3 (Hỏa tốc, Khẩn, Thường).
Bắt buộc trả về ĐÚNG định dạng JSON, không kèm markdown hay text nào khác.
Nội dung:
" + cleanedText;

                var requestBody = new
                {
                    model = "qwen2.5:1.5b",
                    messages = new[] { new { role = "user", content = prompt } },
                    stream = false,
                    format = "json",
                    options = new { temperature = 0.1 }
                };

                var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(chatUrl, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[Ollama API Error] {response.StatusCode}");
                    return null;
                }

                var responseString = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseString);
                var messageContent = jsonDoc.RootElement.GetProperty("message").GetProperty("content").GetString();
                
                if (string.IsNullOrWhiteSpace(messageContent)) return null;

                var result = JsonSerializer.Deserialize<JsonElement>(messageContent);
                var record = new DocumentRecord();

                if (result.TryGetProperty("SoVanBan", out var soVanBan)) record.SoVanBan = soVanBan.GetString();
                if (result.TryGetProperty("TenCongVan", out var tenCongVan)) record.TenCongVan = tenCongVan.GetString();
                if (result.TryGetProperty("TrichYeu", out var trichYeu)) record.TrichYeu = trichYeu.GetString();
                if (result.TryGetProperty("NgayBanHanh", out var ngayBanHanhStr) && DateTime.TryParse(ngayBanHanhStr.GetString(), out var ngayBanHanh))
                {
                    record.NgayBanHanh = ngayBanHanh;
                }
                if (result.TryGetProperty("CoQuanBanHanh", out var coQuanBanHanh)) record.CoQuanBanHanh = coQuanBanHanh.GetString();
                if (result.TryGetProperty("CoQuanChuQuan", out var coQuanChuQuan)) record.CoQuanChuQuan = coQuanChuQuan.GetString();
                if (result.TryGetProperty("Priority", out var priority)) record.Priority = priority.GetString();
                
                return record;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Ollama Parsing Error]: {ex.Message}");
                return null;
            }
        }

        // ------- Phân tích văn bản Controller (Hybrid: Regex + AI Fallback) -------
        public async Task<DocumentRecord> ParseTextAsync(string text, string filePath, string ocrPagesJson = "[]")
        {
            // 1. Chạy Regex trước (rất nhanh, độ chính xác tuyệt đối cho dữ liệu cứng)
            var record = await ParseTextWithRegexAsync(text, filePath, ocrPagesJson);
            
            // 2. Chạy Ollama để lấy dữ liệu "mềm" (Trích yếu, độ khẩn) và dự phòng
            var aiData = await ParseTextWithOllamaAsync(text);
            
            if (aiData != null)
            {
                // Thay thế dữ liệu mềm 100% bằng AI
                if (!string.IsNullOrWhiteSpace(aiData.TrichYeu))
                    record.TrichYeu = aiData.TrichYeu;
                    
                if (!string.IsNullOrWhiteSpace(aiData.Priority) && (aiData.Priority == "Hỏa tốc" || aiData.Priority == "Khẩn"))
                    record.Priority = aiData.Priority;
                    
                if (!string.IsNullOrWhiteSpace(aiData.TenCongVan))
                    record.TenCongVan = aiData.TenCongVan;

                // Dữ liệu cứng: Chỉ lấp vào nếu Regex thất bại (Rỗng)
                if (string.IsNullOrWhiteSpace(record.SoVanBan) && !string.IsNullOrWhiteSpace(aiData.SoVanBan)) 
                    record.SoVanBan = aiData.SoVanBan;
                
                if (record.NgayBanHanh == null && aiData.NgayBanHanh != null) 
                    record.NgayBanHanh = aiData.NgayBanHanh;
                
                if (string.IsNullOrWhiteSpace(record.CoQuanBanHanh) && !string.IsNullOrWhiteSpace(aiData.CoQuanBanHanh))
                    record.CoQuanBanHanh = aiData.CoQuanBanHanh;
                    
                if (string.IsNullOrWhiteSpace(record.CoQuanChuQuan) && !string.IsNullOrWhiteSpace(aiData.CoQuanChuQuan))
                    record.CoQuanChuQuan = aiData.CoQuanChuQuan;
            }
            
            EvaluateConfidence(record);
            return record;
        }

        // ------- Phân tích văn bản cũ -------
        private async Task<DocumentRecord> ParseTextWithRegexAsync(string text, string filePath, string ocrPagesJson = "[]")
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

            // Sửa lỗi OCR phổ biến cho chữ số (đặc biệt với file scan có chữ nghiêng)
            t = FixOcrDigitErrors(t);

            // Sửa lỗi OCR mất dấu tiếng Việt — bù lại dấu cho các từ khóa quan trọng
            t = FixOcrVietnameseDiacritics(t);

            int vVIndex = t.IndexOf("V/v", StringComparison.OrdinalIgnoreCase);
            if (vVIndex < 0) vVIndex = t.IndexOf("Về việc", StringComparison.OrdinalIgnoreCase);
            
            // DOCLING: Document Zoning (Phân vùng 1500 ký tự đầu để tìm dữ liệu CỨNG)
            int zoneEnd = vVIndex > 0 ? vVIndex : Math.Min(t.Length, 1500);
            string searchArea = t.Substring(0, zoneEnd);

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

            // Xác định mức độ khẩn (Giao cho AI phân loại, regex chỉ gán mặc định)
            record.Priority = "Thường";

            // ---- Bóc tách Số hiệu văn bản (V3 - Pattern-First, không phụ thuộc từ khóa "Số:") ----
            // Thuật toán: Tìm trực tiếp định dạng [số]/[MÃ-CQUAN] trong vùng header,
            // không yêu cầu OCR đọc được chữ "Số:" vốn hay bị mất/sai với file scan có ký số.

            // DOCLING: Chỉ chạy tìm Số Văn Bản trong khu vực searchArea (Header Zone)
            var candidatePattern = new Regex(
                @"(?<!\d)(\d{1,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ][A-Za-zĐđÀ-ỹ0-9\-/\.&_]{1,30})\b",
                RegexOptions.IgnoreCase);

            var referenceKeywords = new Regex(
                @"(Quy\s*định|Nghị\s*quyết|Nghị\s*định|Thông\s*tư|Luật|Pháp\s*lệnh|Công\s*điện)\s*(?:số|s[ôo6])?\s*$",
                RegexOptions.IgnoreCase);

            string bestSo = "";
            int bestSoPrio = -1;

            var candidates = candidatePattern.Matches(searchArea);
            foreach (Match m in candidates)
            {
                string num = m.Groups[1].Value;
                string agency = m.Groups[2].Value;

                if (Regex.IsMatch(agency, @"^[/\-]\s*\d{1,2}$")) continue;
                if (Regex.IsMatch(num, @"^20\d{2}$")) continue;

                int lb = Math.Max(0, m.Index - 60);
                string ctx = searchArea.Substring(lb, m.Index - lb);
                if (referenceKeywords.IsMatch(ctx)) continue;

                int prio = 1;
                if (Regex.IsMatch(ctx, @"[Ss][ôóo60]\s*[:.]?\s*(?:\d{1,3}[:\s]+)?\s*$")) prio = 100;
                else if (Regex.IsMatch(ctx, @"\n\s*$") || lb == 0) prio = 60;

                if (prio > bestSoPrio)
                {
                    bestSoPrio = prio;
                    bestSo = $"{num}{agency}";
                }
                if (bestSoPrio >= 100) break;
            }

            // Bước 2 fallback: Tìm trong searchArea với từ khóa "Số:"
            if (string.IsNullOrWhiteSpace(bestSo))
            {
                var fullMatches = Regex.Matches(searchArea,
                    @"[Ss][ôóo60]\s*[:.]?\s*(?:\d{1,3}[:\s]+)?(\d{1,6})\s*([/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ][A-Za-zĐđÀ-ỹ0-9\-/\.&_]{1,30})\b",
                    RegexOptions.IgnoreCase);
                foreach (Match m in fullMatches)
                {
                    int lb = Math.Max(0, m.Index - 60);
                    string ctx = searchArea.Substring(lb, m.Index - lb);
                    if (Regex.IsMatch(ctx, @"(Quy\s*định|Nghị\s*quyết|Nghị\s*định|Thông\s*tư|Luật)\s*$", RegexOptions.IgnoreCase))
                        continue;
                    bestSo = $"{m.Groups[1].Value}{m.Groups[2].Value}";
                    break;
                }
            }

            record.SoVanBan = bestSo.Replace(" ", "").Trim();

            // Fallback cuối cùng: Lấy từ tên file CHỈ khi tên file có định dạng số hiệu văn bản
            // (tránh điền tên file như "kế hoạch kiểm soát TTHC năm 2025" vào ô Số văn bản)
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                var fparts = fileName.Split('_');
                string realFileName = fparts.Length > 1 ? fparts[^1] : fileName;
                var mFn = Regex.Match(realFileName, @"(\d{1,6}\s*[/\-]\s*[A-Z0-9\.&_]{2,})", RegexOptions.IgnoreCase);
                if (mFn.Success)
                {
                    record.SoVanBan = mFn.Value.Replace(" ", "");
                }
                // Nếu tên file không có định dạng số hiệu → để trống, người dùng tự điền
            }

            // DOCLING: Chỉ tìm ngày ban hành trong searchArea (Zoning)
            var mNgayBHMatches = Regex.Matches(searchArea,
                @"(?:ngày|ngay|ng[àa]y)\s*([0-9a-zA-Z]{1,2})\s*(?:tháng|thang|th[áa]ng)\s*([0-9a-zA-Z]{1,2})\s*(?:năm|nam|n[ăaàãä]m|n[ăaàãä]rn|n[ăaàãä]n)\s*(\d{4})",
                RegexOptions.IgnoreCase);

            foreach (Match mNgayBH in mNgayBHMatches)
            {
                // Chuẩn hóa giá trị ngày bị OCR đọc sai
                string dayStr = Regex.Replace(mNgayBH.Groups[1].Value, @"[flIi|]", "1");
                dayStr = Regex.Replace(dayStr, @"[OoQqD]", "0");
                dayStr = Regex.Replace(dayStr, @"[zZ]", "2");
                dayStr = Regex.Replace(dayStr, @"[sS]", "5");

                string monthStr = Regex.Replace(mNgayBH.Groups[2].Value, @"[flIi|]", "1");
                monthStr = Regex.Replace(monthStr, @"[OoQqD]", "0");
                monthStr = Regex.Replace(monthStr, @"[zZ]", "2");
                monthStr = Regex.Replace(monthStr, @"[sS]", "5");

                if (string.IsNullOrWhiteSpace(dayStr) || !dayStr.All(char.IsDigit))
                {
                    var isolatedDayMatch = Regex.Match(searchArea, @"(?m)^\s*([1-9]|[12]\d|3[01])\s*$");
                    dayStr = isolatedDayMatch.Success ? isolatedDayMatch.Groups[1].Value : "1";
                }

                if (int.TryParse(dayStr, out int d) &&
                    int.TryParse(monthStr, out int mo) &&
                    int.TryParse(mNgayBH.Groups[3].Value, out int yr))
                {
                    try 
                    { 
                        record.NgayBanHanh = new DateTime(yr, mo, d); 
                        break; // Get the first valid date
                    } 
                    catch { }
                }
            }

            if (!record.NgayBanHanh.HasValue)
            {
                // Fallback: Tìm dd/MM/yyyy trong phần đầu văn bản
                string headerZoneForDate = t.Length > 800 ? t.Substring(0, 800) : t;
                var shortDateMatches = Regex.Matches(headerZoneForDate, @"\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b");
                foreach (Match m in shortDateMatches)
                {
                    if (int.TryParse(m.Groups[1].Value, out int d) &&
                        int.TryParse(m.Groups[2].Value, out int mo) &&
                        int.TryParse(m.Groups[3].Value, out int yr))
                    {
                        try { record.NgayBanHanh = new DateTime(yr, mo, d); break; } catch { }
                    }
                }
            }

            using var scope = _scopeFactory.CreateScope();
            var settingRepo = scope.ServiceProvider.GetRequiredService<ISettingRepository>();

            // Lấy cấu hình từ khóa từ DB
            string kwSource = settingRepo.GetAppSetting("Document_DeadlineKeywords", "hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành, đến hạn, thực hiện trước, báo cáo trước, kết thúc, thời hạn, hạn cuối");
            var kwList = kwSource.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
            string kwPattern = string.Join("|", kwList.Select(x => Regex.Escape(x)));

            // Từ khóa LOẠI TRỪ: ngày gần các từ này không phải hạn xử lý
            string excSource = settingRepo.GetAppSetting("Document_DeadlineExcludeKeywords", "vào khoảng, phát hiện, sinh năm, xảy ra, tại bãi, vào ngày, ngày xảy, được phát hiện, lúc khoảng");
            var excList = excSource.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
            string excPattern = excList.Count > 0 ? string.Join("|", excList.Select(x => Regex.Escape(x))) : null;

            // Số ngày tối thiểu từ ngày ban hành (để loại ngày trước hoặc bằng ngày ban hành)
            int minDeadlineDays = 0;
            if (int.TryParse(settingRepo.GetAppSetting("Document_MinDeadlineDays", "0"), out int minDaysCfg))
                minDeadlineDays = minDaysCfg;

            // Regex cho phép tùy chọn bỏ qua các cụm giờ (VD: "16h", "16h30", "17 giờ")
            string timeSkip = @"(?:\d{1,2}h\d{0,2}\s*|\d{1,2}\s*giờ\s*)?";
            var deadlinePatterns = new List<string> {
                // 1. Mẫu: [Từ khóa] + [Từ đệm linh hoạt] + [Thời gian (tùy chọn)] + [Ngày/Tháng/Năm]
                $@"(?<kw>{kwPattern})\s+[^0-9\n]{{0,30}}?\s*{timeSkip}(?:ngày|này|ngay)?\s*(?<d>\d{{1,2}})\s*[\/\-\.\s]\s*(?<m>\d{{1,2}})\s*[\/\-\.\s]\s*(?<y>\d{{4}})",
                // 2. Mẫu: [Từ khóa] + [Từ đệm linh hoạt] + [Thời gian (tùy chọn)] + [ngày... tháng... năm...]
                $@"(?<kw>{kwPattern})\s+[^0-9\n]{{0,30}}?\s*{timeSkip}(?:ngày|này|ngay)?\s*(?<d>\d{{1,2}})\s+(?:tháng|thang)\s+(?<m>\d{{1,2}})\s+(?:năm|nam)\s+(?<y>\d{{4}})",
                // 3. Mẫu: [Ngày/Tháng/Năm] + [Thời gian (tùy chọn)] + [Từ đệm] + [Từ khóa]
                $@"(?<d>\d{{1,2}})\s*[\/\-\.\s]\s*(?<m>\d{{1,2}})\s*[\/\-\.\s]\s*(?<y>\d{{4}})\s+{timeSkip}[^0-9\n]{{0,30}}?\s*(?<kw>{kwPattern})",
                // 4. Mẫu: [ngày... tháng... năm...] + [Thời gian (tùy chọn)] + [Từ đệm] + [Từ khóa]
                $@"(?<d>\d{{1,2}})\s+(?:tháng|thang)\s+(?<m>\d{{1,2}})\s+(?:năm|nam)\s+(?<y>\d{{4}})\s+{timeSkip}[^0-9\n]{{0,30}}?\s*(?<kw>{kwPattern})"
            };

            DateTime? bestMatchDate = null;
            int bestPriority = -1;

            foreach (var pattern in deadlinePatterns)
            {
                var matches = Regex.Matches(t, pattern, RegexOptions.IgnoreCase);
                foreach (Match m in matches)
                {
                    if (int.TryParse(m.Groups["d"].Value, out int day) &&
                        int.TryParse(m.Groups["m"].Value, out int month) &&
                        int.TryParse(m.Groups["y"].Value, out int year))
                    {
                        try
                        {
                            var detectedDate = new DateTime(year, month, day);

                            // Nếu từ khóa chứa chữ "trước", trừ đi 1 ngày (VD: "hoàn thành trước ngày 15/8" -> hạn là 14/8)
                            if (m.Groups["kw"].Success && m.Groups["kw"].Value.IndexOf("trước", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                detectedDate = detectedDate.AddDays(-1);
                            }

                            // Kiểm tra từ khóa loại trừ trong 50 ký tự xung quanh
                            if (excPattern != null)
                            {
                                int ctxStart = Math.Max(0, m.Index - 50);
                                int ctxLen = Math.Min(t.Length - ctxStart, m.Length + 100);
                                string ctx = t.Substring(ctxStart, ctxLen);
                                if (Regex.IsMatch(ctx, excPattern, RegexOptions.IgnoreCase)) continue;
                            }

                            // Kiểm tra ngày hạn phải >= ngày ban hành + minDeadlineDays
                            if (record.NgayBanHanh.HasValue && minDeadlineDays >= 0)
                            {
                                var earliestAllowed = record.NgayBanHanh.Value.AddDays(minDeadlineDays);
                                if (detectedDate < earliestAllowed) continue;
                            }

                            int currentPriority = 10;
                            if (m.Length < 25) currentPriority += 5;

                            if (currentPriority > bestPriority)
                            {
                                bestPriority = currentPriority;
                                bestMatchDate = detectedDate;
                            }
                        }
                        catch { }
                    }
                }
            }

            // Fallback: Tìm Ngày/Tháng/Năm đơn lẻ lớn nhất (nếu chưa tìm thấy qua Keyword)
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
                        // Bỏ qua ngày trùng ngày ban hành
                        if (record.NgayBanHanh.HasValue && dt.Date == record.NgayBanHanh.Value.Date) continue;

                        // Áp dụng từ khóa loại trừ
                        if (excPattern != null)
                        {
                            int ctxStart = Math.Max(0, m.Index - 50);
                            int ctxLen = Math.Min(t.Length - ctxStart, m.Length + 100);
                            string ctx = t.Substring(ctxStart, ctxLen);
                            if (Regex.IsMatch(ctx, excPattern, RegexOptions.IgnoreCase)) continue;
                        }

                        // Áp dụng minDeadlineDays
                        if (record.NgayBanHanh.HasValue && minDeadlineDays > 0)
                        {
                            if (dt < record.NgayBanHanh.Value.AddDays(minDeadlineDays)) continue;
                        }

                        if (bestMatchDate == null || dt > bestMatchDate) bestMatchDate = dt;
                    }
                }
            }

            // Fallback 2: Tìm các định dạng ngày tháng đa dạng
            if (bestMatchDate == null)
            {
                // Mẫu 1: ngày... tháng... năm...
                var vnDateMatches = Regex.Matches(t, @"(?:ngày|ngay)\s*(\d{1,2})\s*(?:tháng|thang)\s*(\d{1,2})\s*(?:năm|nam)\s*(\d{4})", RegexOptions.IgnoreCase);
                // Mẫu 2: dd/mm/yyyy hoặc dd-mm-yyyy
                var shortDateMatches = Regex.Matches(t, @"\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b");

                var allMatches = vnDateMatches.Cast<Match>().Concat(shortDateMatches.Cast<Match>());

                foreach (Match m in allMatches)
                {
                    if (int.TryParse(m.Groups[1].Value, out int day) &&
                        int.TryParse(m.Groups[2].Value, out int month) &&
                        int.TryParse(m.Groups[3].Value, out int year))
                    {
                        try
                        {
                            var dt = new DateTime(year, month, day);
                            if (dt > DateTime.Today.AddYears(-5))
                            {
                                if (record.NgayBanHanh.HasValue && dt.Date == record.NgayBanHanh.Value.Date) continue;

                                if (bestMatchDate == null || dt > bestMatchDate) bestMatchDate = dt;
                            }
                        }
                        catch { }
                    }
                }
            }

            if (bestMatchDate.HasValue)
            {
                // Chỉ gán cho Thời hạn xử lý, KHÔNG gán cho Ngày ban hành
                if (!record.ThoiHan.HasValue) 
                    record.ThoiHan = bestMatchDate.Value;
            }

            // Mặc định thời hạn xử lý là 7 ngày sau ngày ban hành nếu vẫn rỗng
            if (!record.ThoiHan.HasValue && record.NgayBanHanh.HasValue)
            {
                record.ThoiHan = record.NgayBanHanh.Value.AddDays(7);
            }

            // --- BÓC TÁCH CƠ QUAN BAN HÀNH & CHỦ QUẢN (V3 - Hierarchical Detection) ---
            var lines = t.Split('\n').Select(l => l.Trim()).Where(l => l.Length > 2).Take(15).ToList();
            int superiorIdx = -1;
            int issuingIdx = -1;

            // 1. Tìm Cơ quan chủ quản (Superior Authority)
            for (int i = 0; i < Math.Min(12, lines.Count); i++)
            {
                string line = lines[i];
                // Bỏ qua dòng bắt đầu bằng dấu gạch ngang (danh sách nơi nhận/kính gửi)
                if (line.StartsWith("-") || line.StartsWith("•") || line.StartsWith("*")) continue;
                // Bỏ qua nếu là dòng kính gửi
                if (line.Contains("Kính gửi", StringComparison.OrdinalIgnoreCase)) break;

                // Regex thoáng hơn: bắt đầu dòng hoặc chứa từ khóa sau khoảng trắng
                if (Regex.IsMatch(line, @"(ỦY\s*BAN|UBND|BỘ|TỔNG\s*C[ỤU]C|HỘI\s*ĐỒNG|CÔNG\s*AN|VIỆN\s*KIỂM\s*SÁT|TÒA\s*ÁN|HỘI|QUÂN\s*KHU)", RegexOptions.IgnoreCase))
                {
                    superiorIdx = i;
                    // Xóa bỏ tiêu đề quốc gia nhưng KHÔNG xóa phần sau nó (để tránh mất SỞ XÂY DỰNG nếu dính cùng dòng)
                    line = Regex.Replace(line, @"(C[ỘÔO]NG\s*H[ÒO][ÀA]\s*X[ÃA]\s*H[ỘÔO]I|C[ỘÔO]NG\s*HOA|CONG\s*HOA|Đ[ỘÔO]C\s*L[ẬA]P|DOC\s*LAP|ĐOC\s*LAP|ĐÔC\s*LAP|TỰ\s*DO|HẠNH\s*PHÚC|ĐỘC\s*LẬP)", "", RegexOptions.IgnoreCase).Trim();
                    
                    // Kiểm tra xem dòng này có chứa cả cấp dưới không (ví dụ: UBND Tỉnh... Sở...)
                    var issuingMatch = Regex.Match(line, @"(S[ỞƠ]|PH[ÒÔO]NG|BAN|C[ỤU]C|CHI\s*C[ỤU]C|TRUNG\s*T[ÂA]M|V[ĂA]N\s*PH[ÒÔO]NG)\b", RegexOptions.IgnoreCase);
                    if (issuingMatch.Success && issuingMatch.Index > 5)
                    {
                        record.CoQuanChuQuan = line.Substring(0, issuingMatch.Index).Trim();
                        record.CoQuanBanHanh = line.Substring(issuingMatch.Index).Trim();
                        issuingIdx = i;
                        break;
                    }

                    record.CoQuanChuQuan = line;
                    break;
                }
            }

            // 2. Tìm Cơ quan ban hành (Issuing Authority) nếu chưa tìm thấy ở bước 1
            if (string.IsNullOrEmpty(record.CoQuanBanHanh))
            {
                int searchStart = superiorIdx != -1 ? superiorIdx + 1 : 0;
                for (int i = searchStart; i < Math.Min(14, lines.Count); i++)
                {
                    string line = lines[i];
                    // Bỏ qua dòng bắt đầu bằng dấu gạch ngang (danh sách nơi nhận/kính gửi)
                    if (line.StartsWith("-") || line.StartsWith("•") || line.StartsWith("*")) continue;
                    // Bỏ qua nếu là dòng kính gửi
                    if (line.Contains("Kính gửi", StringComparison.OrdinalIgnoreCase)) break;

                    // Regex thoáng hơn: tìm từ khóa bất kỳ đâu trong dòng đầu văn bản
                    if (Regex.IsMatch(line, @"(S[ỞƠ]|PH[ÒÔO]NG|BAN|C[ỤU]C|CHI\s*C[ỤU]C|TRUNG\s*T[ÂA]M|V[ĂA]N\s*PH[ÒÔO]NG|ỦY\s*BAN|UBND)", RegexOptions.IgnoreCase) ||
                        Regex.IsMatch(line, @"^[A-ZÀ-Ỹ0-9\s\-/]{6,}$")) // Dòng in hoa
                    {
                        if (Regex.IsMatch(line, @"^(CỘNG HÒA|ĐỘC LẬP|TỰ DO|HẠNH PHÚC)\b", RegexOptions.IgnoreCase)) continue;
                        
                        issuingIdx = i;
                        // Xóa bỏ phần tiêu đề quốc gia nếu còn dính
                        line = Regex.Replace(line, @"(Đ[ỘÔO]C\s*L[ẬA]P|DOC\s*LAP|ĐOC\s*LAP|ĐÔC\s*LAP|TỰ\s*DO|HẠNH\s*PHÚC|ĐỘC\s*LẬP)", "", RegexOptions.IgnoreCase).Trim();
                        
                        record.CoQuanBanHanh = line;
                        break;
                    }
                }
            }

            // Logic dự phòng và làm sạch cuối cùng
            record.CoQuanChuQuan = CleanAuthorityName(record.CoQuanChuQuan);
            record.CoQuanBanHanh = CleanAuthorityName(record.CoQuanBanHanh);

            if (string.IsNullOrEmpty(record.CoQuanChuQuan)) record.CoQuanChuQuan = record.CoQuanBanHanh;
            if (string.IsNullOrEmpty(record.CoQuanBanHanh)) record.CoQuanBanHanh = record.CoQuanChuQuan;
            
            // Nếu vẫn rỗng, quét lại lần nữa với tập từ khóa rộng hơn
            if (string.IsNullOrEmpty(record.CoQuanBanHanh))
            {
                var firstAgency = lines.FirstOrDefault(l => Regex.IsMatch(l, @"(Sở|UBND|Bộ|Cục|Ban|Phòng|Công an|Viện|Tòa án)", RegexOptions.IgnoreCase));
                if (firstAgency != null) record.CoQuanBanHanh = record.CoQuanChuQuan = firstAgency;
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

            // (Đã xóa đoạn regex bóc tách Trích yếu, nhường phần này 100% cho AI phân tích ở luồng Fallback)

            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                string fileName = System.IO.Path.GetFileNameWithoutExtension(filePath);
                var mFile = Regex.Match(fileName, @"(\d{1,6}\s*[/\-]\s*[A-ZĐÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪ0-9&\.\-/]{2,})");
                if (mFile.Success) record.SoVanBan = mFile.Value.Trim();
                else record.SoVanBan = fileName.Length > 20 ? fileName.Substring(0, 20) : fileName;
            }

            // --- TÍCH HỢP LUẬT TỰ ĐỘNG (AUTO RULES) ---
            using var adminScope = _scopeFactory.CreateScope();
            var adminRepo = adminScope.ServiceProvider.GetRequiredService<IAdminRepository>();
            var rules = adminRepo.GetAutoRules();
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

            // --- BÓC TÁCH PHÒNG BAN TỰ ĐỘNG (DEPARTMENT AUTO-DETECTION & MAPPING) ---
            try
            {
                using var deptScope = _scopeFactory.CreateScope();
                var adminRepoDept = deptScope.ServiceProvider.GetRequiredService<IAdminRepository>();
                var allDepartments = adminRepoDept.GetDepartments();
                
                // 1. Kiểm tra Mapping theo Cơ quan ban hành (Quy tắc người dùng cung cấp)
                    var mapping = new (string Pattern, string TargetDept)[] {
                        ("Giáo dục|Văn hóa|Y tế|Khoa học|Nội vụ|Dân tộc|Tôn giáo|Xã hội|Lao động|Thương binh", "Phòng văn hóa xã hội"),
                        ("Tư pháp|Ngoại vụ|Thanh tra|Văn phòng", "Văn phòng HĐND và UBND"),
                        ("Công thương|Tài chính", "Phòng Kinh tế"),
                        ("Nông nghiệp|Môi trường|Xây dựng", "Phòng Xây dựng, Nông nghiệp và môi trường")
                    };

                    foreach (var m in mapping)
                    {
                        if (Regex.IsMatch(record.CoQuanBanHanh, m.Pattern, RegexOptions.IgnoreCase))
                        {
                            var target = allDepartments.FirstOrDefault(d => d.Name.Contains(m.TargetDept, StringComparison.OrdinalIgnoreCase));
                            if (target != null)
                            {
                                record.DepartmentId = target.Id;
                                break;
                            }
                        }
                    }

                // 2. Bóc tách bổ sung từ nội dung văn bản (t)
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

                // Nếu đã có phòng ban từ mapping, đưa lên đầu danh sách
                if (record.DepartmentId.HasValue && !matchedDeptIds.Contains(record.DepartmentId.Value))
                {
                    matchedDeptIds.Insert(0, record.DepartmentId.Value);
                }

                if (matchedDeptIds.Count > 0)
                {
                    record.AssignedDepartmentIds = System.Text.Json.JsonSerializer.Serialize(matchedDeptIds);
                    if (!record.DepartmentId.HasValue) record.DepartmentId = matchedDeptIds[0];
                    
                    var userRepo = deptScope.ServiceProvider.GetRequiredService<IUserRepository>();
                    var allUsers = userRepo.GetUsers();
                    var matchedUserIds = allUsers
                        .Where(u => u.DepartmentId.HasValue && matchedDeptIds.Contains(u.DepartmentId.Value) && u.Role == "CanBo")
                        .Select(u => u.Id).ToList();

                    if (matchedUserIds.Count == 0)
                    {
                        // Fallback: Nếu không tìm thấy cán bộ xử lý (CanBo), lấy bất kỳ người dùng nào thuộc phòng ban đó
                        matchedUserIds = allUsers
                            .Where(u => u.DepartmentId.HasValue && matchedDeptIds.Contains(u.DepartmentId.Value))
                            .Select(u => u.Id).ToList();
                    }
                    
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

            // Việc đánh giá EvaluateConfidence sẽ được thực hiện tại Controller (ParseTextAsync) sau khi AI Fallback
            return await Task.FromResult(record);
        }

        /// <summary>
        /// Sửa các lỗi OCR phổ biến liên quan đến chữ số - đặc biệt với file scan/ký số
        /// có font chữ nghiêng khiến Tesseract nhận nhầm: f->1, l->1, O->0
        /// </summary>
        private static string FixOcrDigitErrors(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return text;

            // 1. Sửa lỗi OCR dính chữ cái vào số (vd: "f0", "f1", "fO") - đặc biệt font nghiêng
            text = Regex.Replace(text, @"(?<=\s|^)[fF]([0-9])", "1$1");
            text = Regex.Replace(text, @"([0-9])[fF](?=\s|$)", "${1}1");

            // 2. Sửa "f" đứng độc lập giữa "ngày" và "tháng"
            text = Regex.Replace(text, @"(?<=(?:ngày|ngay)\s+)[fF](?=\s+(?:tháng|thang))", "1", RegexOptions.IgnoreCase);

            // 3. Xóa các cụm artifact nhiễu do layer ký số tạo ra (vd: "86: ", "1: ")
            // Chỉ xóa nếu nó đứng trước một số hiệu văn bản có format \d+ / ...
            // Ví dụ: "86: 148 /BC" -> "148 /BC"
            text = Regex.Replace(text, @"(?<=\s|^)\d{1,3}[:]\s*(?=\d{1,6}\s*[/\-])", "");

            return text;
        }

        private string CleanAuthorityName(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            
            // 1. Xóa các ký tự phân cách còn sót lại từ motto (- -, . ., v.v.)
            string res = Regex.Replace(input, @"[\-\s\.\,]{2,}$", "").Trim();
            res = Regex.Replace(res, @"^[\-\s\.\,]+", "").Trim();
            res = Regex.Replace(res, @"\s+", " ");
            
            // 2. Sửa lỗi OCR phổ biến (SƠ -> SỞ, PHÔNG -> PHÒNG)
            res = Regex.Replace(res, @"\bSƠ\b", "SỞ", RegexOptions.IgnoreCase);
            res = Regex.Replace(res, @"\bPHÔNG\b", "PHÒNG", RegexOptions.IgnoreCase);
            
            return res.Trim();
        }

        /// <summary>
        /// Sửa lỗi OCR mất dấu tiếng Việt bằng cách thay thế các từ không dấu phổ biến
        /// trong văn bản hành chính về đúng dạng có dấu.
        /// Chỉ áp dụng cho từ TOÀN CHỮ HOA hoặc các từ khóa cố định.
        /// </summary>
        private static string FixOcrVietnameseDiacritics(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return text;

            // Bảng từ khóa hành chính viết hoa không dấu → có dấu
            var replacements = new (string from, string to)[]{
                // Cơ quan nhà nước
                (@"\bUY\s+BAN\s+NHAN\s+DAN\b",      "ỦY BAN NHÂN DÂN"),
                (@"\bUBND\b",                          "UBND"),
                (@"\bHOI\s+DONG\s+NHAN\s+DAN\b",     "HỘI ĐỒNG NHÂN DÂN"),
                (@"\bHDND\b",                          "HĐND"),
                (@"\bCONG\s+HOA\s+XA\s+HOI\s+CHU\s+NGHIA\s+VIET\s+NAM\b", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"),
                (@"\bDOC\s+LAP\s+-\s+TU\s+DO\s+-\s+HANH\s+PHUC\b",        "Độc lập - Tự do - Hạnh phúc"),
                (@"\bDC\s+LP\b",                      "Độc lập"),
                (@"\bHANH\s+PHUC\b",                  "Hạnh phúc"),
                // Loại văn bản
                (@"\bQUYET\s+DJNH\b",                 "QUYẾT ĐỊNH"),
                (@"\bQUYET\s+DINH\b",                 "QUYẾT ĐỊNH"),
                (@"\bBAO\s+CAO\b",                     "BÁO CÁO"),
                (@"\bKE\s+HOACH\b",                    "KẾ HOẠCH"),
                (@"\bCONG\s+VAN\b",                    "CÔNG VĂN"),
                (@"\bTHONG\s+BAO\b",                   "THÔNG BÁO"),
                (@"\bTO\s+TRINH\b",                    "TỜ TRÌNH"),
                (@"\bCHI\s+THI\b",                     "CHỈ THỊ"),
                (@"\bNGHI\s+QUYET\b",                  "NGHỊ QUYẾT"),
                (@"\bHOP\s+DONG\b",                    "HỢP ĐỒNG"),
                // Đơn vị tổ chức
                (@"\bVAN\s+PHONG\b",                   "VĂN PHÒNG"),
                (@"\bPHUONG\b",                         "PHƯỜNG"),
                (@"\bQUAN\b(?=\s+[A-ZÀ-Ỹ])",           "QUẬN"),
                (@"\bTHI\s+XA\b",                      "THỊ XÃ"),
                (@"\bTHANH\s+PHO\b",                   "THÀNH PHỐ"),
                (@"\bTINH\b",                           "TỈNH"),
                (@"\bSO\s+(TAI\s+CHINH|GIAO\s+DUC|Y\s+TE|KE\s+HOACH|NOI\s+VU|TU\s+PHAP|XAY\s+DUNG|NONG\s+NGHIEP|CONG\s+THUONG|THONG\s+TIN|VAN\s+HOA)\b", "SỞ $1"),
                // Từ thông dụng trong văn bản
                (@"\bnguoi\b",                          "người"),
                (@"\bthuc\s+hien\b",                   "thực hiện"),
                (@"\bhoat\s+dong\b",                   "hoạt động"),
                (@"\bthu\s+tuc\b",                     "thủ tục"),
                (@"\bhanh\s+chinh\b",                  "hành chính"),
                (@"\bNam\s+(\d{4})\b",                 "Năm $1"),
                (@"\bnam\s+(\d{4})\b",                 "năm $1"),
                // Ngày tháng hay bị mất dấu
                (@"\bthang\b",                          "tháng"),
                (@"\bnãrn\b",                           "năm"),
                (@"\bnärn\b",                           "năm"),
                (@"\bnàn\b",                            "năm"),
            };

            foreach (var (pattern, replacement) in replacements)
            {
                text = Regex.Replace(text, pattern, replacement, RegexOptions.IgnoreCase);
            }

            return text;
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
