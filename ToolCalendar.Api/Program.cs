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
using ToolCalendar.Data;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using ToolCalendar.Middleware;   // ✅ FileAccessSecurityMiddleware
using ToolCalendar.Policies;    // ✅ AppPolicies (phân quyền tập trung)
using ToolCalendar.Services.Security; // ✅ ClamAvService, BackupService


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

    // Policy chung toàn hệ thống: 50 request / 10 giây
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.Window = TimeSpan.FromSeconds(10);
        opt.PermitLimit = 50;
        opt.QueueLimit = 0;
    });

    // Policy STRICT cho Login: tối đa 5 lần thử / 60 giây / mỗi IP → chống Brute Force
    options.AddSlidingWindowLimiter("login-policy", opt =>
    {
        opt.Window = TimeSpan.FromSeconds(60);
        opt.PermitLimit = 5;
        opt.SegmentsPerWindow = 6;
        opt.QueueLimit = 0;
        opt.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
    });

    // Policy cho Upload: tối đa 200 file / 60 giây / mỗi user
    // Tăng từ 10 → 200 để hỗ trợ tải hàng loạt (batch upload 1000+ file)
    options.AddFixedWindowLimiter("upload-limit", opt =>
    {
        opt.Window = TimeSpan.FromSeconds(60);
        opt.PermitLimit = 1000;
        opt.QueueLimit = 100; // Cho phép chờ thêm 100 request trong queue
        opt.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
    });
});

// Đăng ký Repositories (Clean Architecture)
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDocumentRepository, DocumentRepository>();
builder.Services.AddScoped<ToolCalendar.Data.Repositories.IDocumentRoutingRepository, ToolCalendar.Data.Repositories.DocumentRoutingRepository>();

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

// Đăng ký OCR & Extraction Services
builder.Services.AddSingleton<IOcrService, OcrService>();
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

                    if (!cache.TryGetValue(cacheKey, out string? cachedSecStamp))
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
            // Cho phép: localhost (dev), ngrok/localtunnel (staging), và IP LAN nội bộ
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                var uri = new Uri(origin);
                return
                    uri.Host == "localhost" ||
                    uri.Host == "127.0.0.1" ||
                    uri.Host.StartsWith("192.168.") ||  // LAN nội bộ
                    uri.Host.EndsWith(".ngrok-free.dev") ||
                    uri.Host.EndsWith(".ngrok.io") ||
                    uri.Host.EndsWith(".loca.lt") ||    // localtunnel
                    uri.Host.EndsWith(".trycloudflare.com"); // cloudflare tunnel
            })
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .WithHeaders("Authorization", "Content-Type", "Accept", "Origin", "User-Agent", "X-Requested-With", "x-hub-protocol", "x-signalr-user-agent")
            .AllowCredentials());
});

var app = builder.Build();

// Cấu hình để nhận diện HTTPS từ Nginx/Ngrok Proxy (Quan trọng khi dùng ngrok)
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedOptions.KnownNetworks.Clear(); // Tin tưởng mọi mạng (cần thiết cho ngrok/proxy bên ngoài)
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
app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub");
app.MapFallbackToFile("index.html");


// Chạy ứng dụng
app.Run();

public partial class Program { }

