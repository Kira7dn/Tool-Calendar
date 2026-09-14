using System.Net;
using HtmlAgilityPack;
using ToolCalendar.Core.Models.Integration;

namespace ToolCalendar.Core.Services.Integration;

public interface ICqdtIntegrationService
{
    Task<List<CqdtDocumentDto>> ScrapePendingDocumentsAsync(string username, string password);
}

public class CqdtIntegrationService : ICqdtIntegrationService
{
    public async Task<List<CqdtDocumentDto>> ScrapePendingDocumentsAsync(string username, string password)
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
        
        // 4. Parse Document Table
        var result = new List<CqdtDocumentDto>();
        var docsDoc = new HtmlDocument();
        docsDoc.LoadHtml(docsHtml);
        
        // Phân tích HTML từ bảng (Dựa trên cấu trúc thường thấy của hệ thống công văn)
        // Tìm thẻ table chứa các <tr>. 
        var rows = docsDoc.DocumentNode.SelectNodes("//table//tr");
        if (rows != null)
        {
            foreach (var row in rows.Skip(1)) // Bỏ qua dòng tiêu đề
            {
                var cols = row.SelectNodes("td");
                // Thông thường bảng có cột: Icon, Số văn bản, Cơ quan, Thông tin, Thao tác
                if (cols != null && cols.Count >= 4) 
                {
                    try
                    {
                        var soVanBan = cols[1]?.InnerText?.Trim();
                        var coQuan = cols[2]?.InnerText?.Trim();
                        var thongTinHtml = cols[3]?.InnerHtml;
                        
                        string trichYeu = "";
                        
                        if (!string.IsNullOrEmpty(thongTinHtml))
                        {
                            var infoDoc = new HtmlDocument();
                            infoDoc.LoadHtml(thongTinHtml);
                            trichYeu = infoDoc.DocumentNode.InnerText.Replace("\n", " ").Replace("\r", "").Trim();
                        }
                        
                        if (!string.IsNullOrEmpty(soVanBan))
                        {
                            result.Add(new CqdtDocumentDto
                            {
                                SoKyHieu = WebUtility.HtmlDecode(soVanBan),
                                CoQuanBanHanh = WebUtility.HtmlDecode(coQuan ?? ""),
                                TrichYeu = WebUtility.HtmlDecode(trichYeu)
                            });
                        }
                    }
                    catch
                    {
                        // Bỏ qua dòng lỗi parsing
                    }
                }
            }
        }
        
        return result;
    }
}
