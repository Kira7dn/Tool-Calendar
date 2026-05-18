using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Data;
using ToolCalendar.Hubs;
using ToolCalendar.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình dịch vụ
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();



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
});

// Đăng ký Repositories (Clean Architecture)
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDocumentRepository, DocumentRepository>();

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
    x.RequireHttpsMetadata = false;
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
        // SignalR client gửi token trong query string "access_token"
        OnMessageReceived = context =>
        {
            // Đọc token từ HttpOnly Cookie (ưu tiên cao nhất, an toàn nhất)
            if (context.Request.Cookies.TryGetValue("jwt_cookie", out var cookieToken))
            {
                context.Token = cookieToken;
                return Task.CompletedTask;
            }

            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && 
                (path.StartsWithSegments("/notificationHub") || 
                 path.Value.Contains("/file") || 
                 path.Value.Contains("/public-file") || 
                 path.Value.Contains("/evidence") ||
                 path.Value.Contains("/Uploads")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            try
            {
                // Log all claims for debugging (only in development)
                var claims = context.Principal?.Claims.Select(c => $"{c.Type}:{c.Value}");
                Console.WriteLine($"[AuthDebug] Kiểm tra token cho User: {context.Principal?.Identity?.Name}. Claims: {string.Join(", ", claims ?? Array.Empty<string>())}");

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
                    var userRepo = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                    var user = userRepo.GetUserById(userId);
                    if (user == null)
                    {
                        Console.WriteLine($"[AuthError] Không tìm thấy User ID {userId} trong cơ sở dữ liệu.");
                        context.Fail("Tài khoản không tồn tại.");
                    }
                    else if (!string.IsNullOrEmpty(sessionId) && user.SessionId != sessionId)
                    {
                        Console.WriteLine($"[AuthError] SessionId không khớp. DB: {user.SessionId}, Token: {sessionId}");
                        context.Fail("Phiên đăng nhập đã hết hạn hoặc tài khoản đã đăng nhập ở nơi khác.");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AuthFatalError] {ex.Message}\n{ex.StackTrace}");
            }
            return Task.CompletedTask;
        }
    };
});

// Cấu hình CORS - chỉ cho phép các domain tin cậy
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
            .AllowAnyMethod()
            .AllowAnyHeader()
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

