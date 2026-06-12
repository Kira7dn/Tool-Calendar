using Microsoft.AspNetCore.Identity;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Security
{
    /// <summary>
    /// HybridPasswordHasher: Đảm bảo tương thích ngược hoàn toàn với dữ liệu cũ.
    /// 
    /// Chiến lược (Hybrid Strategy):
    /// 1. VERIFY: Nếu hash bắt đầu bằng "$2" → đây là BCrypt cũ → verify bằng BCrypt
    ///            Nếu hash bắt đầu bằng "$PBKDF2" → đây là Identity mới → verify bằng Identity PBKDF2
    /// 2. HASH MỚI: Mọi mật khẩu mới/đổi mật khẩu đều dùng PBKDF2 V3 (chuẩn của Identity)
    /// 3. NÂNG CẤP: Sau khi user BCrypt cũ đăng nhập thành công → tự động nâng lên PBKDF2
    ///
    /// Kết quả: Không có người dùng nào bị mất quyền truy cập trong quá trình chuyển đổi.
    /// </summary>
    public class HybridPasswordHasher : IPasswordHasher<User>
    {
        private readonly PasswordHasher<User> _identityHasher = new();

        /// <summary>
        /// Hash mật khẩu mới bằng PBKDF2 V3 (chuẩn Identity, không còn dùng BCrypt cho user mới).
        /// </summary>
        public string HashPassword(User user, string password)
        {
            // Tất cả mật khẩu mới đều dùng PBKDF2 V3 của Identity
            return _identityHasher.HashPassword(user, password);
        }

        /// <summary>
        /// Xác minh mật khẩu: tự động nhận ra BCrypt cũ hoặc PBKDF2 mới.
        /// </summary>
        public PasswordVerificationResult VerifyHashedPassword(User user, string hashedPassword, string providedPassword)
        {
            if (string.IsNullOrEmpty(hashedPassword))
                return PasswordVerificationResult.Failed;

            // ── Trường hợp 1: Hash cũ dùng BCrypt (bắt đầu bằng "$2a$", "$2b$", "$2y$") ──
            if (hashedPassword.StartsWith("$2a$") ||
                hashedPassword.StartsWith("$2b$") ||
                hashedPassword.StartsWith("$2y$"))
            {
                try
                {
                    bool isValid = BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword);
                    if (isValid)
                    {
                        // Trả về SuccessRehashNeeded để Identity biết cần nâng cấp hash lên PBKDF2
                        // → AuthController sẽ tự động gọi UpdatePasswordHash sau khi verify thành công
                        return PasswordVerificationResult.SuccessRehashNeeded;
                    }
                    return PasswordVerificationResult.Failed;
                }
                catch
                {
                    return PasswordVerificationResult.Failed;
                }
            }

            // ── Trường hợp 2: Hash mới dùng PBKDF2 V3 của Identity ──
            return _identityHasher.VerifyHashedPassword(user, hashedPassword, providedPassword);
        }
    }
}
