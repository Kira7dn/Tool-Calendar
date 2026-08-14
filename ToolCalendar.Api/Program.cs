using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using ToolCalendar.Api.Security;          // ✅ CustomUserStore, HybridPasswordHasher
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Services;
using ToolCalendar.Core.Services.AiTools;

using ToolCalendar.Data;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using ToolCalendar.Middleware;   // ✅ FileAccessSecurityMiddleware
using ToolCalendar.Policies;    // ✅ AppPolicies (phân quyền tập trung)
using ToolCalendar.Services.Security; // ✅ ClamAvService, BackupService
using Microsoft.Extensions.Caching.Memory; // ✅ IMemoryCache extension methods

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình dịch vụ
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache(); // ✅ Dashboard stats caching



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

    // Policy STRICT cho Login: tối đa 5 lần thử / 60 giây / mỗi IP → chống Brute Force
    options.AddPolicy("login-policy", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: partition => new SlidingWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 5,
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


// Refactored Repositories
builder.Services.AddScoped<IStatsRepository, StatsRepository>();
builder.Services.AddScoped<ISettingRepository, SettingRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IReminderRepository, ReminderRepository>();
builder.Services.AddScoped<IChatHistoryRepository, ChatHistoryRepository>();
builder.Services.AddScoped<IOcrTextProcessingService, OcrTextProcessingService>();
builder.Services.AddScoped<IOllamaEmbeddingService, OllamaEmbeddingService>();
builder.Services.AddScoped<IDocumentChunkRepository, DocumentChunkRepository>();
builder.Services.AddScoped<IUserMemoryRepository, UserMemoryRepository>(); // ANYTHINGLLM Idea #5: Long-Term Memory

// Đăng ký AI Tools (Khoj Architecture)
builder.Services.AddScoped<IAiTool, GetDocumentStatsTool>();
builder.Services.AddScoped<IAiTool, SearchDocumentContentTool>();
builder.Services.AddScoped<IAiTool, SearchDocumentsByConditionTool>();
builder.Services.AddScoped<IAiTool, WebSearchTool>();
builder.Services.AddScoped<GeminiFallbackService>();
builder.Services.AddScoped<IAiTool, ChartGeneratorTool>();
builder.Services.AddScoped<AiToolRegistry>();

builder.Services.AddScoped<IAiAssistantService, AiAssistantService>();
builder.Services.AddScoped<IAiReferenceService, AiReferenceService>();


// ✅ ASP.NET Core Identity (Custom UserStore — không cần EF Core)
// Toàn bộ dữ liệu vẫn lưu trong SQLite hiện có, không mất dữ liệu cũ
builder.Services.AddIdentityCore<User>(options =>
{
    // --- Cấu hình mật khẩu (giữ nguyên quy tắc hiện tại) ---
    options.Password.RequiredLength         = 8;
    options.Password.RequireUppercase       = true;
    options.Password.RequireLowercase       = true;
    options.Password.RequireDigit           = true;
    options.Password.RequireNonAlphanumeric = true;

    // --- Account Lockout (Identity quản lý thay vì code thủ công) ---
    options.Lockout.MaxFailedAccessAttempts = 5;               // Khóa sau 5 lần sai
    options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15); // Khóa 15 phút
    options.Lockout.AllowedForNewUsers      = true;

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

// Đăng ký OCR & Extraction Services
builder.Services.AddSingleton<IOcrService, OcrService>();
builder.Services.AddScoped<IOcrTextProcessingService, OcrTextProcessingService>();
builder.Services.AddScoped<IOcrImageProcessingService, OcrImageProcessingService>();
builder.Services.AddScoped<IDocumentExtractorService, DocumentExtractorService>();
// builder.Services.AddHostedService<OcrRuntimeValidationService>();

// Cấu hình Hàng đợi OCR xử lý nền
builder.Services.AddSingleton<OcrQueueService>();
builder.Services.AddSingleton<IOcrQueueService>(sp => sp.GetRequiredService<OcrQueueService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<OcrQueueService>());

// Cấu hình Email & Thông báo tự động
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<IVapidService, VapidService>();
builder.Services.AddScoped<INotificationManager, NotificationManager>();
builder.Services.AddSingleton<DeadlineWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<DeadlineWorker>());
builder.Services.AddHostedService<ReminderWorker>();


// ✅ Security Services
builder.Services.AddSingleton<IClamAvService, ClamAvService>();  // Virus scanning
builder.Services.AddHostedService<BackupService>();               // Auto DB backup mỗi 6h

// Cấu hình JWT - Bắt buộc phải có trong biến môi trường hoặc appsettings
var jwtSecret = builder.Configuration["JWT_SECRET"]
                ?? Environment.GetEnvironmentVariable("JWT_SECRET");

// Nếu không có secret → DỪNG ứng dụng ngay, không cho chạy với key rỗng/yếu
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    throw new InvalidOperationException(
        "[SECURITY FATAL] JWT_SECRET chưa được cấu hình hoặc quá ngắn (tối thiểu 32 ký tự).\n" +
        "Vui lòng thêm JWT_SECRET vào file .env hoặc biến môi trường hệ thống.\n" +
        "Tạo secret mạnh bằng lệnh: openssl rand -base64 64");
}

var key = jwtSecret;
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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(key)),
        ValidateIssuer = false,
        ValidateAudience = false
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
            // 2. Đọc token từ HttpOnly Cookie (jwt_cookie) do AuthController set lúc Login
            // Giúp mở file PDF an toàn bằng iframe/window.open không cần token trên URL
            else if (context.Request.Cookies.TryGetValue("jwt_cookie", out var cookieToken))
            {
                context.Token = cookieToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            try
            {
                // Chỉ log chi tiết claims trong môi trường Development để tránh lộ thông tin nhạy cảm ra production logs
                if (builder.Environment.IsDevelopment())
                {
                    var claims = context.Principal?.Claims.Select(c => $"{c.Type}:{c.Value}");
                    Console.WriteLine($"[AuthDebug] Kiểm tra token cho User: {context.Principal?.Identity?.Name}. Claims: {string.Join(", ", claims ?? Array.Empty<string>())}");
                }

                var userIdStr = context.Principal?.FindFirst("uid")?.Value
                              ?? context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? context.Principal?.FindFirst("UserId")?.Value;

                var sessionId = context.Principal?.FindFirst("sid")?.Value;

                if (string.IsNullOrEmpty(userIdStr))
                {
                    Console.WriteLine("[AuthWarning] Thiếu UserId/uid claim trong token.");
                    return Task.CompletedTask;
                }

                if (int.TryParse(userIdStr, out int userId))
                {
                        var cache    = context.HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                    var cacheKey = $"UserSession_{userId}";

                    var cachedSecStamp = cache.Get<string>(cacheKey);
                    if (string.IsNullOrEmpty(cachedSecStamp))
                    {
                        var userRepo = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                        var user     = userRepo.GetUserById(userId);
                        if (user == null)
                        {
                            Console.WriteLine($"[AuthError] Không tìm thấy User ID {userId} trong cơ sở dữ liệu.");
                            context.Fail("Tài khoản không tồn tại.");
                            return Task.CompletedTask;
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
                        Console.WriteLine($"[AuthError] SecurityStamp không khớp → phiên đăng nhập bị vô hiệu hóa.");
                        context.Fail("Phiên đăng nhập đã hết hạn hoặc tài khoản đã đăng nhập ở nơi khác.");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AuthFatalError] {ex.Message}\n{ex.StackTrace}");
            }
            return Task.CompletedTask;
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

// Cấu hình để nhận diện HTTPS từ Nginx Proxy
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedOptions.KnownNetworks.Clear(); // Tin tưởng mọi mạng (cần thiết cho Nginx proxy)
forwardedOptions.KnownProxies.Clear();   // Tin tưởng mọi proxy
app.UseForwardedHeaders(forwardedOptions);

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
// Áp dụng Rate Limiter "fixed" làm mặc định cho tất cả Controllers và Hub
app.MapControllers().RequireRateLimiting("fixed");
app.MapHub<NotificationHub>("/notificationHub").RequireRateLimiting("fixed");
app.MapFallbackToFile("index.html");


// Chạy ứng dụng
app.Run();

public partial class Program { }

