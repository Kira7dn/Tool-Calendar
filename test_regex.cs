using System;
using System.Text.RegularExpressions;

class Program
{
    static void Main()
    {
        string t = @""UBND T?NH QU?NG NINH      C?...
S? NÔNG NGHI?P VÀ MÔI TRU?NG
-------------------
    S?: 4233 /SNN&MT-CNTY
 V/v d? ngh? hoàn tr? ch?ng t? quy?t toán,
c?p phát và s? d?ng hóa ch?t phòng, ch?ng"";

        int vVIndex = t.IndexOf(""V/v"", StringComparison.OrdinalIgnoreCase);
        if (vVIndex < 0) vVIndex = t.IndexOf(""V? vi?c"", StringComparison.OrdinalIgnoreCase);
        
        string searchArea = vVIndex > 0 ? t.Substring(0, vVIndex) : t;
        Console.WriteLine(""Search Area: '"" + searchArea + ""'"");

        var mSoVb = Regex.Match(searchArea,
            @""[Ss]?[:\s]*(\d{1,6}\s*[/\-]\s*[A-ZÐÀÁ?Ã?A?????Â?????0-9&\.\-/]{2,}(?:[/\-][A-ZÐÀÁ?Ã?A?????Â?????0-9]+)*)"",
            RegexOptions.Multiline);

        if (mSoVb.Success) {
            Console.WriteLine(""Match: '"" + mSoVb.Groups[1].Value.Trim() + ""'"");
        } else {
            Console.WriteLine(""No Match!"");
        }
    }
}
