using PDFtoImage;
using SkiaSharp;

namespace ToolCalender.Services
{
    internal static class PdfPageRenderer
    {
        public static int CountPdfPages(string filePath)
        {
            try 
            {
                using var fsCount = File.OpenRead(filePath);
                using var reader = new iText.Kernel.Pdf.PdfReader(fsCount);
                using var pdfDoc = new iText.Kernel.Pdf.PdfDocument(reader);
                return pdfDoc.GetNumberOfPages();
            }
            catch
            {
                // Fallback if iText fails (e.g. digital signature or permissions)
                return 10; // Giả định tối đa 10 trang để tiếp tục quét OCR nếu không biết chính xác
            }
        }

        public static SKBitmap? RenderPageBitmap(string filePath, int pageIndex, int dpi)
        {
            using var pdfStream = File.OpenRead(filePath);
            using var pageImageStream = new MemoryStream();
            Conversion.SavePng(
                pageImageStream,
                pdfStream,
                password: null,
                page: pageIndex,
                dpi: dpi,
                width: null,
                height: null,
                withAnnotations: true,
                withFormFill: true,
                withAspectRatio: false,
                rotation: PdfRotation.Rotate0,
                antiAliasing: PdfAntiAliasing.All,
                backgroundColor: SKColors.White);
            pageImageStream.Position = 0;
            return SKBitmap.Decode(pageImageStream);
        }
    }
}
