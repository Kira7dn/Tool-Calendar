using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ToolCalendar.Data;
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
            
            // Set password of admin to admin123
            using var updateCmd = new Microsoft.Data.Sqlite.SqliteCommand("UPDATE Users SET PasswordHash = @hash WHERE Username = 'admin'", connection);
            updateCmd.Parameters.AddWithValue("@hash", BCrypt.Net.BCrypt.HashPassword("admin123"));
            updateCmd.ExecuteNonQuery();

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
            }
            else
            {
                throw new Exception($"Could not parse token from login response: {content}");
            }
        }

        protected void CreateUser(string username, string password, string role)
        {
            using var scope = Factory.Services.CreateScope();
            var userRepo = scope.ServiceProvider.GetRequiredService<ToolCalendar.Core.Data.Interfaces.IUserRepository>();
            userRepo.Register(username, password, role);
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
}
