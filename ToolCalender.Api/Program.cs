using ToolCalender.Data;
using ToolCalender.Api.Services;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using ToolCalender.Services;

using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình dịch vụ
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Đăng ký Session Hub (SSE real-time)
builder.Services.AddSingleton<SessionHubService>();

// Đăng ký OCR & Extraction Services
builder.Services.AddSingleton<IOcrService, OcrService>();
builder.Services.AddScoped<IDocumentExtractorService, DocumentExtractorService>();

// Cấu hình Hàng đợi OCR xử lý nền
builder.Services.AddSingleton<OcrQueueService>();
builder.Services.AddSingleton<IOcrQueueService>(sp => sp.GetRequiredService<OcrQueueService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<OcrQueueService>());

// Cấu hình Email & Thông báo tự động
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<IVapidService, VapidService>();
builder.Services.AddScoped<INotificationManager, NotificationManager>();
builder.Services.AddHostedService<DeadlineWorker>();

// Cấu hình JWT
var key = "LinkStrategy_SecretKey_2026_Secure_GiamSatCongVan"; // Key bí mật cho GĐ 1
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
        // Cho phép đọc token từ query string (cần thiết cho SSE/EventSource)
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var userIdStr = context.Principal?.FindFirst("uid")?.Value;
            var sessionId = context.Principal?.FindFirst("sid")?.Value;

            if (string.IsNullOrEmpty(userIdStr) || string.IsNullOrEmpty(sessionId))
                return Task.CompletedTask;

            if (int.TryParse(userIdStr, out int userId))
            {
                var user = DatabaseService.GetUserById(userId);
                if (user == null || user.SessionId != sessionId)
                {
                    context.Fail("Phiên đăng nhập đã hết hạn hoặc tài khoản đã đăng nhập ở nơi khác.");
                }
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

// Cấu hình để nhận diện HTTPS từ Nginx Proxy
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// 2. Khởi tạo Database
DatabaseService.Initialize();

// 3. Pipeline xử lý request
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

// Serve static files
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Chạy ứng dụng
app.Run();

public partial class Program { }

