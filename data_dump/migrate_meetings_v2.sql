-- Migration v2: Thêm các trường chi tiết cho bảng Meetings
-- Chạy một lần duy nhất. SQLite dùng ALTER TABLE ADD COLUMN.
-- Ngày tạo: 2026-06-28

-- Thêm cột địa điểm chi tiết (VD: Phòng họp tầng 4, Trụ sở HĐND - UBND phường)
ALTER TABLE Meetings ADD COLUMN Location TEXT;

-- Thêm cột người chủ trì (VD: Đ/c Nguyễn Đức Dương - Phó Chủ tịch UBND)
ALTER TABLE Meetings ADD COLUMN Presider TEXT;

-- Thêm cột đơn vị chuẩn bị tài liệu (VD: Phòng VH-XH)
ALTER TABLE Meetings ADD COLUMN PreparingUnit TEXT;

-- Thêm cột nội dung/chương trình họp (nội dung đầy đủ của cuộc họp)
ALTER TABLE Meetings ADD COLUMN Content TEXT;

-- Thêm cột ghi chú thêm
ALTER TABLE Meetings ADD COLUMN Notes TEXT;

-- Thêm cột đơn vị tổ chức
ALTER TABLE Meetings ADD COLUMN OrganizingUnit TEXT;

-- Thêm cột số lượng đại biểu dự kiến
ALTER TABLE Meetings ADD COLUMN ExpectedAttendees INTEGER DEFAULT 0;
