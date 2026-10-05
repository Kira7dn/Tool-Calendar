using Serilog;
using Serilog.Events;
using Serilog.Filters;
using Serilog.Formatting.Compact;

namespace ToolCalendar.Api.Logging;

/// <summary>Tên kênh (SourceContext) dành riêng cho nhật ký audit.</summary>
public static class AuditLogChannel
{
    public const string Name = "Audit";
}

/// <summary>
/// Cấu hình Serilog chuẩn doanh nghiệp:
///   - Console: mọi log (xem bằng `docker logs`, Docker json-file đã rotate 10MB x 3).
///   - logs/app-YYYYMMDD.log: log ứng dụng dạng text, lưu 90 ngày.
///   - logs/audit-YYYYMMDD.jsonl: nhật ký audit dạng JSON (SIEM-ready), lưu 365 ngày.
/// Thư mục log: env LOG_DIR → &lt;thư mục chứa DB_PATH&gt;/logs → &lt;ContentRoot&gt;/logs.
/// Thời gian ghi kèm múi giờ (offset) theo TZ của container (Asia/Ho_Chi_Minh).
/// </summary>
public static class SerilogSetup
{
    public const int DefaultAppRetentionDays = 90;
    public const int DefaultAuditRetentionDays = 365;

    public static string ResolveLogDirectory(string contentRoot)
    {
        var explicitDir = Environment.GetEnvironmentVariable("LOG_DIR");
        if (!string.IsNullOrWhiteSpace(explicitDir)) return explicitDir;

        var dbPath = Environment.GetEnvironmentVariable("DB_PATH");
        if (!string.IsNullOrWhiteSpace(dbPath))
        {
            var dbDir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dbDir)) return Path.Combine(dbDir, "logs");
        }
        return Path.Combine(contentRoot, "logs");
    }

    public static void Configure(HostBuilderContext context, IServiceProvider services, LoggerConfiguration config)
    {
        var logDir = ResolveLogDirectory(context.HostingEnvironment.ContentRootPath);
        var appRetention = context.Configuration.GetValue("Logging:AppRetentionDays", DefaultAppRetentionDays);
        var auditRetention = context.Configuration.GetValue("Logging:AuditRetentionDays", DefaultAuditRetentionDays);

        config
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.AspNetCore.Hosting.Diagnostics", LogEventLevel.Warning)
            .MinimumLevel.Override("System.Net.Http.HttpClient", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", "ToolCalendar")
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
            // Log ứng dụng (không chứa kênh Audit để tách bạch)
            .WriteTo.Logger(lc => lc
                .Filter.ByExcluding(Matching.FromSource(AuditLogChannel.Name))
                .WriteTo.File(
                    Path.Combine(logDir, "app-.log"),
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: appRetention,
                    outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}",
                    shared: false))
            // Nhật ký audit: JSON từng dòng, mỗi dòng 1 sự kiện
            .WriteTo.Logger(lc => lc
                .Filter.ByIncludingOnly(Matching.FromSource(AuditLogChannel.Name))
                .WriteTo.File(
                    new RenderedCompactJsonFormatter(),
                    Path.Combine(logDir, "audit-.jsonl"),
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: auditRetention,
                    shared: false));
    }
}
