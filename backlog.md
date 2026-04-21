# 📝 BACKLOG: HỆ THỐNG ĐIỀU PHỐI CÔNG VĂN

- [x] **Quản lý nhân sự (User CRUD)**: Cho phép Thêm, Sửa, Xóa và liệt kê người dùng.
- [x] **Mở rộng Profile**: Tích hợp Họ tên, Email, Số điện thoại và Phòng ban vào hệ thống.
- [x] **Dữ liệu mẫu (Seeding)**: Tự động nạp danh sách 11 nhân sự theo sơ đồ tổ chức thực tế.
- [x] **Icon Thao tác**: Thêm Lucide icons (Edit, Trash) cho các nút trong danh sách người dùng thay vì chỉ dùng text.
- [x] đổi màu các tag của vai trò

## 🚀 TÍNH NĂNG ĐANG PHÁT TRIỂN (IN PROGRESS)

- [x] **Tối ưu hóa UI Rà soát song song**:
    - [x] Đưa tên tài liệu lên Header để tăng diện tích hiển thị PDF.
    - [x] Loại bỏ caption "Xem theo từng trang gốc..." để làm gọn giao diện.
    - [x] Chuyển nút điều hướng trang PDF thành dạng Floating Buttons (hiện khi hover).
    - [x] Tăng kích thước khu vực hiển thị PDF.
- [x] **Hiệu ứng Loader OCR**: Trong danh sách hàng đợi, tất cả các trường dữ liệu (Số hiệu, Trích yếu...) của văn bản phải hiển thị hiệu ứng loader khi đang ở trạng thái `Đang OCR`.
    - *Files:* `upload.js`, `style.css`
- [x] **Multi-receiver selection**: Cho phép chọn nhiều người nhận điều phối cùng lúc thay vì chỉ chọn đơn lẻ.
    - *Files:* `DocumentRecord.cs`, `DocumentsController.cs`, `review.js`, `upload.js`
- [x] **Multi-department selection**: Cho phép chọn nhiều phòng ban cùng lúc để cùng phối hợp xử lý.
    - *Files:* `DocumentRecord.cs`, `DatabaseService.cs`, `review.js`, `upload.js`
- [x] **UI Danh sách Cán bộ**: Hiển thị tên Cán bộ kèm tên Phòng ban trong danh sách chọn (ví dụ: "Nguyễn Văn A - Phòng Kinh tế") để dễ phân biệt.
    - *Files:* `review.js`, `upload.js`
- [x] **Logic bóc tách phòng ban**: Tự động trích xuất tên phòng ban và đề xuất toàn bộ cán bộ thuộc phòng đó làm trạng thái khởi tạo (Init state).
    - *Files:* `DocumentExtractorService.cs`, `upload.js`
- [x] **Xếp hạng điều phối (Ranking)**: Sắp xếp danh sách gợi ý từ trên xuống dựa trên dữ liệu thực tế bóc tách được từ văn bản.
    - *Files:* `DocumentExtractorService.cs`, `upload.js`
- [x] **Quyền điều chỉnh của Văn thư**: Cho phép văn thư linh hoạt chỉnh sửa, thêm/bớt người nhận trước khi lưu chính thức.
    - *Files:* `review.js`, `upload.js`
- [x] **Gỡ bỏ ràng buộc lưu**: Cho phép lưu văn bản ngay cả khi chưa chọn phòng ban/cán bộ.
    - *Files:* `upload.js`
- [x] **Giao diện bảng rà soát**: Cập nhật UI bảng hàng loạt để hỗ trợ chọn nhiều người và hiển thị chỉ báo gợi ý thông minh.
    - *Files:* `upload.html`, `upload.js`
- [x] **Logic nút Lưu toàn bộ**: Chỉ hiển thị nút "Lưu toàn bộ" khi có từ 2 file văn bản trở lên trong danh sách hàng đợi.
    - *Files:* `upload.js`
- [x] **Cập nhật Icon Modal**: Thay đổi icon Lucide phù hợp cho nút `Lưu` (như `check` hoặc `save`) trong các modal rà soát để tăng tính thẩm mỹ.
    - *Files:* `review-side-by-side.html`
- [x] **Format ngày hiển thị**: Thay đổi định dạng ngày hiển thị trong các modal, page thành dd/MM/yyyy như 24/12/2026.
    - *Files:* `review-side-by-side.html`
---

## Todo list phase sau

### 🧠 THUẬT TOÁN ĐÁNH GIÁ ĐỘ TIN CẬY (CONFIDENCE SCORING)
- *Files chính:* `DocumentExtractorService.cs`, `upload.js`, `DatabaseService.cs`

1. **Bộ lọc Hợp lệ dữ liệu (Validation Filters)**:
    - **Số hiệu**: Kiểm tra định dạng Regex chuẩn (ví dụ: `.../UBND-...`).
    - **Logic Thời gian**: Ngày ban hành ≤ Hiện tại < Hạn xử lý.
    - **Độ dài Trích yếu**: Đủ độ dài (>30 ký tự) và sạch (không rác OCR).

2. **Cơ chế Phát hiện Mâu thuẫn (Conflict Detection)**:
    - **Mâu thuẫn Phòng ban**: Tên phòng bóc trong văn bản ≠ Phòng ban gợi ý theo Keyword.

3. **Thanh chỉ số tin cậy (Confidence Bar)**:
    - Hiển thị ⭐⭐⭐ và highlight đỏ các trường điểm thấp trong `upload.js`.

4. **Kiểm tra trùng lặp (Duplication Check)**:
    - Cảnh báo nếu `SoVanBan` đã tồn tại trong `DatabaseService.cs`.

