CREATE TABLE IF NOT EXISTS Reminders (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    Content TEXT NOT NULL,
    RemindAt TEXT NOT NULL,
    IsSent INTEGER DEFAULT 0,
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);
