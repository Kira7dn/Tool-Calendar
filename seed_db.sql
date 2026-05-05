-- Xóa toàn bộ dữ liệu hiện tại
DELETE FROM CommentReactions;
DELETE FROM Comments;
DELETE FROM Documents;
DELETE FROM PushSubscriptions;
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
(3, 'vanthu', '$2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK', 'Hoàng Thị Nhu', 'hoangthinhu@campha.gov.vn', '0902345566', 'VanThu', 1, datetime('now', '+7 hours')),
(4, 'nguyenanhduc', '$2a$12$rWRxcTCzNGVpmk.b1t.oxuIs1NqQfdIbTVz7r0cUGIRQPYsgi.4IK', 'Nguyễn Anh Đức', 'anhduc@campha.gov.vn', '0902345566', 'CanBo', 1, datetime('now', '+7 hours'));

-- SEED DASHBOARD DOCUMENTS --
-- Nhóm dữ liệu mẫu phục vụ dashboard: đang xử lý, quá hạn, đến hạn hôm nay, sắp hạn và lỗi OCR.
INSERT INTO Documents (
    Id, SoVanBan, TenCongVan, TrichYeu, FullText, OcrPagesJson,
    NgayBanHanh, CoQuanBanHanh, CoQuanChuQuan, ThoiHan, DonViChiDao,
    FilePath, Status, Priority, DepartmentId, AssignedTo,
    AssignedUserIds, AssignedDepartmentIds, EvidencePaths, EvidenceNotes,
    CompletionDate, LabelId, NgayThem, DaTaoLich, UploadedByUserId
) VALUES
(1, 'SEED-DASH-QH-001', 'Rà soát tiến độ giải quyết kiến nghị cử tri', 'Rà soát tiến độ giải quyết kiến nghị cử tri', 'Nội dung mẫu phục vụ kiểm thử dashboard: Rà soát tiến độ giải quyết kiến nghị cử tri', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '-7 days'), 'Văn Phòng HĐND và UBND', '', 'Đang xử lý', 'Khẩn', 1, 4, '[4]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(2, 'SEED-DASH-QH-002', 'Báo cáo xử lý điểm ngập úng sau mưa lớn', 'Báo cáo xử lý điểm ngập úng sau mưa lớn', 'Nội dung mẫu phục vụ kiểm thử dashboard: Báo cáo xử lý điểm ngập úng sau mưa lớn', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '-3 days'), 'Phòng Kinh tế hạ tầng và đô thị', '', 'Đang xử lý', 'Hỏa tốc', 2, 4, '[4]', '[2]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(3, 'SEED-DASH-QH-003', 'Hoàn thiện hồ sơ xử phạt vi phạm hành chính', 'Hoàn thiện hồ sơ xử phạt vi phạm hành chính', 'Nội dung mẫu phục vụ kiểm thử dashboard: Hoàn thiện hồ sơ xử phạt vi phạm hành chính', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '-1 days'), 'Văn Phòng HĐND và UBND', '', 'Chưa xử lý', 'Khẩn', 1, 4, '[4]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),

(4, 'SEED-DASH-HN-001', 'Tổng hợp danh sách hộ kinh doanh cần kiểm tra', 'Tổng hợp danh sách hộ kinh doanh cần kiểm tra', 'Nội dung mẫu phục vụ kiểm thử dashboard: Tổng hợp danh sách hộ kinh doanh cần kiểm tra', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours'), 'Phòng Kinh tế hạ tầng và đô thị', '', 'Đang xử lý', 'Khẩn', 2, 4, '[4]', '[2]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(5, 'SEED-DASH-HN-002', 'Chuẩn bị tài liệu họp giao ban tuần', 'Chuẩn bị tài liệu họp giao ban tuần', 'Nội dung mẫu phục vụ kiểm thử dashboard: Chuẩn bị tài liệu họp giao ban tuần', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours'), 'Văn Phòng HĐND và UBND', '', 'Chưa xử lý', 'Thường', 1, 3, '[3]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(6, 'SEED-DASH-HN-003', 'Xác minh phản ánh về trật tự đô thị', 'Xác minh phản ánh về trật tự đô thị', 'Nội dung mẫu phục vụ kiểm thử dashboard: Xác minh phản ánh về trật tự đô thị', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours'), 'Phòng Kinh tế hạ tầng và đô thị', '', 'Đang xử lý', 'Khẩn', 2, 4, '[4]', '[2]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),

(7, 'SEED-DASH-SH-001', 'Cập nhật phương án tuyên truyền dịch vụ công trực tuyến', 'Cập nhật phương án tuyên truyền dịch vụ công trực tuyến', 'Nội dung mẫu phục vụ kiểm thử dashboard: Cập nhật phương án tuyên truyền dịch vụ công trực tuyến', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+1 days'), 'Phòng Văn hóa xã hội', '', 'Đang xử lý', 'Thường', 3, 4, '[4]', '[3]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(8, 'SEED-DASH-SH-002', 'Kiểm tra hồ sơ chứng thực tồn đọng', 'Kiểm tra hồ sơ chứng thực tồn đọng', 'Nội dung mẫu phục vụ kiểm thử dashboard: Kiểm tra hồ sơ chứng thực tồn đọng', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+2 days'), 'Văn Phòng HĐND và UBND', '', 'Đang xử lý', 'Khẩn', 1, 4, '[4]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(9, 'SEED-DASH-SH-003', 'Báo cáo tiến độ chỉnh trang tuyến phố chính', 'Báo cáo tiến độ chỉnh trang tuyến phố chính', 'Nội dung mẫu phục vụ kiểm thử dashboard: Báo cáo tiến độ chỉnh trang tuyến phố chính', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+3 days'), 'Phòng Kinh tế hạ tầng và đô thị', '', 'Chưa xử lý', 'Thường', 2, 4, '[4]', '[2]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(10, 'SEED-DASH-SH-004', 'Thống kê văn bản cần trình lãnh đạo ký duyệt', 'Thống kê văn bản cần trình lãnh đạo ký duyệt', 'Nội dung mẫu phục vụ kiểm thử dashboard: Thống kê văn bản cần trình lãnh đạo ký duyệt', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+7 days'), 'Văn Phòng HĐND và UBND', '', 'Chưa xử lý', 'Thường', 1, 3, '[3]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(11, 'SEED-DASH-MO-001', 'Kế hoạch rà soát thủ tục hành chính tháng 5', 'Kế hoạch rà soát thủ tục hành chính tháng 5', 'Nội dung mẫu phục vụ kiểm thử dashboard: Kế hoạch rà soát thủ tục hành chính tháng 5', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+12 days'), 'Văn Phòng HĐND và UBND', '', 'Đang xử lý', 'Thường', 1, 4, '[4]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3),
(12, 'SEED-DASH-OCR-001', 'Tài liệu scan mờ cần nhập tay thông tin công văn', 'Tài liệu scan mờ cần nhập tay thông tin công văn', 'Nội dung mẫu phục vụ kiểm thử dashboard: Tài liệu scan mờ cần nhập tay thông tin công văn', '[]', date('now', '+5 hours', '-2 days'), 'UBND phường Cẩm Phả', 'UBND phường Cẩm Phả', date('now', '+5 hours', '+5 days'), 'Văn Phòng HĐND và UBND', '', 'Lỗi OCR', 'Thường', 1, 3, '[3]', '[1]', '[]', '', NULL, NULL, datetime('now', '+7 hours'), 0, 3);

-- SEED EVENT LOGS --
INSERT INTO AuditLogs (Id, UserId, Action, Timestamp) VALUES
(1, 4, 'Cán bộ đã cập nhật tiến độ xử lý văn bản SEED-DASH-QH-001.', datetime('now', '+7 hours', '-45 minutes')),
(2, 3, 'Văn thư đã giao văn bản SEED-DASH-HN-002 cho Văn Phòng HĐND và UBND.', datetime('now', '+7 hours', '-30 minutes')),
(3, 4, 'Cán bộ đã tiếp nhận văn bản SEED-DASH-SH-002.', datetime('now', '+7 hours', '-18 minutes')),
(4, 3, 'Hệ thống ghi nhận tài liệu SEED-DASH-OCR-001 cần xử lý OCR thủ công.', datetime('now', '+7 hours', '-8 minutes'));

