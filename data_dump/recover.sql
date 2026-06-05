ATTACH DATABASE '/app/data/backups/documents_20260602_1300.db' AS backup;
DROP TABLE Users;
CREATE TABLE Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT UNIQUE,
    PasswordHash TEXT,
    FullName TEXT,
    Email TEXT,
    PhoneNumber TEXT,
    Role TEXT,
    DepartmentId INTEGER,
    CreatedAt TEXT,
    SessionId TEXT
);
INSERT INTO Users SELECT * FROM backup.Users;
PRAGMA integrity_check;
