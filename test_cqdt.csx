#r "nuget: HtmlAgilityPack, 1.11.59"

using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;
using HtmlAgilityPack;

async Task Run()
{
    var _httpClient = new HttpClient();
    _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    
    // 1. Lấy trạng thái đăng nhập ban đầu
    var loginUrl = "https://congchuc.quangninh.gov.vn/sso/Login.aspx";
    var loginPage = await _httpClient.GetStringAsync(loginUrl);
    var doc = new HtmlDocument();
    doc.LoadHtml(loginPage);
    
    var viewState = doc.DocumentNode.SelectSingleNode("//input[@name='__VIEWSTATE']")?.GetAttributeValue("value", "");
    var viewStateGen = doc.DocumentNode.SelectSingleNode("//input[@name='__VIEWSTATEGENERATOR']")?.GetAttributeValue("value", "");
    var eventValidation = doc.DocumentNode.SelectSingleNode("//input[@name='__EVENTVALIDATION']")?.GetAttributeValue("value", "");
    
    var loginData = new Dictionary<string, string>
    {
        { "__VIEWSTATE", viewState },
        { "__VIEWSTATEGENERATOR", viewStateGen },
        { "__EVENTVALIDATION", eventValidation },
        { "txtUsername", "nguyenanhduc6" },
        { "txtPassword", "javaDev@97" },
        { "btnLogin", "Đăng nhập" }
    };
    
    var loginContent = new FormUrlEncodedContent(loginData);
    var response = await _httpClient.PostAsync(loginUrl, loginContent);
    var respHtml = await response.Content.ReadAsStringAsync();
    
    if (respHtml.Contains("Tên đăng nhập hoặc mật khẩu không đúng"))
    {
        Console.WriteLine("Login failed");
        return;
    }
    
    // 2. Chuyển hướng đến trang văn bản chờ xử lý
    var pendingDocsUrl = "https://congchuc.quangninh.gov.vn/Default.aspx?tabid=1101";
    var docsResponse = await _httpClient.GetAsync(pendingDocsUrl);
    var docsHtml = await docsResponse.Content.ReadAsStringAsync();
    
    File.WriteAllText("local_dump.html", docsHtml);
    Console.WriteLine("Done, wrote to local_dump.html");
}

await Run();
