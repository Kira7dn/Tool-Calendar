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
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.Window = TimeSpan.FromSeconds(10);
        opt.PermitLimit = 50; // Giới hạn 50 request mỗi 10 giây
        opt.QueueLimit = 0;
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

// Cấu hình JWT - Ưu tiên lấy từ biến môi trường để bảo mật Production
var jwtSecret = builder.Configuration["JWT_SECRET"] 
                ?? Environment.GetEnvironmentVariable("JWT_SECRET") 
                ?? "LinkStrategy_Default_Development_Key_2026_DO_NOT_USE_IN_PROD";

if (jwtSecret.Length < 32) {
    Console.WriteLine("[SecurityWarning] JWT Secret quá ngắn! Nên sử dụng ít nhất 32 ký tự.");
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
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/notificationHub"))
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

// Cấu hình CORS để giao diện Web gọi được API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
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

// Serve static files
app.UseDefaultFiles();
app.UseStaticFiles();

// Serve files from Uploads directory
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "Uploads");
if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/Uploads"
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub");

// Chạy ứng dụng
app.Run();

public partial class Program { }

