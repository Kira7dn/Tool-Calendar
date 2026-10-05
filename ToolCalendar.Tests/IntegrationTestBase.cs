using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ToolCalendar.Tests.Helpers;

namespace ToolCalendar.Tests
{
    public class IntegrationTestBase : IDisposable
    {
        protected readonly WebApplicationFactory<Program> Factory;
        protected readonly HttpClient Client;
        protected readonly string DbPath;

        public IntegrationTestBase()
        {
            // 1. Tạo file DB tạm cho mỗi test session cốt để cô lập dữ liệu
            DbPath = Path.Combine(Path.GetTempPath(), $"test_docs_{Guid.NewGuid()}.db");
            Environment.SetEnvironmentVariable("DB_PATH", DbPath);
            Environment.SetEnvironmentVariable("JWT_SECRET", "this_is_a_very_long_jwt_secret_key_for_testing_purposes_only");

            // 2. Khởi tạo Database Schema & Seed data bằng cách chạy thẳng seed_db.sql
            var projectRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", ".."));
            var seedSqlPath = Path.Combine(projectRoot, "seed_db.sql");
            var script = File.ReadAllText(seedSqlPath);

            using var connection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={DbPath}");
            connection.Open();
            using var cmd = new Microsoft.Data.Sqlite.SqliteCommand(script, connection);
            cmd.ExecuteNonQuery();

            // Set password of admin to admin@123456 to match BusinessFlowTests
            var hash = BCrypt.Net.BCrypt.HashPassword("admin@123456");
            using var updateCmd = new Microsoft.Data.Sqlite.SqliteCommand("UPDATE Users SET PasswordHash = @hash WHERE Username = 'admin'", connection);
            updateCmd.Parameters.AddWithValue("@hash", hash);
            updateCmd.ExecuteNonQuery();
            
            // Wait, we need to create the table since it's only created later by DatabaseService
            using var createUiCmd = new Microsoft.Data.Sqlite.SqliteCommand(@"
                CREATE TABLE IF NOT EXISTS UserIdentities (
                    UserId INTEGER NOT NULL,
                    Provider TEXT NOT NULL,
                    ProviderKey TEXT,
                    PasswordHash TEXT,
                    PRIMARY KEY (UserId, Provider)
                )", connection);
            createUiCmd.ExecuteNonQuery();

            // Insert identity for admin
            using var insertUiCmd = new Microsoft.Data.Sqlite.SqliteCommand(@"
                INSERT OR REPLACE INTO UserIdentities (UserId, Provider, PasswordHash) 
                SELECT Id, 'local', @hash FROM Users WHERE Username = 'admin'
            ", connection);
            insertUiCmd.Parameters.AddWithValue("@hash", hash);
            insertUiCmd.ExecuteNonQuery();

            // 3. Khởi chạy WebApplicationFactory
            Factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.ConfigureAppConfiguration((context, config) =>
                    {
                        // Ghi đè đường dẫn Tesseract để test chạy đúng
                        var configData = new Dictionary<string, string?> {
                            {"OcrSettings:TessDataPath", TestPathHelper.GetCoreTessdataPath()},
                            {"OcrSettings:Language", "vie+eng"}
                        };
                        config.AddInMemoryCollection(configData);
                    });
                    
                    builder.ConfigureServices(services =>
                    {
                        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ToolCalendar.Services.Security.IClamAvService));
                        if (descriptor != null) services.Remove(descriptor);
                        services.AddSingleton<ToolCalendar.Services.Security.IClamAvService, MockClamAvService>();

                        var aiDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ToolCalendar.Services.IPythonAiService));
                        if (aiDescriptor != null) services.Remove(aiDescriptor);
                        services.AddSingleton<ToolCalendar.Services.IPythonAiService, MockPythonAiService>();

                        var ocrDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ToolCalendar.Services.IOcrQueueService));
                        if (ocrDescriptor != null) services.Remove(ocrDescriptor);
                        services.AddSingleton<ToolCalendar.Services.IOcrQueueService, MockOcrQueueService>();
                    });
                });

            Client = Factory.CreateClient();
        }

        protected async Task AuthenticateAsync(string username, string password)
        {
            var response = await Client.PostAsJsonAsync("/api/auth/login", new { Username = username, Password = password });
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new Exception($"Login failed with status {response.StatusCode}: {errorContent}");
            }

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("data", out var dataElement) && dataElement.TryGetProperty("token", out var tokenElement))
            {
                var token = tokenElement.GetString();
                Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
                
                // --- Xử lý CSRF cho các test POST/PUT/DELETE ---
                // Fake 1 GET request để lấy cookie csrf_token
                var getResponse = await Client.GetAsync("/api/auth/me");
                if (getResponse.Headers.TryGetValues("Set-Cookie", out var setCookies))
                {
                    var csrfCookie = setCookies.FirstOrDefault(c => c.StartsWith("csrf_token="));
                    if (!string.IsNullOrEmpty(csrfCookie))
                    {
                        var prefix = "csrf_token=";
                        var csrfToken = csrfCookie.Split(';')[0].Substring(prefix.Length);
                        // Add header required by CsrfMiddleware
                        if (Client.DefaultRequestHeaders.Contains("X-CSRF-Token"))
                            Client.DefaultRequestHeaders.Remove("X-CSRF-Token");
                        Client.DefaultRequestHeaders.Add("X-CSRF-Token", csrfToken);
                        
                        // We also need to add the cookie to subsequent requests.
                        // HttpClient by default doesn't persist cookies unless we configure a CookieContainer,
                        // but setting the Cookie header works for tests.
                        if (Client.DefaultRequestHeaders.Contains("Cookie"))
                            Client.DefaultRequestHeaders.Remove("Cookie");
                        Client.DefaultRequestHeaders.Add("Cookie", $"csrf_token={csrfToken}");
                    }
                }
            }
            else
            {
                throw new Exception($"Could not parse token from login response: {content}");
            }
        }

        protected async Task CreateUserAsync(string username, string password, string role)
        {
            using var scope = Factory.Services.CreateScope();
            var userRepo = scope.ServiceProvider.GetRequiredService<ToolCalendar.Core.Data.Interfaces.IUserRepository>();
            await userRepo.RegisterAsync(username, password, role);
        }

        public virtual void Dispose()
        {
            Client.Dispose();
            Factory.Dispose();

            // Dọn dẹp DB tạm
            if (File.Exists(DbPath))
            {
                try { File.Delete(DbPath); } catch { /* Ignore */ }
            }
        }
    }

    public class MockClamAvService : ToolCalendar.Services.Security.IClamAvService
    {
        public Task<ToolCalendar.Services.Security.ClamAvScanResult> ScanFileAsync(string filePath, CancellationToken ct = default)
        {
            return Task.FromResult(ToolCalendar.Services.Security.ClamAvScanResult.Clean);
        }
    }
    public class MockPythonAiService : ToolCalendar.Services.IPythonAiService
    {
        public Task<ToolCalendar.Services.DoclingExtractionResult> ExtractDocumentAsync(string filePath) => throw new NotImplementedException();
        public Task<string> ExtractFastTextAsync(string filePath) => Task.FromResult("Văn bản 888/GP-2026");
        public Task<ToolCalendar.Services.ChunkResponse> ChunkDocumentAsync(ToolCalendar.Services.ChunkRequest request) => throw new NotImplementedException();
        public Task<ToolCalendar.Services.BatchEmbedResponse> BatchEmbedAsync(ToolCalendar.Services.BatchEmbedRequest request) => throw new NotImplementedException();
        public Task<ToolCalendar.Services.GenerateQAResponse> GenerateQAAsync(ToolCalendar.Services.GenerateQARequest request) => throw new NotImplementedException();
        public Task<ToolCalendar.Services.HyDEResponse?> HyDEAsync(string question, string model = "qwen2.5:3b") => throw new NotImplementedException();
        public Task<ToolCalendar.Services.DocSummaryResult?> DocSummaryAsync(string text, string docTitle, string model = "qwen2.5:3b") => throw new NotImplementedException();
        public Task<ToolCalendar.Services.ContextualChunkResult?> ContextualChunkAsync(string chunkText, string docTitle, string docSummary, string model = "qwen2.5:3b") => throw new NotImplementedException();
        public Task<ToolCalendar.Services.DocumentMetadataResult?> ExtractMetadataAsync(string text, List<string> deadlineKeywords, List<string> excludeKeywords, string model = "qwen2.5:3b")
        {
            return Task.FromResult<ToolCalendar.Services.DocumentMetadataResult?>(new ToolCalendar.Services.DocumentMetadataResult
            {
                SoVanBan = "888/GP-2026",
                ThoiHan = DateTime.Now.AddDays(7).ToString("yyyy-MM-dd"),
                TrichYeu = "Trích yếu giả lập"
            });
        }
    }

    public class MockOcrQueueService : ToolCalendar.Services.IOcrQueueService
    {
        private readonly IServiceProvider _sp;
        public MockOcrQueueService(IServiceProvider sp) { _sp = sp; }
        public int PendingCount => 0;

        public async ValueTask EnqueueAsync(int documentId)
        {
            using var scope = _sp.CreateScope();
            var docRepo = scope.ServiceProvider.GetRequiredService<ToolCalendar.Core.Data.Interfaces.IDocumentRepository>();
            var doc = await docRepo.GetDocumentByIdAsync(documentId);
            if (doc != null)
            {
                doc.Status = "Chưa xử lý";
                doc.SoVanBan = "888/GP-2026";
                doc.TenCongVan = "Tên công văn giả lập";
                doc.TrichYeu = "Trích yếu giả lập";
                doc.ThoiHan = DateTime.Now.AddDays(7);
                await docRepo.UpdateAsync(doc);
            }
        }
    }
}
