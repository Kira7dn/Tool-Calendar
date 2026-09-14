-- Migration: Security Upgrade (Sessions, Identities, Logs)
-- Ngày: 2026-09-14

-- 1. Tạo bảng UserIdentities
CREATE TABLE IF NOT EXISTS UserIdentities (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    Provider TEXT NOT NULL,       -- 'local', 'google', v.v.
    ProviderId TEXT NOT NULL,     -- Username hoặc email hoặc Google ID
    PasswordHash TEXT,
    PasswordSalt TEXT,
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    UNIQUE (Provider, ProviderId)
);

-- 2. Migrate data mật khẩu cũ từ Users sang UserIdentities (với Provider='local')
-- Dùng INSERT OR IGNORE để chạy an toàn nhiều lần
INSERT OR IGNORE INTO UserIdentities (UserId, Provider, ProviderId, PasswordHash)
SELECT Id, 'local', Username, PasswordHash
FROM Users
WHERE PasswordHash IS NOT NULL AND PasswordHash != '';

-- 3. Tạo bảng UserSessions (Quản lý Refresh Token)
CREATE TABLE IF NOT EXISTS UserSessions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    RefreshTokenHash TEXT NOT NULL UNIQUE,
    IpAddress TEXT,
    UserAgent TEXT,
    DeviceFingerprint TEXT,
    ExpiresAt TEXT NOT NULL,       -- ISO 8601
    RevokedAt TEXT,                -- ISO 8601, nếu NULL là chưa thu hồi
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usersessions_userid ON UserSessions(UserId);
CREATE INDEX IF NOT EXISTS idx_usersessions_refreshtoken ON UserSessions(RefreshTokenHash);

-- 4. Tạo bảng SecurityLogs
CREATE TABLE IF NOT EXISTS SecurityLogs (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER,                -- Có thể NULL nếu login sai không tồn tại user
    IpAddress TEXT,
    EventType TEXT NOT NULL,       -- 'LoginSuccess', 'LoginFailed', 'Logout', 'TokenRefreshed'
    UserAgent TEXT,
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_securitylogs_userid ON SecurityLogs(UserId);
CREATE INDEX IF NOT EXISTS idx_securitylogs_ip ON SecurityLogs(IpAddress);
