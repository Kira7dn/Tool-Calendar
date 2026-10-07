using Serilog;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using ToolCalendar.Api.Security;          // ✅ CustomUserStore, HybridPasswordHasher
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Services;
using ToolCalendar.Core.Services.AiTools;
using ToolCalendar.Core.Services.Security; // ✅ ITokenBlacklistService

using ToolCalendar.Data;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Services;
using System.Threading.RateLimiting;
using ToolCalendar.Middleware;   // ✅ FileAccessSecurityMiddleware
using ToolCalendar.Policies;    // ✅ AppPolicies (phân quyền tập trung)
using ToolCalendar.Services.Security; // ✅ ClamAvService, BackupService, HmacRequestHandler
using Microsoft.Extensions.Caching.Memory; // ✅ IMemoryCache extension methods
using ToolCalendar.Api.Middleware;          // ✅ CorrelationIdMiddleware
using ToolCalendar.Api.Services.Security;   // ✅ TokenBlacklistService
using ToolCalendar.Api.Logging;             // ✅ SerilogSetup, AuditLogChannel

var builder = WebApplication.CreateBuilder(args);

// ✅ Logging doanh nghiệp: Serilog → console + app log (90 ngày) + audit log JSON (365 ngày)
builder.Host.UseSerilog(SerilogSetup.Configure);

// Cấu hình vô hiệu hoá hoàn toàn giới hạn kích thước tệp tải lên (Dùng cho các file PDF siêu nặng > 100MB)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = null; // Unlimited
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 536870912; // 500 MB
    options.ValueLengthLimit = 536870912; // 500 MB
});

// 1. Cấu hình dịch vụ
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache(); // ✅ Dashboard stats caching
builder.Services.AddHealthChecks(); // ✅ Thêm HealthChecks cho Docker Monitoring

// ✅ JTI Blacklist — singleton vì IMemoryCache là singleton
builder.Services.AddSingleton<ITokenBlacklistService, TokenBlacklistService>();

// Đăng ký SignalR
builder.Services.AddSignalR();

// Cấu hình Rate Limiting để chống tấn công DoS/Spam
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Policy chung toàn hệ thống: 50 request / 10 giây / IP
    options.AddPolicy("fixed", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? httpContext.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 50,
                QueueLimit = 0,
                Window = TimeSpan.FromSeconds(10)
            }));

    // Policy STRICT cho Login: tối đa 20 lần thử / 60 giây / mỗi IP → chống Brute Force
    options.AddPolicy("login-policy", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: partition => new SlidingWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 20,
                SegmentsPerWindow = 6,
                QueueLimit = 0,
                Window = TimeSpan.FromSeconds(60)
            }));

    // Policy cho Upload: tối đa 1000 request / 60 giây / mỗi user (Dựa vào User Claim, nếu không có fallback về IP)
    options.AddPolicy("upload-limit", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.Identity?.Name ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 1000,
                QueueLimit = 100, // Cho phép chờ thêm 100 request trong queue
                Window = TimeSpan.FromSeconds(60),
                QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst
            }));
});

// Đăng ký Repositories (Clean Architecture)
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDocumentRepository, DocumentRepository>();
builder.Services.AddScoped<ToolCalendar.Data.Repositories.IDocumentRoutingRepository, ToolCalendar.Data.Repositories.DocumentRoutingRepository>();
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<ISecurityLogRepository, SecurityLogRepository>();


// Refactored Repositories
builder.Services.AddScoped<IStatsRepository, StatsRepository>();
builder.Services.AddScoped<ISettingRepository, SettingRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IReminderRepository, ReminderRepository>();
builder.Services.AddScoped<IChatHistoryRepository, ChatHistoryRepository>();
// OllamaEmbeddingService gọi Python AI Service → phải dùng typed HttpClient với HmacRequestHandler
// Fix lỗi 401 Unauthorized: trước đây dùng AddScoped với HttpClient thường (không có HMAC signature)
builder.Services.AddHttpClient<IOllamaEmbeddingService, OllamaEmbeddingService>(client =>
{
    var pythonAiUrl = builder.Configuration["PythonAiServiceUrl"] ?? "http://python-ai-service:8001";
    client.BaseAddress = new Uri(pythonAiUrl);
    client.Timeout = TimeSpan.FromSeconds(15);
}).AddHttpMessageHandler<HmacRequestHandler>(); // ✅ Tự động ký HMAC-SHA256 → không còn 401
builder.Services.AddScoped<IDocumentChunkRepository, DocumentChunkRepository>();
builder.Services.AddScoped<IUserMemoryRepository, UserMemoryRepository>(); // ANYTHINGLLM Idea #5: Long-Term Memory

// Đăng ký AI Tools (Khoj Architecture)
builder.Services.AddScoped<IAiTool, GetDocumentStatsTool>();
builder.Services.AddScoped<IAiTool, SearchDocumentContentTool>();
builder.Services.AddScoped<IAiTool, SearchDocumentsByConditionTool>();
builder.Services.AddScoped<IAiTool, WebSearchTool>();
builder.Services.AddScoped<IAiTool, ChartGeneratorTool>();
builder.Services.AddScoped<AiToolRegistry>();

builder.Services.AddScoped<IAiAssistantService, AiAssistantService>();
builder.Services.AddScoped<IAiReferenceService, AiReferenceService>();
builder.Services.AddScoped<ISemanticRouterService, SemanticRouterService>();
builder.Services.AddScoped<IAiSemanticCacheRepository, AiSemanticCacheRepository>();


// ✅ ASP.NET Core Identity (Custom UserStore — không cần EF Core)
// Toàn bộ dữ liệu vẫn lưu trong SQLite hiện có, không mất dữ liệu cũ
builder.Services.AddIdentityCore<User>(options =>
{
    // --- Cấu hình mật khẩu (giữ nguyên quy tắc hiện tại) ---
    options.Password.RequiredLength = 8;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireDigit = true;
    options.Password.RequireNonAlphanumeric = true;

    // --- Account Lockout (Identity quản lý thay vì code thủ công) ---
    options.Lockout.MaxFailedAccessAttempts = 5;               // Khóa sau 5 lần sai
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15); // Khóa 15 phút
    options.Lockout.AllowedForNewUsers = true;

    // --- User ---
    options.User.RequireUniqueEmail = false; // Không bắt buộc email duy nhất (hệ thống nội bộ)
})
.AddUserStore<CustomUserStore>()
.AddDefaultTokenProviders(); // Cho phép generate token reset mật khẩu, xác thực email sau này

// Thay thế IPasswordHasher mặc định bằng HybridPasswordHasher
// → tương thích ngược hoàn toàn với mật khẩu BCrypt cũ trong database
builder.Services.AddScoped<IPasswordHasher<User>, HybridPasswordHasher>();

// Đăng ký Upload Service (tách logic upload ra khỏi Controller)
builder.Services.AddScoped<IDocumentUploadService, DocumentUploadService>();

// Cấu hình HTTP Client cho các gọi API bên ngoài (như Gemini)
builder.Services.AddHttpClient();
// Đăng ký Extraction Services & Python AI
builder.Services.AddScoped<ToolCalendar.Core.Services.Integration.ICqdtIntegrationService, ToolCalendar.Core.Services.Integration.CqdtIntegrationService>();
// HmacRequestHandler: tự động ký HMAC-SHA256 + propagate Correlation ID cho mọi request
builder.Services.AddTransient<HmacRequestHandler>();
builder.Services.AddHttpContextAccessor(); // Cần cho HmacRequestHandler đọc Correlation ID
builder.Services.AddHttpClient<IPythonAiService, PythonAiService>(client =>
{
    var pythonAiUrl = builder.Configuration["PythonAiServiceUrl"] ?? "http://python-ai-service:8001";
    client.BaseAddress = new Uri(pythonAiUrl);
    client.Timeout = TimeSpan.FromMinutes(10); // Docling có thể chạy lâu
}).AddHttpMessageHandler<HmacRequestHandler>(); // ✅ Tự động sign mọi request
builder.Services.AddScoped<IDocumentExtractorService, DocumentExtractorService>();

// Cấu hình Hàng đợi OCR xử lý nền
builder.Services.AddSingleton<DocumentProcessingService>();
builder.Services.AddSingleton<IOcrQueueService>(sp => sp.GetRequiredService<DocumentProcessingService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<DocumentProcessingService>());

// Cấu hình Email & Thông báo tự động
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<IVapidService, VapidService>();
builder.Services.AddScoped<INotificationManager, NotificationManager>();
builder.Services.AddSingleton<DeadlineWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<DeadlineWorker>());
builder.Services.AddHostedService<ReminderWorker>();
builder.Services.AddHostedService<ToolCalendar.Api.Services.DraftCleanupWorker>();
builder.Services.AddHostedService<ToolCalendar.Api.Services.AiWarmupWorker>();


// ✅ Security Services
builder.Services.AddSingleton<IClamAvService, ClamAvService>();  // Virus scanning
builder.Services.AddHostedService<BackupService>();               // Auto DB backup mỗi 6h

// ✅ Quản lý Khóa RSA cho JWT Bất đối xứng (Asymmetric JWT)
var rsaKeyManager = new ToolCalendar.Core.Services.Security.RsaKeyManager();
builder.Services.AddSingleton(rsaKeyManager);

// Cấu hình JWT - Đã chuyển sang dùng RS256 thay cho HS256
builder.Services.AddAuthentication(x =>
{
    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(x =>
{
    x.RequireHttpsMetadata = !builder.Environment.IsDevelopment(); // ✅ true trong Production, false chỉ ở Development
    x.SaveToken = true;
    x.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = rsaKeyManager.GetKey(),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero // Hết hạn là hết hạn ngay
    };
    x.Events = new JwtBearerEvents
    {
        // ✅ Chỉ cho phép query string "access_token" cho SignalR Hub
        // Các endpoint file PDF/Evidence BẮT BUỘC phải dùng Authorization header
        // để ngăn việc nhúng token vào URL và share cho người khác
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            // 1. Chỉ SignalR mới được dùng query string auth
            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/notificationHub"))
            {
                context.Token = accessToken;
            }
            // Cho phép PDF viewer lấy token qua query string
            else if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/documents") && path.Value.EndsWith("/file"))
            {
                context.Token = accessToken;
            }
            // 2. Đọc token từ Authorization header (Bearer token từ localStorage frontend)
            else if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                var bearerToken = authHeader.FirstOrDefault();
                if (!string.IsNullOrEmpty(bearerToken) && bearerToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    context.Token = bearerToken["Bearer ".Length..].Trim();
                }
            }
            // 3. Đọc token từ HttpOnly Cookie (jwt_cookie) do AuthController set lúc Login
            // Giúp mở file PDF an toàn bằng iframe/window.open không cần token trên URL
            else if (context.Request.Cookies.TryGetValue("jwt_cookie", out var cookieToken))
            {
                context.Token = cookieToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            try
            {
                // Chỉ log chi tiết claims trong môi trường Development để tránh lộ thông tin nhạy cảm ra production logs
                if (builder.Environment.IsDevelopment())
                {
                    var claims = context.Principal?.Claims.Select(c => $"{c.Type}:{c.Value}");
                    Console.WriteLine($"[AuthDebug] Kiểm tra token cho User: {context.Principal?.Identity?.Name}. Claims: {string.Join(", ", claims ?? Array.Empty<string>())}");
                }

                // Kiểm tra JTI blacklist trước tiên — token đã logout thì từ chối ngay lập tức
                var jtiClaim = context.Principal?.FindFirst("jti")?.Value
                            ?? context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
                if (!string.IsNullOrEmpty(jtiClaim))
                {
                    var blacklist = context.HttpContext.RequestServices.GetRequiredService<ITokenBlacklistService>();
                    if (blacklist.IsBlacklisted(jtiClaim))
                    {
                        context.Fail("Token đã bị thu hồi. Vui lòng đăng nhập lại.");
                        return;
                    }
                }

                var userIdStr = context.Principal?.FindFirst("uid")?.Value
                              ?? context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? context.Principal?.FindFirst("UserId")?.Value;

                var sessionId = context.Principal?.FindFirst("sid")?.Value;

                if (string.IsNullOrEmpty(userIdStr))
                {
                    Console.WriteLine("[AuthWarning] Thiếu UserId/uid claim trong token.");
                    return;
                }

                if (int.TryParse(userIdStr, out int userId))
                {
                    var cache = context.HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                    var cacheKey = $"UserSession_{userId}";

                    var cachedSecStamp = cache.Get<string>(cacheKey);
                    if (string.IsNullOrEmpty(cachedSecStamp))
                    {
                        var userRepo = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                        var user = await userRepo.GetUserByIdAsync(userId);
                        if (user == null)
                        {
                            LogAuthEvent(context.HttpContext, $"Không tìm thấy User ID {userId} trong cơ sở dữ liệu (token hợp lệ nhưng tài khoản đã bị xóa).");
                            context.Fail("Tài khoản không tồn tại.");
                            return;
                        }

                        // Ưu tiên kiểm tra SecurityStamp (Identity) trước, fallback về SessionId cũ
                        cachedSecStamp = user.SecurityStamp ?? user.SessionId ?? string.Empty;
                        // Cache 2 phút để giảm tải truy vấn DB
                        cache.Set(cacheKey, cachedSecStamp, TimeSpan.FromMinutes(2));
                    }

                    // Kiểm tra security stamp từ token
                    var tokenStamp = context.Principal?.FindFirst("sec_stamp")?.Value
                                  ?? context.Principal?.FindFirst("sid")?.Value; // fallback token cũ

                    if (!string.IsNullOrEmpty(tokenStamp) && cachedSecStamp != tokenStamp)
                    {
                        LogAuthEvent(context.HttpContext, $"SecurityStamp không khớp cho User ID {userId} → phiên bị vô hiệu hóa (đăng nhập nơi khác hoặc đổi mật khẩu).");
                        context.Fail("Phiên đăng nhập đã hết hạn hoặc tài khoản đã đăng nhập ở nơi khác.");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AuthFatalError] {ex.Message}\n{ex.StackTrace}");
            }
            return;
        },
        OnChallenge = context =>
        {
            var accept = context.Request.Headers["Accept"].ToString();
            var path = context.Request.Path.Value ?? "";

            // Nếu người dùng mở URL trực tiếp trên trình duyệt (Accept: text/html)
            // Thay vì hiện màn hình lỗi 401 mặc định, redirect về trang chủ để báo lỗi thân thiện
            if (accept.Contains("text/html") && path.StartsWith("/api/documents") && path.EndsWith("/file"))
            {
                context.HandleResponse(); // Ngăn chặn response 401 mặc định
                context.Response.Redirect("/?error=unauthorized");
            }
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
            {
                context.Response.Headers.Add("Token-Expired", "true");
            }
            LogAuthEvent(context.HttpContext, $"Xác thực JWT thất bại: {context.Exception.GetType().Name}");
            return Task.CompletedTask;
        },
        OnForbidden = context =>
        {
            var accept = context.Request.Headers["Accept"].ToString();
            var path = context.Request.Path.Value ?? "";

            if (accept.Contains("text/html") && path.StartsWith("/api/documents") && path.EndsWith("/file"))
            {
                context.Response.Redirect("/?error=forbidden");
            }
            return Task.CompletedTask;
        }
    };
});

// ✅ Đăng ký Authorization Policies tập trung (phân quyền theo Role + Session)
builder.Services.AddAppAuthorizationPolicies();


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy
            // Cho phép: localhost (dev) và IP LAN nội bộ
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                var uri = new Uri(origin);
                return
                    uri.Host == "localhost" ||
                    uri.Host == "127.0.0.1" ||
                    uri.Host.StartsWith("192.168."); // LAN nội bộ
            })
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .WithHeaders("Authorization", "Content-Type", "Accept", "Origin", "User-Agent", "X-Requested-With", "x-hub-protocol", "x-signalr-user-agent")
            .AllowCredentials());
});

var app = builder.Build();

app.UseMiddleware<ToolCalendar.Api.Middleware.GlobalExceptionMiddleware>();

// ✅ Correlation ID — phải đăng ký đầu tiên để mọi middleware sau đều có thể dùng
app.UseMiddleware<CorrelationIdMiddleware>();

// Cấu hình để nhận diện HTTPS từ Nginx Proxy
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedOptions.KnownNetworks.Clear(); // Tin tưởng mọi mạng (cần thiết cho Nginx proxy)
forwardedOptions.KnownProxies.Clear();   // Tin tưởng mọi proxy
app.UseForwardedHeaders(forwardedOptions);

// ✅ Audit Trail — đặt SAU ForwardedHeaders (có IP thật) và TRƯỚC Authentication (bắt cả 401/403/429)
app.UseMiddleware<AuditTrailMiddleware>();

// 2. Khởi tạo Database
DatabaseService.Initialize();

// 3. Pipeline xử lý request
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ SECURITY MIDDLEWARE: Chặn toàn bộ truy cập trực tiếp vào /Uploads/*
// Phải đặt TRƯỚC UseAuthentication để block request sớm nhất có thể
app.UseFileAccessSecurity();

app.UseCors("AllowAll");
app.UseRateLimiter(); // Kích hoạt Rate Limiting
app.UseWebSockets();


// Middleware chống cache cho HTML (index.html) để đảm bảo luôn tải JS mới nhất
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        if (context.Response.ContentType?.StartsWith("text/html") == true)
        {
            context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["Expires"] = "0";
        }
        return Task.CompletedTask;
    });
    await next();
});

// Serve static files (chỉ wwwroot - giao diện web, KHÔNG phải Uploads)
app.UseDefaultFiles();
app.UseStaticFiles();

// ⚠️  KHÔNG serve thư mục /Uploads qua static files!
// Tất cả file PDF/Evidence phải đi qua API có xác thực JWT.
// Xem: GET /api/documents/{id}/file (yêu cầu Bearer Token)
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "Uploads");
if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);

app.UseAuthentication();
app.UseAuthorization();
// ✅ CSRF Protection: kiểm tra X-CSRF-Token header cho mọi mutating request có auth
// Phải đặt SAU UseAuthorization() để biết request đã authenticated chưa
app.UseCsrfProtection();
// Áp dụng Rate Limiter "fixed" làm mặc định cho tất cả Controllers và Hub
app.MapControllers().RequireRateLimiting("fixed");
app.MapHub<NotificationHub>("/notificationHub").RequireRateLimiting("fixed");
app.MapHealthChecks("/health"); // ✅ Endpoint healthcheck cho Docker
app.MapGet("/.well-known/jwks.json", (ToolCalendar.Core.Services.Security.RsaKeyManager keyManager) =>
{
    return Results.Ok(keyManager.GetJwks());
}).AllowAnonymous();
app.MapFallbackToFile("index.html");

// Chạy ứng dụng
app.Run();

// Ghi sự kiện xác thực bất thường vào kênh Audit (kèm IP + CorrelationId, đã làm sạch chống log injection)
static void LogAuthEvent(HttpContext httpContext, string message)
{
    var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(AuditLogChannel.Name);
    var address = httpContext.Connection.RemoteIpAddress;
    var ip = address == null ? "unknown" : (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString();
    var cid = AuditLogSanitizer.Clean(httpContext.Items["X-Correlation-ID"] as string, 64);
    logger.LogWarning("AUDIT AuthEvent {Message} ip={ClientIp} cid={CorrelationId} path={Path}",
        message, ip, cid, AuditLogSanitizer.Clean(httpContext.Request.Path.Value, 200));
}

public partial class Program { }

