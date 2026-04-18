using SkiaSharp;
using Tesseract;

namespace ToolCalender.Services
{
    internal static class OcrImageProcessor
    {
        public static SKBitmap PreprocessBitmap(SKBitmap bitmap)
        {
            var finalBitmap = new SKBitmap(bitmap.Width, bitmap.Height);
            using var canvas = new SKCanvas(finalBitmap);
            canvas.Clear(SKColors.White);

            float[] grayscaleMatrix = {
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0, 0, 0, 1, 0
            };
            using var cf = SKColorFilter.CreateColorMatrix(grayscaleMatrix);

            float[] sharpenKernel = { -1, -1, -1, -1, 9, -1, -1, -1, -1 };
            using var filter = SKImageFilter.CreateMatrixConvolution(
                new SKSizeI(3, 3), sharpenKernel, 1f, 0f, new SKPointI(1, 1),
                SKShaderTileMode.Clamp, false);

            using var paint = new SKPaint { ColorFilter = cf, ImageFilter = filter };
            canvas.DrawBitmap(bitmap, 0, 0, paint);
            return finalBitmap;
        }

        public static SKBitmap? TryApplyOrientation(SKBitmap finalBitmap, TesseractEngine osdEngine, ResolvedOcrOptions options, out string osdInfo)
        {
            osdInfo = "";

            try
            {
                using var osdBitmap = BuildOsdBitmap(finalBitmap);
                byte[] osdData = EncodeBitmap(osdBitmap);
                using var osdPix = Pix.LoadFromMemory(osdData);
                using var osdPage = osdEngine.Process(osdPix, PageSegMode.OsdOnly);
                osdPage.DetectBestOrientation(out Orientation orientation, out float confidence);

                if (orientation == Orientation.PageUp || confidence <= options.OsdMinConfidence)
                {
                    return null;
                }

                bool isPortrait = finalBitmap.Height > finalBitmap.Width;
                bool is180 = orientation == Orientation.PageDown;
                bool isSideways = orientation == Orientation.PageLeft || orientation == Orientation.PageRight;
                bool shouldRotate = is180 || (!isPortrait || !isSideways || confidence > options.OsdMinConfidence + 5.0f);

                if (!shouldRotate)
                {
                    osdInfo = $" [OSD Blocked: Portrait-Lock for {orientation}/Conf: {confidence:F1}]";
                    return null;
                }

                osdInfo = $" [OSD Fixed: {orientation}/Conf: {confidence:F1}]";
                return FixOrientation(finalBitmap, orientation);
            }
            catch (Exception ex)
            {
                osdInfo = $" [OSD Error: {ex.Message}]";
                return null;
            }
        }

        public static byte[] EncodeBitmap(SKBitmap bitmap)
        {
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }

        public static string BuildDeskewInfo(ToolCalender.Models.OcrPageResult pageResult)
        {
            if (pageResult.DeskewApplied && pageResult.DeskewAngle.HasValue)
            {
                return $" [Deskewed: {pageResult.DeskewAngle.Value:F2}deg]";
            }

            return "";
        }

        private static SKBitmap BuildOsdBitmap(SKBitmap finalBitmap)
        {
            int osdMargin = (int)(finalBitmap.Width * 0.1);
            var osdRect = new SKRectI(osdMargin, osdMargin, finalBitmap.Width - osdMargin, finalBitmap.Height - osdMargin);
            var info = new SKImageInfo(osdRect.Width, osdRect.Height, SKColorType.Gray8);
            var bitmap = new SKBitmap(info);

            using var canvas = new SKCanvas(bitmap);
            float[] grayMatrix = {
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0.299f, 0.587f, 0.114f, 0, 0,
                0, 0, 0, 1, 0
            };

            using var paint = new SKPaint
            {
                ColorFilter = SKColorFilter.CreateColorMatrix(grayMatrix),
                ImageFilter = SKImageFilter.CreateBlur(0.8f, 0.8f)
            };

            canvas.DrawBitmap(finalBitmap, -osdMargin, -osdMargin, paint);
            return bitmap;
        }

        private static SKBitmap? FixOrientation(SKBitmap bitmap, Orientation orientation)
        {
            float degrees = 0;
            switch (orientation)
            {
                case Orientation.PageRight: degrees = -90; break;
                case Orientation.PageDown: degrees = 180; break;
                case Orientation.PageLeft: degrees = 90; break;
            }

            if (degrees == 0) return null;

            int newWidth = (degrees % 180 == 0) ? bitmap.Width : bitmap.Height;
            int newHeight = (degrees % 180 == 0) ? bitmap.Height : bitmap.Width;

            var rotated = new SKBitmap(newWidth, newHeight);
            using var canvas = new SKCanvas(rotated);
            canvas.Clear(SKColors.White);
            canvas.Translate(newWidth / 2f, newHeight / 2f);
            canvas.RotateDegrees(degrees);
            canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
            canvas.DrawBitmap(bitmap, 0, 0);
            return rotated;
        }
    }
}
