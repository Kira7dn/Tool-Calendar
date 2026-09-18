using System;
using System.Text.RegularExpressions;
using System.Net;

class Program
{
    static void Main()
    {
        string input = "<span onclick=\"showToolTip(this,'&lt;b&gt;Danh sách đính kèm &lt;/b&gt;(3167/BC-SVHTTDL): &lt;div&gt;1.&lt;a target=_blank href=\\'/DesktopModules/QuangNinh/QLVB/QLVB/pages/DownloadFile.aspx?id=WQAvAGkAYwBFAGcATgBJAEcAbwA3AGMAcQBtAGQARgBuADQASABTADYAQQA9AD0A0&amp;uid=VgB2AHAAYwB2ADMANQB6AHkAYgBCAG4AQQBqADIAMQBjAEkAMABFADcAQQA9AD0A0\\'&gt;BC tháng 5.2026 (ph).docx&lt;/a&gt;&lt;/div&gt;&lt;div&gt;2.&lt;a target=_blank href=\\'/DesktopModules/QuangNinh/QLVB/QLVB/pages/DownloadFile.aspx?id=VABRAG4AVABVAGkAUABHAHgATwBNAHAAMgBqAHYATgBsAHAAKwBFAHoAdwA9AD0A0&amp;uid=VgB2AHAAYwB2ADMANQB6AHkAYgBCAG4AQQBqADIAMQBjAEkAMABFADcAQQA9AD0A0\\'&gt;BC tháng 5.2026 (ph).signed.pdf&lt;/a&gt;&lt;/div&gt;',250);\"></span>";
        
        var decoded = WebUtility.HtmlDecode(input).Replace("\\'", "'");
        Console.WriteLine(decoded);
        var match = Regex.Match(decoded, @"href=['""]([^'""]+)['""][^>]*>([^<]+\.pdf)</a>", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            Console.WriteLine("HREF: " + match.Groups[1].Value);
            Console.WriteLine("NAME: " + match.Groups[2].Value);
        }
        else
        {
            Console.WriteLine("NO MATCH");
        }
    }
}
