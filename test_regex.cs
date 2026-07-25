using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;

class Program {
    static void Main() {
        string text = @"Số: 9679/SNN&MT-QLĐĐ
Quảng Ninh, ngày 20 tháng 7 năm 2026
hoàn thành và báo cáo kết quả về UBND tỉnh chậm nhất ngày 25/7/2026
Đề nghị các địa phương gửi báo cáo về Sở Nông nghiệp và Môi trường trước 16h ngày 22/7/2026";
        
        string kwSource = "hoàn thành trong ngày, hoàn thành trước ngày, trước, ngày";
        var kwList = new List<string>();
        foreach(var k in kwSource.Split(',')) {
            if(!string.IsNullOrWhiteSpace(k)) kwList.Add(Regex.Escape(k.Trim()));
        }
        string kwPattern = string.Join("|", kwList);
        string timeSkip = @"(?:\d{1,2}h\d{0,2}\s*|\d{1,2}\s*giờ\s*)?";
        
        string pattern = $@"(?:{kwPattern})\s+[^0-9\n]{{0,30}}?\s*{timeSkip}(?:ngày|này|ngay)?\s*(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{1,2}})\s*[\/\-\.\s]\s*(\d{{4}})";
        
        var matches = Regex.Matches(text, pattern, RegexOptions.IgnoreCase);
        Console.WriteLine("Matches: " + matches.Count);
        foreach (Match m in matches) {
            Console.WriteLine($"Match: {m.Value} | G1: {m.Groups[1].Value} | G2: {m.Groups[2].Value} | G3: {m.Groups[3].Value}");
        }
    }
}
