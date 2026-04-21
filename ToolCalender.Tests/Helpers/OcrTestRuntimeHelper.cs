using System.Diagnostics;

namespace ToolCalender.Tests.Helpers
{
    internal static class OcrTestRuntimeHelper
    {
        public static bool IsTesseractCliAvailable()
        {
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = "tesseract",
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(startInfo);
                if (process == null)
                {
                    return false;
                }

                process.WaitForExit(5000);
                return process.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }
    }
}
