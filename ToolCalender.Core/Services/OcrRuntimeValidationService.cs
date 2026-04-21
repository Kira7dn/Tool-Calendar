using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ToolCalender.Services
{
    public sealed class OcrRuntimeValidationService : IHostedService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<OcrRuntimeValidationService> _logger;

        public OcrRuntimeValidationService(IConfiguration configuration, ILogger<OcrRuntimeValidationService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            string tessDataPath = ResolveTessDataPath();
            ValidateTessData(tessDataPath);
            string version = await RunProcessAsync("tesseract", "--version", cancellationToken);
            _logger.LogInformation("[OCR] Runtime OK. Tessdata: {TessDataPath}. Version: {VersionLine}", tessDataPath, version.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim());
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        private string ResolveTessDataPath()
        {
            string? configuredPath = _configuration["OcrSettings:TessDataPath"];
            if (!string.IsNullOrWhiteSpace(configuredPath) && Directory.Exists(configuredPath))
            {
                return configuredPath;
            }

            string? prefix = Environment.GetEnvironmentVariable("TESSDATA_PREFIX");
            if (!string.IsNullOrWhiteSpace(prefix) && Directory.Exists(prefix))
            {
                return prefix;
            }

            if (Directory.Exists("/usr/share/tesseract-ocr/5/tessdata"))
            {
                return "/usr/share/tesseract-ocr/5/tessdata";
            }

            if (Directory.Exists("/usr/share/tesseract-ocr/tessdata"))
            {
                return "/usr/share/tesseract-ocr/tessdata";
            }

            throw new InvalidOperationException("Không tìm thấy thư mục tessdata hợp lệ cho OCR CLI.");
        }

        private void ValidateTessData(string tessDataPath)
        {
            string[] requiredFiles = { "vie.traineddata", "eng.traineddata", "osd.traineddata" };
            foreach (string file in requiredFiles)
            {
                string filePath = Path.Combine(tessDataPath, file);
                if (!File.Exists(filePath))
                {
                    throw new InvalidOperationException($"Thiếu file OCR model bắt buộc: {filePath}");
                }
            }
        }

        private static async Task<string> RunProcessAsync(string fileName, string arguments, CancellationToken cancellationToken)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException($"Không thể khởi tạo tiến trình {fileName}.");
            string stdout = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            string stderr = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            if (process.ExitCode != 0)
            {
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(stderr)
                    ? $"{fileName} trả về exit code {process.ExitCode}."
                    : stderr.Trim());
            }

            return stdout;
        }
    }
}
