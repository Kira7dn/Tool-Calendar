using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using ToolCalender.Data;
using ToolCalender.Models;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests
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

            // 2. Khởi tạo Database Schema & Seed data (Admin mặc định)
            DatabaseService.Initialize();

            // 3. Khởi chạy WebApplicationFactory
            Factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.ConfigureAppConfiguration((context, config) =>
                    {
                        // Ghi đè đường dẫn Tesseract để test chạy đúng
                        var configData = new Dictionary<string, string?> {
                            {"OcrSettings:TessDataPath", @"d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata"},
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
            response.EnsureSuccessStatusCode();
            
            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(content);
            var token = doc.RootElement.GetProperty("token").GetString();
            
            Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        protected void CreateUser(string username, string password, string role)
        {
            DatabaseService.Register(username, password, role);
        }

        public void Dispose()
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
