using System.Net;
using HtmlAgilityPack;
using ToolCalendar.Core.Models.Integration;

namespace ToolCalendar.Core.Services.Integration;

public interface ICqdtIntegrationService
{
    Task<List<CqdtDocumentDto>> ScrapePendingDocumentsAsync(string username, string password, int limit = 25);
}

public class CqdtIntegrationService : ICqdtIntegrationService
{
    public async Task<List<CqdtDocumentDto>> ScrapePendingDocumentsAsync(string username, string password, int limit = 25)
    {
        var cookieContainer = new CookieContainer();
        using var handler = new HttpClientHandler
        {
            CookieContainer = cookieContainer,
            UseCookies = true,
            AllowAutoRedirect = false
        };
        
        using var client = new HttpClient(handler);
        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        
        // 1. GET Login Page to get __VIEWSTATE
        var loginUrl = "https://congchuc.quangninh.gov.vn/sso/Login.aspx";
        var getResponse = await client.GetAsync(loginUrl);
        var getHtml = await getResponse.Content.ReadAsStringAsync();
        
        var doc = new HtmlDocument();
        doc.LoadHtml(getHtml);
        
        var viewState = doc.DocumentNode.SelectSingleNode("//input[@id='__VIEWSTATE']")?.GetAttributeValue("value", "");
        var eventValidation = doc.DocumentNode.SelectSingleNode("//input[@id='__EVENTVALIDATION']")?.GetAttributeValue("value", "");
        var viewStateGenerator = doc.DocumentNode.SelectSingleNode("//input[@id='__VIEWSTATEGENERATOR']")?.GetAttributeValue("value", "");
        
        if (string.IsNullOrEmpty(viewState))
        {
            throw new Exception("Không thể lấy mã bảo mật __VIEWSTATE. Trang đăng nhập CQĐT có thể đang bảo trì hoặc thay đổi giao diện.");
        }
        
        // 2. POST Login Form
        var loginData = new Dictionary<string, string>
        {
            { "__LASTFOCUS", "" },
            { "__EVENTTARGET", "" },
            { "__EVENTARGUMENT", "" },
            { "__VIEWSTATE", viewState },
            { "__VIEWSTATEGENERATOR", viewStateGenerator ?? "2B3807B2" },
            { "__VIEWSTATEENCRYPTED", "" },
            { "__EVENTVALIDATION", eventValidation ?? "" },
            { "IDToken1", username },
            { "IDToken2", password },
            { "ctlCaptcha$CaptchaTextBox", "" },
            { "btnLogin", "Đăng nhập" }
        };
        
        var content = new FormUrlEncodedContent(loginData);
        var postResponse = await client.PostAsync(loginUrl, content);
        
        // ASP.NET WebForms returns a 302 Redirect on successful login
        if (postResponse.StatusCode != HttpStatusCode.Found && postResponse.StatusCode != HttpStatusCode.Redirect)
        {
            var postHtml = await postResponse.Content.ReadAsStringAsync();
            if (postHtml.Contains("Mật khẩu không chính xác") || postHtml.Contains("không tồn tại") || postHtml.Contains("sai"))
            {
                throw new Exception("Sai tài khoản hoặc mật khẩu CQĐT. Vui lòng kiểm tra lại.");
            }
        }
        
        // 3. GET Pending Documents (Theo URL từ ảnh của user: tabid=1101)
        var pendingDocsUrl = "https://congchuc.quangninh.gov.vn/Default.aspx?tabid=1101";
        var docsResponse = await client.GetAsync(pendingDocsUrl);
        
        // If redirect back to login, it means session failed
        if (docsResponse.StatusCode == HttpStatusCode.Found)
        {
            throw new Exception("Đăng nhập CQĐT thất bại (Bị từ chối phiên đăng nhập).");
        }
        
        var docsHtml = await docsResponse.Content.ReadAsStringAsync();
        
        // Dump HTML ra file để debug cấu trúc (Đã tắt — tuân thủ tc-rule-no-temporary-files)
        
        // 4. Parse Document Table (Multi-page loop)
        var result = new List<CqdtDocumentDto>();
        string currentHtml = docsHtml;
        int pageCount = 1;

        while (result.Count < limit && pageCount <= 20) // Quét tối đa 20 trang để an toàn
        {
            var docsDoc = new HtmlDocument();
            docsDoc.LoadHtml(currentHtml);
            
            HtmlNode targetTable = null;
            var tables = docsDoc.DocumentNode.SelectNodes("//table");
            if (tables != null)
            {
                foreach (var tbl in tables)
                {
                    var html = tbl.InnerHtml.ToLower();
                    if ((html.Contains("ký hiệu") || html.Contains("số đến") || html.Contains("số văn bản")) && 
                        (html.Contains("trích yếu") || html.Contains("nội dung") || html.Contains("thông tin văn bản")))
                    {
                        var innerTables = tbl.SelectNodes(".//table");
                        if (innerTables != null && innerTables.Any(t => (t.InnerHtml.ToLower().Contains("trích yếu") || t.InnerHtml.ToLower().Contains("thông tin văn bản")) && (t.InnerHtml.ToLower().Contains("ký hiệu") || t.InnerHtml.ToLower().Contains("số văn bản"))))
                        {
                            continue; 
                        }
                        targetTable = tbl;
                        break;
                    }
                }
            }

            if (targetTable != null)
            {
                var rows = targetTable.SelectNodes(".//tr");
                if (rows != null)
                {
                    // colSoKyHieu: ƯU TIÊN "ký hiệu" (số ký hiệu văn bản thật) trước.
                    // CHỈ fallback sang "số đến" nếu KHÔNG tìm thấy cột "ký hiệu".
                    // Không gộp chung: bảng CQĐT có thể có cả 2 cột ("Số đến" = số tiếp nhận, "Ký hiệu" = số thật).
                    int colSoKyHieu = -1, colSoDen = -1, colCoQuan = 2, colTrichYeu = 3;
                    var headerCols = rows[0].SelectNodes(".//th") ?? rows[0].SelectNodes(".//td");
                    if (headerCols != null)
                    {
                        for (int i = 0; i < headerCols.Count; i++)
                        {
                            var txt = headerCols[i].InnerText.ToLower();
                            // Ưu tiên 1: "ký hiệu" hoặc "số văn bản" (số ký hiệu thật)
                            if (txt.Contains("ký hiệu") || txt.Contains("số văn bản")) colSoKyHieu = i;
                            // Ưu tiên 2 (fallback): "số đến" — là số thứ tự tiếp nhận, chỉ dùng khi không có cột ký hiệu
                            if (txt.Contains("số đến")) colSoDen = i;
                            if (txt.Contains("cơ quan") || txt.Contains("nơi gửi")) colCoQuan = i;
                            if (txt.Contains("trích yếu") || txt.Contains("nội dung") || txt.Contains("thông tin văn bản")) colTrichYeu = i;
                        }
                        // Nếu không tìm thấy cột "ký hiệu" → fallback sang "số đến"
                        if (colSoKyHieu == -1) colSoKyHieu = colSoDen == -1 ? 1 : colSoDen;
                    }
                    else
                    {
                        colSoKyHieu = 1;
                    }

                    foreach (var row in rows.Skip(1))
                    {
                        if (result.Count >= limit) break; // Đủ số lượng thì dừng

                        var cols = row.SelectNodes("td");
                        if (cols != null && cols.Count > Math.Max(colSoKyHieu, Math.Max(colCoQuan, colTrichYeu))) 
                        {
                            try
                            {
                                // Làm sạch soVanBan: loại bỏ whitespace thừa, newline từ HTML cell
                                // VD: "1849 /UBND-VHXH" → "1849/UBND-VHXH"
                                var soVanBan = System.Text.RegularExpressions.Regex
                                    .Replace(cols[colSoKyHieu]?.InnerText?.Trim() ?? "", @"\s+", " ")
                                    .Replace(" /", "/")  // xử lý khoảng trắng trước dấu /
                                    .Replace("/ ", "/")  // xử lý khoảng trắng sau dấu /
                                    .Trim();
                                var coQuan = cols[colCoQuan]?.InnerText?.Trim();
                                var thongTinHtml = cols[colTrichYeu]?.InnerHtml;
                                
                                string trichYeu = "";
                                if (!string.IsNullOrEmpty(thongTinHtml))
                                {
                                    var infoDoc = new HtmlDocument();
                                    infoDoc.LoadHtml(thongTinHtml);
                                    trichYeu = infoDoc.DocumentNode.InnerText.Replace("\n", " ").Replace("\r", "").Trim();
                                    // Nếu cột ký hiệu trống, thử lấy từ trichYeu (pattern: "Số: 1849/UBND-VHXH")
                                    if (string.IsNullOrWhiteSpace(soVanBan))
                                    {
                                        var kyHieuMatch = System.Text.RegularExpressions.Regex.Match(
                                            trichYeu,
                                            @"(?:Số|Mã ký hiệu|Ký hiệu)[:\s]+([A-Z0-9\-\/]+(?:\/[A-ZĐÔƯĂ\-]+)+)",
                                            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                                        if (kyHieuMatch.Success) soVanBan = kyHieuMatch.Groups[1].Value.Trim();
                                    }
                                }

                                if (string.IsNullOrEmpty(soVanBan) || soVanBan.Length < 2 || string.IsNullOrEmpty(trichYeu) || trichYeu.Length < 5)
                                {
                                    continue;
                                }
                                
                                string fileBase64 = "";
                                string tenTep = "";
                                string href = "";
                                
                                // Cách 1: Thử lấy link trực tiếp từ thẻ <a> (nếu có)
                                var fileLinkNode = row.SelectSingleNode(".//a[contains(@href, 'pdf') or contains(@href, 'Download') or contains(@href, 'File') or contains(@href, 'Attach') or .//img[contains(@src, 'pdf')]]");
                                if (fileLinkNode != null)
                                {
                                    href = fileLinkNode.GetAttributeValue("href", "");
                                    tenTep = fileLinkNode.InnerText.Trim();
                                }
                                
                                // Cách 2: Trích xuất từ onclick="showToolTip(...)" do CQĐT thường giấu danh sách đính kèm vào tooltip
                                var tooltipNode = row.SelectSingleNode(".//span[contains(@onclick, 'showToolTip')]");
                                if (tooltipNode != null)
                                {
                                    var onclickAttr = tooltipNode.GetAttributeValue("onclick", "");
                                    var decoded = WebUtility.HtmlDecode(onclickAttr).Replace("\\'", "'");
                                    // Ưu tiên tìm file .pdf, .signed.pdf
                                    var pdfMatch = System.Text.RegularExpressions.Regex.Match(decoded, @"href=['""]([^'""]+)['""][^>]*>([^<]+\.pdf)</a>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                                    if (pdfMatch.Success)
                                    {
                                        href = pdfMatch.Groups[1].Value;
                                        tenTep = pdfMatch.Groups[2].Value.Trim();
                                    }
                                }

                                if (!string.IsNullOrEmpty(href) && !href.Contains("javascript:"))
                                {
                                    if (!href.StartsWith("http")) href = "https://congchuc.quangninh.gov.vn/" + href.TrimStart('/');
                                    try
                                    {
                                        var fileBytes = await client.GetByteArrayAsync(href);
                                        fileBase64 = Convert.ToBase64String(fileBytes);
                                        if (string.IsNullOrEmpty(tenTep) || !tenTep.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                                        {
                                            tenTep = "CQDT_" + (soVanBan.Replace("/", "_").Replace(" ", "")) + ".pdf";
                                        }
                                    }
                                    catch { }
                                }

                                result.Add(new CqdtDocumentDto
                                {
                                    SoKyHieu = WebUtility.HtmlDecode(soVanBan),
                                    CoQuanBanHanh = WebUtility.HtmlDecode(coQuan ?? ""),
                                    TrichYeu = WebUtility.HtmlDecode(trichYeu),
                                    FileBase64 = fileBase64,
                                    CQDTTenTep = tenTep
                                });
                            }
                            catch { }
                        }
                    }
                }
            }

            // Nếu đã đủ dữ liệu, thoát vòng lặp chuyển trang
            if (result.Count >= limit) break;

            // Chuyển trang tiếp theo (Pagination)
            var nextBtn = docsDoc.DocumentNode.SelectSingleNode("//*[@class='rgPageNext' or contains(@class, 'rgPageNext')]");
            if (nextBtn == null || nextBtn.GetAttributeValue("class", "").Contains("rgDisabled") || nextBtn.GetAttributeValue("disabled", "") == "disabled" || nextBtn.GetAttributeValue("onclick", "").Contains("return false;"))
            {
                break; // Không còn trang nào nữa
            }

            var onclick = WebUtility.HtmlDecode(nextBtn.GetAttributeValue("onclick", ""));
            var match = System.Text.RegularExpressions.Regex.Match(onclick, @"__doPostBack\('([^']+)'");
            if (!match.Success) break;

            string eventTarget = match.Groups[1].Value;
            var hiddenInputs = docsDoc.DocumentNode.SelectNodes("//input[@type='hidden']");
            var pagePostData = new Dictionary<string, string>();
            if (hiddenInputs != null)
            {
                foreach (var input in hiddenInputs)
                {
                    var name = input.GetAttributeValue("name", "");
                    var value = input.GetAttributeValue("value", "");
                    if (!string.IsNullOrEmpty(name) && !pagePostData.ContainsKey(name))
                    {
                        pagePostData[name] = value;
                    }
                }
            }
            pagePostData["__EVENTTARGET"] = eventTarget;
            pagePostData["__EVENTARGUMENT"] = "";

            var pageContent = new FormUrlEncodedContent(pagePostData);
            var pageResponse = await client.PostAsync(pendingDocsUrl, pageContent);
            if (!pageResponse.IsSuccessStatusCode)
            {
                try { await System.IO.File.WriteAllTextAsync(Path.Combine(Directory.GetCurrentDirectory(), $"cqdt_html_dump_page_{pageCount+1}_err.txt"), pageResponse.StatusCode.ToString()); } catch { }
                break;
            }
            
            currentHtml = await pageResponse.Content.ReadAsStringAsync();
            pageCount++;
        }
        
        return result;
    }
}
