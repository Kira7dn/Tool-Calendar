-- SEED DEPARTMENTS --
INSERT OR REPLACE INTO Departments (Id, Name) VALUES 
(1, 'Phòng Kinh tế'),
(2, 'Phòng Văn hóa - Xã hội'),
(3, 'Phòng Tư pháp'),
(4, 'Phòng Địa chính - Xây dựng'),
(5, 'Phòng Văn thư - Tổng hợp');

-- SEED USERS --
-- Role: LanhDao, VanThu, CanBo
-- Admin user (Id 1) usually already exists, but we update it
INSERT OR REPLACE INTO Users (Id, Username, PasswordHash, FullName, Email, PhoneNumber, Role, DepartmentId, CreatedAt) VALUES 
(1, 'admin', '123456', 'Quản trị viên', 'admin@campha.gov.vn', '0912345678', 'Admin', 5, datetime('now')),
(2, 'chutich', '123456', 'Nguyễn Văn A', 'nva@campha.gov.vn', '0901234455', 'LanhDao', 1, datetime('now')),
(3, 'vanthu', '123456', 'Trần Thị B', 'ttb@campha.gov.vn', '0902345566', 'VanThu', 5, datetime('now')),
(4, 'tp_kinhte', '123456', 'Lê Văn C', 'lvc@campha.gov.vn', '0903456677', 'CanBo', 1, datetime('now')),
(5, 'cb_kinhte', '123456', 'Phạm Văn D', 'pvd@campha.gov.vn', '0904567788', 'CanBo', 1, datetime('now')),
(6, 'tp_vanhoa', '123456', 'Hoàng Thị E', 'hte@campha.gov.vn', '0905678899', 'CanBo', 2, datetime('now')),
(7, 'cb_vanhoa', '123456', 'Vũ Văn F', 'vvf@campha.gov.vn', '0906789900', 'CanBo', 2, datetime('now')),
(8, 'tp_tuphap', '123456', 'Lý Thị G', 'ltg@campha.gov.vn', '0907890011', 'CanBo', 3, datetime('now')),
(9, 'cb_tuphap', '123456', 'Đỗ Văn H', 'dvh@campha.gov.vn', '0908901122', 'CanBo', 3, datetime('now')),
(10, 'tp_diachinh', '123456', 'Ngô Thị I', 'nti@campha.gov.vn', '0909012233', 'CanBo', 4, datetime('now')),
(11, 'cb_diachinh', '123456', 'Bùi Văn K', 'bvk@campha.gov.vn', '0910123344', 'CanBo', 4, datetime('now'));
