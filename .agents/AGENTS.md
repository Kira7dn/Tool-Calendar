# Cấu hình Đặc quyền và Nguyên tắc Hoạt động cho Agent (Workspace Customization)

## Quy tắc Ghi log và Phân tích Hệ thống
1. **Đọc tệp Tính năng Hệ thống**: Khi bắt đầu một phiên làm việc mới có liên quan đến việc thêm tính năng hoặc hiểu cấu trúc dự án, bạn **PHẢI** đọc tệp `SYSTEM_FEATURES.md` nằm ở thư mục gốc của dự án. Không quét lại toàn bộ mã nguồn trừ khi tính năng đó không được mô tả chi tiết trong tệp trên.
2. **Cập nhật Nhật ký Mã Nguồn (Commit Log)**: Khi bạn thực hiện bất kỳ cập nhật tính năng, vá lỗi (bug fix) hay chỉnh sửa mã nguồn nào, bạn **PHẢI** tự động cập nhật tệp `COMMIT_LOG.md` nằm ở thư mục gốc. Việc cập nhật bao gồm:
   - Ngày giờ thực hiện.
   - Nội dung thay đổi (tính năng mới, sửa lỗi, cập nhật logic).
   - Danh sách các tệp bị ảnh hưởng.
   - Lệnh git commit (nếu có).
3. Tôn trọng việc tối ưu hóa token. Ưu tiên đọc `COMMIT_LOG.md` và `SYSTEM_FEATURES.md` thay vì dùng các công cụ tìm kiếm trên toàn bộ mã nguồn cho các luồng câu hỏi tổng quan.
