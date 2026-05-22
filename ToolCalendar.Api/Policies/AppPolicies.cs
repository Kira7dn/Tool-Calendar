using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ToolCalendar.Policies
{
    /// <summary>
    /// ✅ AUTHORIZATION POLICIES: Định nghĩa các policy phân quyền cho toàn hệ thống.
    /// Sử dụng với [Authorize(Policy = "...")] thay vì [Authorize(Roles = "...")]
    /// để linh hoạt hơn và dễ bảo trì.
    /// </summary>
    public static class AppPolicies
    {
        // Tên các policy
        public const string CanViewDocuments   = "CanViewDocuments";
        public const string CanUploadDocuments = "CanUploadDocuments";
        public const string CanDeleteDocuments = "CanDeleteDocuments";
        public const string CanViewFiles       = "CanViewFiles";
        public const string CanManageUsers     = "CanManageUsers";
        public const string CanSubmitEvidence  = "CanSubmitEvidence";
        public const string IsAuthenticated    = "IsAuthenticated";

        /// <summary>
        /// Đăng ký tất cả Authorization Policies vào DI container
        /// </summary>
        public static IServiceCollection AddAppAuthorizationPolicies(this IServiceCollection services)
        {
            services.AddAuthorization(options =>
            {
                // Policy: Người dùng đã đăng nhập (bất kỳ role nào)
                options.AddPolicy(IsAuthenticated, policy =>
                    policy.RequireAuthenticatedUser());

                // Policy: Xem danh sách văn bản
                options.AddPolicy(CanViewDocuments, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin", "VanThu", "LanhDao", "CanBo"));

                // Policy: Tải lên / Upload văn bản
                options.AddPolicy(CanUploadDocuments, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin", "VanThu"));

                // Policy: Xóa văn bản (chỉ Admin)
                options.AddPolicy(CanDeleteDocuments, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin"));

                // Policy: Truy cập file PDF / Evidence / Comment attachments
                // Đây là policy quan trọng nhất — ai không có thì bị 403
                options.AddPolicy(CanViewFiles, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin", "VanThu", "LanhDao", "CanBo")
                          .AddRequirements(new ActiveSessionRequirement()));

                // Policy: Nộp bằng chứng hoàn thành
                options.AddPolicy(CanSubmitEvidence, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin", "CanBo"));

                // Policy: Quản lý người dùng (chỉ Admin)
                options.AddPolicy(CanManageUsers, policy =>
                    policy.RequireAuthenticatedUser()
                          .RequireRole("Admin"));

                // DefaultPolicy: áp dụng khi dùng [Authorize] không có tham số
                // ⚠️ KHÔNG đặt FallbackPolicy — sẽ chặn cả trang SPA (index.html)
                // Các controller đã có [Authorize] / [AllowAnonymous] riêng
                options.DefaultPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();
            });

            // Đăng ký handler cho custom requirements
            services.AddScoped<IAuthorizationHandler, ActiveSessionHandler>();

            return services;
        }
    }

    // ─── Custom Requirement: Kiểm tra session hợp lệ ─────────────────────────────

    /// <summary>
    /// Requirement: Yêu cầu phiên đăng nhập đang hoạt động (không bị kick/hết hạn)
    /// </summary>
    public class ActiveSessionRequirement : IAuthorizationRequirement { }

    /// <summary>
    /// Handler: Xử lý logic kiểm tra ActiveSessionRequirement
    /// </summary>
    public class ActiveSessionHandler : AuthorizationHandler<ActiveSessionRequirement>
    {
        private readonly ILogger<ActiveSessionHandler> _logger;

        public ActiveSessionHandler(ILogger<ActiveSessionHandler> logger)
        {
            _logger = logger;
        }

        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            ActiveSessionRequirement requirement)
        {
            // Kiểm tra user có tồn tại trong context
            if (!context.User.Identity?.IsAuthenticated ?? true)
            {
                _logger.LogWarning("[AuthPolicy] ActiveSession FAIL: User chưa xác thực.");
                context.Fail();
                return Task.CompletedTask;
            }

            // Kiểm tra có claim UserId không
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? context.User.FindFirst("uid")?.Value;

            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("[AuthPolicy] ActiveSession FAIL: Không tìm thấy UserId trong token.");
                context.Fail();
                return Task.CompletedTask;
            }

            // Tất cả điều kiện đều thỏa mãn → Succeed
            _logger.LogDebug("[AuthPolicy] ActiveSession PASS: UserId={UserId}", userId);
            context.Succeed(requirement);
            return Task.CompletedTask;
        }
    }
}
