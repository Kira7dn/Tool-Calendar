using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using ToolCalender.Data;
using ToolCalender.Models;
using ToolCalender.Services;

var pdfPath = args.Length > 0
    ? args[0]
    : @"D:\Business Analyze\ToolCalendar\Khảo sát nhu cầu bồi dưỡng.signed (1).pdf";

if (!File.Exists(pdfPath))
{
    Console.Error.WriteLine($"File not found: {pdfPath}");
    return 1;
}

var config = new ConfigurationBuilder().Build();
Environment.SetEnvironmentVariable("DB_PATH", @"D:\Business Analyze\ToolCalendar\data\documents.db");
DatabaseService.Initialize();
var ocrService = new OcrService(config, NullLogger<OcrService>.Instance);
var extractor = new DocumentExtractorService(ocrService);

var extractFromPdfMethod = typeof(DocumentExtractorService).GetMethod("ExtractFromPdf", BindingFlags.Instance | BindingFlags.NonPublic);
if (extractFromPdfMethod == null)
{
    Console.Error.WriteLine("Could not find private method ExtractFromPdf via reflection.");
    return 1;
}

var pdfText = (string?)extractFromPdfMethod.Invoke(extractor, new object[] { pdfPath }) ?? string.Empty;
Console.WriteLine("=== DIRECT PDF TEXT (first 5000 chars) ===");
Console.WriteLine(pdfText.Length > 5000 ? pdfText[..5000] : pdfText);
Console.WriteLine();
Console.WriteLine($"[Direct PDF text length] {pdfText.Length}");
Console.WriteLine($"[Contains 1913] {pdfText.Contains("1913", StringComparison.OrdinalIgnoreCase)}");
Console.WriteLine($"[Contains /SNV-CCHC&DTBD] {pdfText.Contains("/SNV-CCHC&DTBD", StringComparison.OrdinalIgnoreCase)}");
Console.WriteLine();

try
{
    var debugPath = Path.Combine(@"D:\Business Analyze\ToolCalendar\tests\test_results\actual_test\debug_images", "temp-pdf-inspect");
    Directory.CreateDirectory(debugPath);
    var ocrResult = await ocrService.ExtractPdfOcrResultAsync(pdfPath, new OcrRunOptions
    {
        EnableDebug = true,
        DebugPath = debugPath
    });
    Console.WriteLine("=== OCR TEXT (first 5000 chars) ===");
    var ocrText = ocrResult.FullText ?? string.Empty;
    Console.WriteLine(ocrText.Length > 5000 ? ocrText[..5000] : ocrText);
    Console.WriteLine();
    Console.WriteLine($"[OCR text length] {ocrText.Length}");
    Console.WriteLine($"[Contains 1913] {ocrText.Contains("1913", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"[Contains /SNV-CCHC&DTBD] {ocrText.Contains("/SNV-CCHC&DTBD", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"[Pages] {ocrResult.Pages.Count}, [CriticalError] {ocrResult.HasCriticalError}");
    Console.WriteLine($"[ErrorMessage] {ocrResult.ErrorMessage}");
    Console.WriteLine($"[DebugPath] {debugPath}");

    foreach (var page in ocrResult.Pages.Take(2))
    {
        Console.WriteLine();
        Console.WriteLine($"--- OCR PAGE {page.PageNumber} (first 1200 chars) ---");
        var pageText = page.Text ?? string.Empty;
        Console.WriteLine(pageText.Length > 1200 ? pageText[..1200] : pageText);
        Console.WriteLine($"[Page {page.PageNumber} contains 1913] {pageText.Contains("1913", StringComparison.OrdinalIgnoreCase)}");
        Console.WriteLine($"[Page {page.PageNumber} contains /SNV-CCHC&DTBD] {pageText.Contains("/SNV-CCHC&DTBD", StringComparison.OrdinalIgnoreCase)}");
    }
}
catch (Exception ex)
{
    Console.WriteLine();
    Console.WriteLine("=== OCR FAILED ===");
    Console.WriteLine(ex.ToString());
}

return 0;
