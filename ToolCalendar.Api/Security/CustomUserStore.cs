using Microsoft.AspNetCore.Identity;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Security
{
    /// <summary>
    /// CustomUserStore: Cầu nối giữa ASP.NET Core Identity và cơ sở dữ liệu SQLite hiện có.
    /// Không cần Entity Framework Core — tất cả truy vấn đi qua IUserRepository (ADO.NET + Dapper pattern).
    /// 
    /// Implement các interface:
    ///   - IUserStore: CRUD cơ bản
    ///   - IUserPasswordStore: lưu/đọc PasswordHash (tương thích BCrypt + PBKDF2)
    ///   - IUserSecurityStampStore: vô hiệu hóa token/session cũ khi đổi mật khẩu
    ///   - IUserLockoutStore: đếm sai mật khẩu & khóa tài khoản tự động
    ///   - IUserRoleStore: quản lý Role của user
    /// </summary>
    public class CustomUserStore :
        IUserStore<User>,
        IUserPasswordStore<User>,
        IUserSecurityStampStore<User>,
        IUserLockoutStore<User>,
        IUserRoleStore<User>
    {
        private readonly IUserRepository _userRepository;

        public CustomUserStore(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        // ─── IUserStore ──────────────────────────────────────────────────────────

        public Task<IdentityResult> CreateAsync(User user, CancellationToken ct)
        {
            var success = _userRepository.CreateUser(user);
            return Task.FromResult(success
                ? IdentityResult.Success
                : IdentityResult.Failed(new IdentityError { Code = "DuplicateUserName", Description = "Tên đăng nhập đã tồn tại." }));
        }

        public Task<IdentityResult> DeleteAsync(User user, CancellationToken ct)
        {
            _userRepository.DeleteUser(user.Id);
            return Task.FromResult(IdentityResult.Success);
        }

        public Task<User?> FindByIdAsync(string userId, CancellationToken ct)
        {
            var result = int.TryParse(userId, out int id) ? _userRepository.GetUserById(id) : null;
            return Task.FromResult(result);
        }

        public Task<User?> FindByNameAsync(string normalizedUserName, CancellationToken ct)
        {
            // Tìm theo NormalizedUserName (case-insensitive)
            var result = _userRepository.GetUserByUsername(normalizedUserName);
            return Task.FromResult(result);
        }

        public Task<string?> GetNormalizedUserNameAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.NormalizedUserName ?? user.Username.ToUpperInvariant());

        public Task<string> GetUserIdAsync(User user, CancellationToken ct)
            => Task.FromResult(user.Id.ToString());

        public Task<string?> GetUserNameAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.Username);

        public Task SetNormalizedUserNameAsync(User user, string? normalizedName, CancellationToken ct)
        {
            user.NormalizedUserName = normalizedName ?? user.Username.ToUpperInvariant();
            return Task.CompletedTask;
        }

        public Task SetUserNameAsync(User user, string? userName, CancellationToken ct)
        {
            user.Username = userName ?? user.Username;
            return Task.CompletedTask;
        }

        public Task<IdentityResult> UpdateAsync(User user, CancellationToken ct)
        {
            _userRepository.UpdateUser(user);
            return Task.FromResult(IdentityResult.Success);
        }

        // ─── IUserPasswordStore ──────────────────────────────────────────────────

        public Task<string?> GetPasswordHashAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.PasswordHash);

        public Task<bool> HasPasswordAsync(User user, CancellationToken ct)
            => Task.FromResult(!string.IsNullOrEmpty(user.PasswordHash));

        public Task SetPasswordHashAsync(User user, string? passwordHash, CancellationToken ct)
        {
            user.PasswordHash = passwordHash ?? "";
            return Task.CompletedTask;
        }

        // ─── IUserSecurityStampStore ─────────────────────────────────────────────

        public Task<string?> GetSecurityStampAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.SecurityStamp);

        public Task SetSecurityStampAsync(User user, string stamp, CancellationToken ct)
        {
            user.SecurityStamp = stamp;
            _userRepository.UpdateSecurityStamp(user.Id, stamp);
            return Task.CompletedTask;
        }

        // ─── IUserLockoutStore ───────────────────────────────────────────────────

        public Task<int> GetAccessFailedCountAsync(User user, CancellationToken ct)
            => Task.FromResult(user.AccessFailedCount);

        public Task<bool> GetLockoutEnabledAsync(User user, CancellationToken ct)
            => Task.FromResult(user.LockoutEnabled);

        public Task<DateTimeOffset?> GetLockoutEndDateAsync(User user, CancellationToken ct)
            => Task.FromResult(user.LockoutEnd);

        public Task<int> IncrementAccessFailedCountAsync(User user, CancellationToken ct)
        {
            user.AccessFailedCount++;
            user.FailedLoginCount++;
            _userRepository.UpdateLockout(user.Id, user.AccessFailedCount, user.LockoutEnd);
            return Task.FromResult(user.AccessFailedCount);
        }

        public Task ResetAccessFailedCountAsync(User user, CancellationToken ct)
        {
            user.AccessFailedCount = 0;
            user.FailedLoginCount  = 0;
            user.LockoutEnd        = null;
            user.LockoutUntil      = null;
            _userRepository.ResetAccessFailedCount(user.Id);
            return Task.CompletedTask;
        }

        public Task SetLockoutEnabledAsync(User user, bool enabled, CancellationToken ct)
        {
            user.LockoutEnabled = enabled;
            return Task.CompletedTask;
        }

        public Task SetLockoutEndDateAsync(User user, DateTimeOffset? lockoutEnd, CancellationToken ct)
        {
            user.LockoutEnd   = lockoutEnd;
            user.LockoutUntil = lockoutEnd?.UtcDateTime;
            _userRepository.UpdateLockout(user.Id, user.AccessFailedCount, lockoutEnd);
            return Task.CompletedTask;
        }

        // ─── IUserRoleStore ──────────────────────────────────────────────────────
        // Hệ thống dùng Role string đơn giản (Admin, VanThu, LanhDao, CanBo, Guest)
        // → không cần bảng RoleClaims, chỉ cần đọc/ghi trường Role trong Users

        public Task AddToRoleAsync(User user, string roleName, CancellationToken ct)
        {
            user.Role = roleName;
            _userRepository.UpdateUser(user);
            return Task.CompletedTask;
        }

        public Task RemoveFromRoleAsync(User user, string roleName, CancellationToken ct)
        {
            if (user.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase))
                user.Role = "Guest";
            return Task.CompletedTask;
        }

        public Task<IList<string>> GetRolesAsync(User user, CancellationToken ct)
        {
            IList<string> roles = string.IsNullOrEmpty(user.Role)
                ? new List<string>()
                : new List<string> { user.Role };
            return Task.FromResult(roles);
        }

        public Task<bool> IsInRoleAsync(User user, string roleName, CancellationToken ct)
            => Task.FromResult(user.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase));

        public Task<IList<User>> GetUsersInRoleAsync(string roleName, CancellationToken ct)
        {
            IList<User> result = _userRepository.GetUsers()
                .Where(u => u.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase))
                .ToList();
            return Task.FromResult(result);
        }

        // ─── IDisposable ─────────────────────────────────────────────────────────

        public void Dispose() { /* UserRepository không cần Dispose */ }
    }
}
