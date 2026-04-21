using Microsoft.Extensions.Configuration;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    internal static class OcrOptionsResolver
    {
        private const int DefaultRenderDpi = 300;
        private const float DefaultDeskewMinAbsAngle = 0.3f;
        private const float DefaultOsdMinConfidence = 5.0f;

        public static ResolvedOcrOptions Resolve(IConfiguration configuration, OcrRunOptions? options)
        {
            bool enableDebug = options?.EnableDebug
                ?? bool.TryParse(configuration["OcrSettings:EnableDebug"], out bool parsedEnableDebug) && parsedEnableDebug;

            string debugPath = options?.DebugPath
                ?? configuration["OcrSettings:DebugPath"]
                ?? ResolveDefaultDebugPath();

            return new ResolvedOcrOptions
            {
                EnableDebug = enableDebug,
                DebugPath = debugPath,
                RenderDpi = options?.RenderDpi ?? ParseIntConfig(configuration, "OcrSettings:RenderDpi", DefaultRenderDpi),
                EnableOsd = options?.EnableOsd ?? ParseBoolConfig(configuration, "OcrSettings:EnableOsd", true),
                EnableDeskew = options?.EnableDeskew ?? ParseBoolConfig(configuration, "OcrSettings:EnableDeskew", true),
                DeskewMinAbsAngle = options?.DeskewMinAbsAngle ?? ParseFloatConfig(configuration, "OcrSettings:DeskewMinAbsAngle", DefaultDeskewMinAbsAngle),
                OsdMinConfidence = options?.OsdMinConfidence ?? ParseFloatConfig(configuration, "OcrSettings:OsdMinConfidence", DefaultOsdMinConfidence)
            };
        }

        private static string ResolveDefaultDebugPath()
        {
            string? rootDir = AppDomain.CurrentDomain.BaseDirectory;
            while (!string.IsNullOrEmpty(rootDir))
            {
                if (Directory.GetFiles(rootDir, "*.sln*").Length > 0) break;
                rootDir = Path.GetDirectoryName(rootDir);
            }

            return Path.Combine(rootDir ?? AppDomain.CurrentDomain.BaseDirectory, "tests", "test_results", "actual_test", "debug_images");
        }

        private static int ParseIntConfig(IConfiguration configuration, string key, int defaultValue)
        {
            return int.TryParse(configuration[key], out int parsedValue) ? parsedValue : defaultValue;
        }

        private static bool ParseBoolConfig(IConfiguration configuration, string key, bool defaultValue)
        {
            return bool.TryParse(configuration[key], out bool parsedValue) ? parsedValue : defaultValue;
        }

        private static float ParseFloatConfig(IConfiguration configuration, string key, float defaultValue)
        {
            return float.TryParse(configuration[key], out float parsedValue) ? parsedValue : defaultValue;
        }
    }
}
