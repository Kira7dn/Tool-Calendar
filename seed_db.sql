-- Xóa toàn bộ dữ liệu hiện tại
DELETE FROM CommentReactions;
DELETE FROM Comments;
DELETE FROM Documents;
DELETE FROM Labels;
DELETE FROM AutoRules;
DELETE FROM Users;
DELETE FROM Departments;
DELETE FROM AuditLogs;

-- Reset lại bảng sequence (để ID tự tăng bắt đầu lại từ 1)
DELETE FROM sqlite_sequence;

-- SEED DEPARTMENTS --
INSERT INTO Departments (Id, Name) VALUES 
(1, 'Văn Phòng HĐND và UBND'),
(2, 'Phòng Kinh tế hạ tầng và đô thị'),
(3, 'Phòng Văn hóa xã hội');

-- SEED USERS --
-- Role: Admin, LanhDao, VanThu, CanBo
INSERT INTO Users (Id, Username, PasswordHash, FullName, Email, PhoneNumber, Role, DepartmentId, CreatedAt) VALUES 
(1, 'admin', '123456', 'Quản trị viên', 'admin@campha.gov.vn', '0912345678', 'Admin', 1, datetime('now')),
(2, 'chanhvanphong', '123456', 'Nguyễn Thị Nơ', 'nguyenthino@campha.gov.vn', '0901234455', 'LanhDao', 1, datetime('now')),
(3, 'vanthu', '123456', 'Trương Thị Thu Hằng', 'ttb@campha.gov.vn', '0902345566', 'VanThu', 1, datetime('now'));
