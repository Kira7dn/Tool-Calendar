CREATE TABLE Documents (
    Id INTEGER PRIMARY KEY,
    SoVanBan TEXT,
    TenCongVan TEXT,
    TrichYeu TEXT,
    FullText TEXT,
    OcrPagesJson TEXT,
    NgayBanHanh TEXT,
    CoQuanBanHanh TEXT,
    CoQuanChuQuan TEXT,
    ThoiHan TEXT,
    DonViChiDao TEXT,
    FilePath TEXT,
    Status TEXT,
    Priority TEXT,
    DepartmentId INTEGER,
    AssignedTo INTEGER,
    EvidencePaths TEXT,
    EvidenceNotes TEXT,
    CompletionDate TEXT,
    LabelId INTEGER,
    NgayThem TEXT,
    DaTaoLich INTEGER,
    UploadedByUserId INTEGER,
    ContentHash TEXT,
    AssignedUserIds TEXT,
    AssignedDepartmentIds TEXT
);

CREATE TABLE Users (
    Id INTEGER PRIMARY KEY,
    Username TEXT UNIQUE,
    PasswordHash TEXT,
    FullName TEXT,
    Email TEXT,
    PhoneNumber TEXT,
    Role TEXT,
    DepartmentId INTEGER,
    CreatedAt TEXT,
    SessionId TEXT,
    FailedLoginCount INTEGER,
    LockoutUntil TEXT,
    SecurityStamp TEXT,
    NormalizedUserName TEXT,
    LockoutEnabled INTEGER,
    AccessFailedCount INTEGER,
    LockoutEnd TEXT
);

CREATE TABLE Comments (
    Id INTEGER PRIMARY KEY,
    DocumentId INTEGER,
    UserId INTEGER,
    Username TEXT,
    Content TEXT,
    AttachmentPaths TEXT,
    CreatedAt TEXT,
    FOREIGN KEY(DocumentId) REFERENCES Documents(Id)
);

CREATE TABLE CommentReactions (
    Id INTEGER PRIMARY KEY,
    CommentId INTEGER,
    UserId INTEGER,
    Username TEXT,
    ReactionType TEXT,
    CreatedAt TEXT,
    UNIQUE(CommentId, UserId),
    FOREIGN KEY(CommentId) REFERENCES Comments(Id) ON DELETE CASCADE
);

CREATE TABLE Departments (
    Id INTEGER PRIMARY KEY,
    Name TEXT,
    Description TEXT,
    IsActive INTEGER
);

CREATE TABLE Labels (
    Id INTEGER PRIMARY KEY,
    Name TEXT,
    Color TEXT
);

CREATE TABLE AutoRules (
    Id INTEGER PRIMARY KEY,
    Keyword TEXT,
    LabelId INTEGER,
    DepartmentId INTEGER,
    DefaultDeadlineDays INTEGER
);

CREATE TABLE AppSettings (
    "Key" TEXT PRIMARY KEY,
    "Value" TEXT
);

CREATE TABLE AuditLogs (
    Id INTEGER PRIMARY KEY,
    UserId INTEGER,
    Action TEXT,
    Timestamp TEXT
);

CREATE TABLE PushSubscriptions (
    Id INTEGER PRIMARY KEY,
    UserId INTEGER,
    Endpoint TEXT UNIQUE,
    P256dh TEXT,
    Auth TEXT,
    CreatedAt TEXT
);

CREATE TABLE Notifications (
    Id INTEGER PRIMARY KEY,
    UserId INTEGER,
    Title TEXT,
    Body TEXT,
    Type TEXT,
    DocId INTEGER,
    IsRead INTEGER,
    CreatedAt TEXT
);

CREATE TABLE DocumentRoutings (
    Id INTEGER PRIMARY KEY,
    DocumentId INTEGER,
    SenderId INTEGER,
    ReceiverId INTEGER,
    ParentRoutingId INTEGER,
    Role TEXT,
    ForwardDate TEXT,
    Deadline TEXT,
    Comment TEXT,
    ProcessingContent TEXT,
    Status TEXT,
    CreatedAt TEXT,
    FOREIGN KEY(DocumentId) REFERENCES Documents(Id)
);

CREATE TABLE Rooms (
    Id INTEGER PRIMARY KEY,
    Name TEXT,
    DepartmentId INTEGER,
    Status INTEGER,
    CreatedAt TEXT
);

CREATE TABLE Meetings (
    Id INTEGER PRIMARY KEY,
    Title TEXT,
    StartTime TEXT,
    EndTime TEXT,
    RoomId INTEGER,
    Status TEXT,
    CreatorId INTEGER,
    CreatedAt TEXT,
    Location TEXT,
    Presider TEXT,
    PreparingUnit TEXT,
    Content TEXT,
    Notes TEXT,
    OrganizingUnit TEXT,
    ExpectedAttendees INTEGER,
    FOREIGN KEY(RoomId) REFERENCES Rooms(Id)
);

CREATE TABLE MeetingParticipants (
    MeetingId INTEGER,
    UserId INTEGER,
    AttendanceStatus TEXT,
    PRIMARY KEY(MeetingId, UserId),
    FOREIGN KEY(MeetingId) REFERENCES Meetings(Id),
    FOREIGN KEY(UserId) REFERENCES Users(Id)
);

CREATE TABLE Questionnaires (
    Id INTEGER PRIMARY KEY,
    MeetingId INTEGER,
    Title TEXT,
    AssignedTo INTEGER,
    Deadline TEXT,
    Status TEXT,
    CreatedAt TEXT,
    FOREIGN KEY(MeetingId) REFERENCES Meetings(Id)
);

CREATE TABLE LoginAuditLog (
    Id INTEGER PRIMARY KEY,
    Username TEXT NOT NULL,
    UserId INTEGER NULL,
    IpAddress TEXT,
    UserAgent TEXT,
    IsSuccess INTEGER,
    FailReason TEXT NULL,
    CreatedAt TEXT NOT NULL
);
