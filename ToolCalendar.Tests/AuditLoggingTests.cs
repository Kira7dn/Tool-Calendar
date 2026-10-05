using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using ToolCalendar.Api.Logging;
using ToolCalendar.Api.Middleware;
using ToolCalendar.Core.Data.Interfaces;
using Xunit;

namespace ToolCalendar.Tests
{
    /// <summary>Unit test thuần cho helper làm sạch + chính sách phân loại sự kiện audit.</summary>
    public class AuditLogSanitizerTests
    {
        [Fact]
        public void Clean_ReplacesControlCharacters_PreventsLogInjection()
        {
            var malicious = "/api/x\r\n2026-01-01 AUDIT forged line\tuser=admin";

            var cleaned = AuditLogSanitizer.Clean(malicious);

            cleaned.Should().NotContain("\r").And.NotContain("\n").And.NotContain("\t");
        }

        [Fact]
        public void Clean_TruncatesToMaxLength()
        {
            AuditLogSanitizer.Clean(new string('a', 1000), 50).Length.Should().Be(50);
        }

        [Fact]
        public void Clean_NullOrEmpty_ReturnsEmpty()
        {
            AuditLogSanitizer.Clean(null).Should().BeEmpty();
            AuditLogSanitizer.Clean("").Should().BeEmpty();
        }

        [Theory]
        [InlineData("?access_token=abc123&x=1", "?access_token=***&x=1")]
        [InlineData("?page=2&password=P@ssw0rd", "?page=2&password=***")]
        [InlineData("?token=a&refresh_token=b", "?token=***&refresh_token=***")]
        [InlineData("?page=2&size=20", "?page=2&size=20")]
        public void RedactQuery_MasksSensitiveParameters(string input, string expected)
        {
            AuditLogSanitizer.RedactQuery(input).Should().Be(expected);
        }
    }

    public class AuditEventPolicyTests
    {
        [Theory]
        [InlineData("GET", "/health", 200)]
        [InlineData("GET", "/assets/index-abc.js", 200)]
        [InlineData("GET", "/", 200)]
        [InlineData("GET", "/documents/12", 200)] // route SPA, trả index.html
        public void Evaluate_NoiseRequests_AreSkipped(string method, string path, int status)
        {
            AuditEventPolicy.Evaluate(method, path, status).WriteToFile.Should().BeFalse();
        }

        [Fact]
        public void Evaluate_PostOnApi_IsDataChange_PersistedToDb()
        {
            var d = AuditEventPolicy.Evaluate("POST", "/api/users", 200);

            d.Category.Should().Be(AuditCategory.DataChange);
            d.WriteToFile.Should().BeTrue();
            d.PersistToDb.Should().BeTrue();
            d.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public void Evaluate_PlainGetOnApi_FileOnly_NotDb()
        {
            var d = AuditEventPolicy.Evaluate("GET", "/api/documents", 200);

            d.WriteToFile.Should().BeTrue();
            d.PersistToDb.Should().BeFalse();
        }

        [Theory]
        [InlineData("/api/documents/5/file")]
        [InlineData("/api/admin/audit-logs")]
        [InlineData("/api/backup/download")]
        public void Evaluate_SensitiveGet_IsPersistedToDb(string path)
        {
            var d = AuditEventPolicy.Evaluate("GET", path, 200);

            d.Category.Should().Be(AuditCategory.SensitiveAccess);
            d.PersistToDb.Should().BeTrue();
        }

        [Theory]
        [InlineData(401, AuditCategory.AccessDenied)]
        [InlineData(403, AuditCategory.AccessDenied)]
        public void Evaluate_Denied_IsWarning_AndFailure(int status, AuditCategory expected)
        {
            var d = AuditEventPolicy.Evaluate("GET", "/api/users", status);

            d.Category.Should().Be(expected);
            d.Level.Should().Be(LogLevel.Warning);
            d.IsSuccess.Should().BeFalse();
            d.PersistToDb.Should().BeTrue();
        }

        [Fact]
        public void Evaluate_FailedLogin_NotDuplicatedIntoAuditLogs()
        {
            // LoginAuditLog đã ghi riêng → AuditLogs không lặp, nhưng file audit vẫn ghi
            var d = AuditEventPolicy.Evaluate("POST", "/api/auth/login", 401);

            d.WriteToFile.Should().BeTrue();
            d.PersistToDb.Should().BeFalse();
        }

        [Fact]
        public void Evaluate_RateLimitedLogin_IsPersisted()
        {
            var d = AuditEventPolicy.Evaluate("POST", "/api/auth/login", 429);

            d.Category.Should().Be(AuditCategory.RateLimited);
            d.PersistToDb.Should().BeTrue();
        }

        [Theory]
        [InlineData("/.env")]
        [InlineData("/wp-login.php")]
        [InlineData("/api/does-not-exist")]
        public void Evaluate_NotFound_IsProbe_FileOnly(string path)
        {
            var d = AuditEventPolicy.Evaluate("GET", path, 404);

            d.Category.Should().Be(AuditCategory.Probe);
            d.Level.Should().Be(LogLevel.Warning);
            d.WriteToFile.Should().BeTrue();
            d.PersistToDb.Should().BeFalse();
        }

        [Fact]
        public void Evaluate_ServerError_IsErrorLevel()
        {
            var d = AuditEventPolicy.Evaluate("PUT", "/api/documents/1", 500);

            d.Category.Should().Be(AuditCategory.ServerError);
            d.Level.Should().Be(LogLevel.Error);
            d.PersistToDb.Should().BeTrue();
        }
    }

    /// <summary>
    /// Kiểm tra middleware độc lập (TestServer + repository giả) — không phụ thuộc DB/đăng nhập thật.
    /// </summary>
    public class AuditTrailMiddlewareTests
    {
        private sealed class CapturingLoggerProvider : ILoggerProvider
        {
            public List<(string Category, LogLevel Level, string Message)> Entries { get; } = new();
            public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, Entries);
            public void Dispose() { }

            private sealed class CapturingLogger : ILogger
            {
                private readonly string _category;
                private readonly List<(string, LogLevel, string)> _entries;
                public CapturingLogger(string category, List<(string, LogLevel, string)> entries) { _category = category; _entries = entries; }
                public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
                public bool IsEnabled(LogLevel logLevel) => true;
                public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
                {
                    lock (_entries) _entries.Add((_category, logLevel, formatter(state, exception)));
                }
            }
        }

        private static async Task<IHost> StartHostAsync(
            CapturingLoggerProvider logs, Mock<IAuditLogRepository> repo, RequestDelegate terminal)
        {
            return await new HostBuilder()
                .ConfigureWebHost(web => web
                    .UseTestServer()
                    .ConfigureServices(s =>
                    {
                        s.AddSingleton(repo.Object);
                        s.AddLogging(b => b.AddProvider(logs));
                    })
                    .Configure(app =>
                    {
                        app.UseMiddleware<AuditTrailMiddleware>();
                        app.Run(terminal);
                    }))
                .StartAsync();
        }

        private static string[] AuditMessages(CapturingLoggerProvider logs) =>
            logs.Entries.Where(e => e.Category == AuditLogChannel.Name).Select(e => e.Message).ToArray();

        private static async Task WaitUntilAsync(Func<bool> condition)
        {
            for (int i = 0; i < 50 && !condition(); i++) await Task.Delay(50);
        }

        [Fact]
        public async Task Post_WritesAuditLine_AndPersistsEventToDb()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            using var host = await StartHostAsync(logs, repo, ctx => Task.CompletedTask);

            var req = new HttpRequestMessage(HttpMethod.Post, "/api/users?token=SUPERSECRET");
            req.Headers.Add("X-Correlation-ID", "cid-123");
            req.Headers.UserAgent.ParseAdd("UnitTestAgent/1.0");
            var res = await host.GetTestClient().SendAsync(req);
            res.EnsureSuccessStatusCode();

            var lines = AuditMessages(logs);
            lines.Should().ContainSingle();
            lines[0].Should().Contain("DataChange").And.Contain("POST").And.Contain("/api/users");
            lines[0].Should().Contain("token=***").And.NotContain("SUPERSECRET");
            lines[0].Should().Contain("UnitTestAgent/1.0");

            await WaitUntilAsync(() => repo.Invocations.Count > 0);
            repo.Verify(r => r.InsertAuditEventAsync(
                It.IsAny<int?>(), It.Is<string>(a => a.Contains("POST") && a.Contains("/api/users")),
                It.IsAny<string?>(), "UnitTestAgent/1.0", true, null), Times.Once);
        }

        [Fact]
        public async Task PlainGet_WritesFileOnly_NoDbWrite()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            using var host = await StartHostAsync(logs, repo, ctx => Task.CompletedTask);

            (await host.GetTestClient().GetAsync("/api/documents")).EnsureSuccessStatusCode();
            await Task.Delay(200);

            AuditMessages(logs).Should().ContainSingle().Which.Should().Contain("Access");
            repo.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task Forbidden_IsLoggedAsWarning_AndPersistedAsFailure()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            using var host = await StartHostAsync(logs, repo, ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; });

            var res = await host.GetTestClient().GetAsync("/api/admin/clear-audit-logs");
            res.StatusCode.Should().Be(System.Net.HttpStatusCode.Forbidden);

            var entry = logs.Entries.Single(e => e.Category == AuditLogChannel.Name);
            entry.Level.Should().Be(LogLevel.Warning);
            entry.Message.Should().Contain("AccessDenied").And.Contain("403");

            await WaitUntilAsync(() => repo.Invocations.Count > 0);
            repo.Verify(r => r.InsertAuditEventAsync(
                It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(),
                false, It.Is<string?>(f => f != null && f.Contains("AccessDenied"))), Times.Once);
        }

        [Fact]
        public async Task Exception_IsLoggedAs500_AndRethrown()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            using var host = await StartHostAsync(logs, repo, ctx => throw new InvalidOperationException("boom"));

            Func<Task> act = () => host.GetTestClient().PostAsync("/api/documents", new StringContent(""));
            await act.Should().ThrowAsync<InvalidOperationException>();

            var entry = logs.Entries.Single(e => e.Category == AuditLogChannel.Name);
            entry.Level.Should().Be(LogLevel.Error);
            entry.Message.Should().Contain("ServerError").And.Contain("500");
        }

        [Fact]
        public async Task ScannerProbe_On404_IsLoggedAsProbe()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            using var host = await StartHostAsync(logs, repo, ctx => { ctx.Response.StatusCode = 404; return Task.CompletedTask; });

            await host.GetTestClient().GetAsync("/.env");

            var entry = logs.Entries.Single(e => e.Category == AuditLogChannel.Name);
            entry.Level.Should().Be(LogLevel.Warning);
            entry.Message.Should().Contain("Probe").And.Contain("/.env");
        }

        [Fact]
        public async Task RepositoryFailure_NeverBreaksTheRequest()
        {
            var logs = new CapturingLoggerProvider();
            var repo = new Mock<IAuditLogRepository>();
            repo.Setup(r => r.InsertAuditEventAsync(It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>())).ThrowsAsync(new Exception("db down"));
            using var host = await StartHostAsync(logs, repo, ctx => Task.CompletedTask);

            var res = await host.GetTestClient().PostAsync("/api/users", new StringContent(""));

            res.EnsureSuccessStatusCode();
        }

        [Fact]
        public void ResolveLogDirectory_UsesLogDirEnv_ThenDbPathDir_ThenContentRoot()
        {
            var oldLog = Environment.GetEnvironmentVariable("LOG_DIR");
            var oldDb = Environment.GetEnvironmentVariable("DB_PATH");
            try
            {
                Environment.SetEnvironmentVariable("LOG_DIR", null);
                Environment.SetEnvironmentVariable("DB_PATH", "/app/data/documents.db");
                SerilogSetup.ResolveLogDirectory("/root").Should().Be(Path.Combine("/app/data", "logs"));

                Environment.SetEnvironmentVariable("LOG_DIR", "/var/log/tc");
                SerilogSetup.ResolveLogDirectory("/root").Should().Be("/var/log/tc");

                Environment.SetEnvironmentVariable("LOG_DIR", null);
                Environment.SetEnvironmentVariable("DB_PATH", null);
                SerilogSetup.ResolveLogDirectory("/root").Should().Be(Path.Combine("/root", "logs"));
            }
            finally
            {
                Environment.SetEnvironmentVariable("LOG_DIR", oldLog);
                Environment.SetEnvironmentVariable("DB_PATH", oldDb);
            }
        }
    }
}
