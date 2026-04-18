using System.Runtime.InteropServices;
using SkiaSharp;
using Tesseract;

namespace ToolCalender.Services
{
    internal static class PixBitmapConverter
    {
        public static SKBitmap? TryConvertPixToBitmap(Pix pix)
        {
            try
            {
                var pixData = pix.GetData();
                int width = pix.Width;
                int height = pix.Height;
                int rowStride = pixData.WordsPerLine * 4;
                byte[] source = new byte[rowStride * height];
                Marshal.Copy(pixData.Data, source, 0, source.Length);

                var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Gray8, SKAlphaType.Opaque));
                IntPtr destPtr = bitmap.GetPixels();
                byte[] grayBytes = new byte[width * height];

                if (pix.Depth == 1)
                {
                    for (int y = 0; y < height; y++)
                    {
                        int srcRow = y * rowStride;
                        int dstRow = y * width;
                        for (int x = 0; x < width; x++)
                        {
                            int byteIndex = srcRow + (x / 8);
                            int bitIndex = 7 - (x % 8);
                            bool isSet = (source[byteIndex] & (1 << bitIndex)) != 0;
                            grayBytes[dstRow + x] = isSet ? (byte)0 : (byte)255;
                        }
                    }
                }
                else if (pix.Depth == 8)
                {
                    for (int y = 0; y < height; y++)
                    {
                        Buffer.BlockCopy(source, y * rowStride, grayBytes, y * width, width);
                    }
                }
                else if (pix.Depth == 32)
                {
                    for (int y = 0; y < height; y++)
                    {
                        int srcRow = y * rowStride;
                        int dstRow = y * width;
                        for (int x = 0; x < width; x++)
                        {
                            int srcIndex = srcRow + (x * 4);
                            byte b = source[srcIndex];
                            byte g = source[srcIndex + 1];
                            byte r = source[srcIndex + 2];
                            grayBytes[dstRow + x] = (byte)((0.114 * b) + (0.587 * g) + (0.299 * r));
                        }
                    }
                }
                else
                {
                    bitmap.Dispose();
                    return null;
                }

                Marshal.Copy(grayBytes, 0, destPtr, grayBytes.Length);
                return bitmap;
            }
            catch
            {
                return null;
            }
        }
    }
}
