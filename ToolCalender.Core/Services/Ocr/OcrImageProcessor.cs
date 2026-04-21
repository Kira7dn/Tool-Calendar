using SkiaSharp;

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

            // Dùng blur nhẹ thay vì Sharpen để làm mịn các đốm nhiễu (noise dots) nhỏ
            using var blur = SKImageFilter.CreateBlur(0.5f, 0.5f);
            
            using var paint = new SKPaint { ColorFilter = cf, ImageFilter = blur };
            canvas.DrawBitmap(bitmap, 0, 0, paint);
            return finalBitmap;
        }

        public static SKBitmap BuildOsdBitmap(SKBitmap finalBitmap)
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

        public static SKBitmap? RotateBitmap(SKBitmap bitmap, float degrees)
        {
            if (Math.Abs(degrees) < 0.01f)
            {
                return null;
            }

            double radians = degrees * Math.PI / 180.0;
            double cos = Math.Abs(Math.Cos(radians));
            double sin = Math.Abs(Math.Sin(radians));
            int newWidth = (int)Math.Ceiling((bitmap.Width * cos) + (bitmap.Height * sin));
            int newHeight = (int)Math.Ceiling((bitmap.Width * sin) + (bitmap.Height * cos));

            var rotated = new SKBitmap(newWidth, newHeight);
            using var canvas = new SKCanvas(rotated);
            canvas.Clear(SKColors.White);
            canvas.Translate(newWidth / 2f, newHeight / 2f);
            canvas.RotateDegrees(degrees);
            canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
            canvas.DrawBitmap(bitmap, 0, 0);
            return rotated;
        }

        public static float? EstimateDeskewAngle(SKBitmap bitmap, float minAbsAngle)
        {
            using var analysisBitmap = BuildDeskewAnalysisBitmap(bitmap);
            if (analysisBitmap.Width == 0 || analysisBitmap.Height == 0)
            {
                return null;
            }

            var candidateAngles = Enumerable.Range(-20, 41).Select(index => index * 0.25f);
            double bestScore = double.MinValue;
            float bestAngle = 0;
            int darkPixels = 0;

            for (int y = 0; y < analysisBitmap.Height; y += 2)
            {
                for (int x = 0; x < analysisBitmap.Width; x += 2)
                {
                    var color = analysisBitmap.GetPixel(x, y);
                    if (color.Red < 180)
                    {
                        darkPixels++;
                    }
                }
            }

            if (darkPixels < 100)
            {
                return null;
            }

            foreach (float angle in candidateAngles)
            {
                double score = CalculateProjectionScore(analysisBitmap, angle);
                if (score > bestScore)
                {
                    bestScore = score;
                    bestAngle = angle;
                }
            }

            return Math.Abs(bestAngle) >= minAbsAngle ? bestAngle : null;
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

        private static SKBitmap BuildDeskewAnalysisBitmap(SKBitmap bitmap)
        {
            int maxWidth = 1200;
            if (bitmap.Width <= maxWidth)
            {
                return bitmap.Copy();
            }

            float scale = maxWidth / (float)bitmap.Width;
            int width = maxWidth;
            int height = Math.Max(1, (int)Math.Round(bitmap.Height * scale));
            var resized = new SKBitmap(width, height, bitmap.ColorType, bitmap.AlphaType);
            bitmap.ScalePixels(resized, SKFilterQuality.Medium);
            return resized;
        }

        private static double CalculateProjectionScore(SKBitmap bitmap, float angleDegrees)
        {
            double radians = -angleDegrees * Math.PI / 180.0;
            double sin = Math.Sin(radians);
            double cos = Math.Cos(radians);
            int[] histogram = new int[(bitmap.Height * 2) + bitmap.Width];
            int offset = bitmap.Width;

            for (int y = 0; y < bitmap.Height; y += 2)
            {
                for (int x = 0; x < bitmap.Width; x += 2)
                {
                    var color = bitmap.GetPixel(x, y);
                    if (color.Red >= 180)
                    {
                        continue;
                    }

                    int projectedY = (int)Math.Round((y * cos) + (x * sin)) + offset;
                    if (projectedY >= 0 && projectedY < histogram.Length)
                    {
                        histogram[projectedY]++;
                    }
                }
            }

            double sum = 0;
            double sumSquares = 0;
            int usedBins = 0;
            foreach (int value in histogram)
            {
                if (value <= 0)
                {
                    continue;
                }

                sum += value;
                sumSquares += value * value;
                usedBins++;
            }

            if (usedBins == 0)
            {
                return double.MinValue;
            }

            double mean = sum / usedBins;
            return sumSquares - (usedBins * mean * mean);
        }
    }
}
