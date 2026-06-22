using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using iText.Forms;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using System.Text;
using System.Collections.Generic;

namespace ToolCalendar.Services
{
    public class OcrImageProcessingService : IOcrImageProcessingService
    {

        public string ExtractFromPdf(string filePath)
        {
            var sb = new StringBuilder();
            try
            {
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

            }
            catch
            {
                // Ignore errors reading digital signatures or permissions.
                // The OCR rasterizer will handle the actual image extraction.
            }

            return sb.ToString();
        }

        public void ExtractTextFromXObjects(PdfResources resources, StringBuilder sb, HashSet<PdfStream> visited)
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
        public string ExtractFromWord(string filePath)
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

        
    }
}