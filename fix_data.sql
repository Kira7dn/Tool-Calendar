DELETE FROM Departments;
INSERT INTO Departments (Name, Description) VALUES ('Văn phòng HĐND và UBND', 'Phòng ban Văn phòng HĐND và UBND');
INSERT INTO Departments (Name, Description) VALUES ('Phòng Kinh tế hạ tầng và Đô thị', 'Phòng ban Phòng Kinh tế hạ tầng và Đô thị');
INSERT INTO Departments (Name, Description) VALUES ('Phòng Văn hóa xã hội', 'Phòng ban Phòng Văn hóa xã hội');

UPDATE Users SET FullName = 'Quản trị viên' WHERE Username = 'admin';
UPDATE Users SET FullName = 'Chánh Văn phòng' WHERE Username = 'chanhvanphong';
UPDATE Users SET FullName = 'Văn thư' WHERE Username = 'vanthu';

UPDATE AppSettings SET Value = 'hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành' WHERE [Key] = 'Document_DeadlineKeywords';
