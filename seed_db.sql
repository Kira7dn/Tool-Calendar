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
-- Mật khẩu mặc định cho tất cả user seed: DEFAULT_PASSWORD_REDACTED
-- (Thỏa mãn: >=8 ký tự, 1 HOA, 1 thường, 1 số, 1 đặc biệt, không nằm trong list cấm)
-- Hash BCrypt (WorkFactor 12): $2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK

INSERT INTO Users (Id, Username, PasswordHash, FullName, Email, PhoneNumber, Role, DepartmentId, CreatedAt) VALUES 
(1, 'admin', '$2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK', 'Quản trị viên', 'admin@campha.gov.vn', '0912345678', 'Admin', 1, datetime('now', '+7 hours')),
(2, 'chanhvanphong', '$2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK', 'Nguyễn Thị Nơ', 'nguyenthino@campha.gov.vn', '0901234455', 'LanhDao', 1, datetime('now', '+7 hours')),
(3, 'vanthu', '$2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK', 'Hoàng Thị Nhu', 'hoangthinhu@campha.gov.vn', '0902345566', 'VanThu', 1, datetime('now', '+7 hours'));

