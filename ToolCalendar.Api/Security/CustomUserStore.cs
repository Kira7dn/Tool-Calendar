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

        public async Task<IdentityResult> CreateAsync(User user, CancellationToken ct)
        {
            var success = await _userRepository.CreateUserAsync(user);
            return success
                ? IdentityResult.Success
                : IdentityResult.Failed(new IdentityError { Code = "DuplicateUserName", Description = "Tên đăng nhập đã tồn tại." });
        }

        public async Task<IdentityResult> DeleteAsync(User user, CancellationToken ct)
        {
            await _userRepository.DeleteUserAsync(user.Id);
            return IdentityResult.Success;
        }

        public async Task<User?> FindByIdAsync(string userId, CancellationToken ct)
        {
            var result = int.TryParse(userId, out int id) ? await _userRepository.GetUserByIdAsync(id) : null;
            return result;
        }

        public async Task<User?> FindByNameAsync(string normalizedUserName, CancellationToken ct)
        {
            // Tìm theo NormalizedUserName (case-insensitive)
            var result = await _userRepository.GetUserByUsernameAsync(normalizedUserName);
            return result;
        }

        public Task<string?> GetNormalizedUserNameAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.NormalizedUserName ?? user.Username.ToUpperInvariant());

        public Task<string> GetUserIdAsync(User user, CancellationToken ct)
            => Task.FromResult<string>(user.Id.ToString());

        public Task<string?> GetUserNameAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.Username);

        public async Task SetNormalizedUserNameAsync(User user, string? normalizedName, CancellationToken ct)
        {
            user.NormalizedUserName = normalizedName ?? user.Username.ToUpperInvariant();
                    }

        public async Task SetUserNameAsync(User user, string? userName, CancellationToken ct)
        {
            user.Username = userName ?? user.Username;
                    }

        public async Task<IdentityResult> UpdateAsync(User user, CancellationToken ct)
        {
            await _userRepository.UpdateUserAsync(user);
            return IdentityResult.Success;
        }

        // ─── IUserPasswordStore ──────────────────────────────────────────────────

        public Task<string?> GetPasswordHashAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.PasswordHash);

        public Task<bool> HasPasswordAsync(User user, CancellationToken ct)
            => Task.FromResult<bool>(!string.IsNullOrEmpty(user.PasswordHash));

        public async Task SetPasswordHashAsync(User user, string? passwordHash, CancellationToken ct)
        {
            user.PasswordHash = passwordHash ?? "";
                    }

        // ─── IUserSecurityStampStore ─────────────────────────────────────────────

        public Task<string?> GetSecurityStampAsync(User user, CancellationToken ct)
            => Task.FromResult<string?>(user.SecurityStamp);

        public async Task SetSecurityStampAsync(User user, string stamp, CancellationToken ct)
        {
            user.SecurityStamp = stamp;
            await _userRepository.UpdateSecurityStampAsync(user.Id, stamp);
                    }

        // ─── IUserLockoutStore ───────────────────────────────────────────────────

        public Task<int> GetAccessFailedCountAsync(User user, CancellationToken ct)
            => Task.FromResult<int>(user.AccessFailedCount);

        public Task<bool> GetLockoutEnabledAsync(User user, CancellationToken ct)
            => Task.FromResult<bool>(user.LockoutEnabled);

        public Task<DateTimeOffset?> GetLockoutEndDateAsync(User user, CancellationToken ct)
            => Task.FromResult<DateTimeOffset?>(user.LockoutEnd);

        public async Task<int> IncrementAccessFailedCountAsync(User user, CancellationToken ct)
        {
            user.AccessFailedCount++;
            user.FailedLoginCount++;
            await _userRepository.UpdateLockoutAsync(user.Id, user.AccessFailedCount, user.LockoutEnd);
            return user.AccessFailedCount;
        }

        public async Task ResetAccessFailedCountAsync(User user, CancellationToken ct)
        {
            user.AccessFailedCount = 0;
            user.FailedLoginCount  = 0;
            user.LockoutEnd        = null;
            user.LockoutUntil      = null;
            await _userRepository.ResetAccessFailedCountAsync(user.Id);
                    }

        public async Task SetLockoutEnabledAsync(User user, bool enabled, CancellationToken ct)
        {
            user.LockoutEnabled = enabled;
                    }

        public async Task SetLockoutEndDateAsync(User user, DateTimeOffset? lockoutEnd, CancellationToken ct)
        {
            user.LockoutEnd   = lockoutEnd;
            user.LockoutUntil = lockoutEnd?.UtcDateTime;
            await _userRepository.UpdateLockoutAsync(user.Id, user.AccessFailedCount, lockoutEnd);
                    }

        // ─── IUserRoleStore ──────────────────────────────────────────────────────
        // Hệ thống dùng Role string đơn giản (Admin, VanThu, LanhDao, CanBo, Guest)
        // → không cần bảng RoleClaims, chỉ cần đọc/ghi trường Role trong Users

        public async Task AddToRoleAsync(User user, string roleName, CancellationToken ct)
        {
            user.Role = roleName;
            await _userRepository.UpdateUserAsync(user);
                    }

        public async Task RemoveFromRoleAsync(User user, string roleName, CancellationToken ct)
        {
            if (user.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase))
                user.Role = "Guest";
                    }

        public async Task<IList<string>> GetRolesAsync(User user, CancellationToken ct)
        {
            IList<string> roles = string.IsNullOrEmpty(user.Role)
                ? new List<string>()
                : new List<string> { user.Role };
            return roles;
        }

        public async Task<bool> IsInRoleAsync(User user, string roleName, CancellationToken ct)
            => user.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase);

        public async Task<IList<User>> GetUsersInRoleAsync(string roleName, CancellationToken ct)
        {
            IList<User> result = (await _userRepository.GetUsersAsync())
                .Where(u => u.Role.Equals(roleName, StringComparison.OrdinalIgnoreCase))
                .ToList();
            return result;
        }

        // ─── IDisposable ─────────────────────────────────────────────────────────

        public void Dispose() { /* UserRepository không cần Dispose */ }
    }
}
