namespace ToolCalender.Tests.Helpers
{
    internal static class TestPathHelper
    {
        public static string GetRepoRoot()
        {
            string current = AppContext.BaseDirectory;
            var dir = new DirectoryInfo(current);

            while (dir != null)
            {
                bool hasCore = Directory.Exists(Path.Combine(dir.FullName, "ToolCalender.Core"));
                bool hasTests = Directory.Exists(Path.Combine(dir.FullName, "tests"));
                if (hasCore && hasTests)
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }

            throw new DirectoryNotFoundException("Không tìm thấy thư mục root của repo ToolCalendar.");
        }

        public static string GetTestsRoot() => Path.Combine(GetRepoRoot(), "tests");

        public static string GetTestResultsRoot() => Path.Combine(GetTestsRoot(), "test_results");

        public static string GetAssetsRoot() => Path.Combine(GetTestsRoot(), "assets");

        public static string GetCoreTessdataPath() => Path.Combine(GetRepoRoot(), "ToolCalender.Core", "tessdata");

        public static string GetTestDbRoot()
        {
            if (!OperatingSystem.IsWindows())
            {
                // Trên Linux/Docker, không để SQLite DB trên volume để tránh lỗi disk I/O / file locking
                return "/tmp/test_dbs";
            }
            return Path.Combine(GetTestResultsRoot(), "test_dbs");
        }

        public static string GetFontPath(string family, bool bold = false)
        {
            if (OperatingSystem.IsWindows())
            {
                return family.ToLowerInvariant() switch
                {
                    "arial" => bold ? @"C:\Windows\Fonts\arialbd.ttf" : @"C:\Windows\Fonts\arial.ttf",
                    "times" => bold ? @"C:\Windows\Fonts\timesbd.ttf" : @"C:\Windows\Fonts\times.ttf",
                    _ => throw new InvalidOperationException($"Không hỗ trợ font family: {family}")
                };
            }

            return family.ToLowerInvariant() switch
            {
                "arial" => bold ? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "times" => bold ? "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
                _ => throw new InvalidOperationException($"Không hỗ trợ font family: {family}")
            };
        }
    }
}
