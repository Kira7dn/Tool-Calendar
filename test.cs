using System;
using System.Net.Mime;

class Program {
    static void Main() {
        var cd = new ContentDisposition { FileName = "Thống kê.docx", Inline = true };
        Console.WriteLine(cd.ToString());
    }
}
