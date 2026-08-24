# TC-RULE-MAGIC-STRINGS

Quy tắc này quy định việc sử dụng hằng số thay cho "Magic Strings" trong mã nguồn để đảm bảo dễ bảo trì và tránh sai sót chính tả.

## 1. Yêu cầu chung
- **Tuyệt đối không** sử dụng các chuỗi string trực tiếp (hardcode / magic strings) trong các lệnh so sánh (`if`, `switch`) hay dùng làm identifier (như tab name, status, role, permission).
- **Phải trích xuất** các giá trị chuỗi cố định ra các file `constants` tương ứng (ví dụ: `constants/meeting.js`, `constants/document.js`, `constants/task.js`...).

## 2. Các chuẩn định dạng
```javascript
// ✅ ĐÚNG: Nhóm các giá trị liên quan thành Object và viết HOA tên biến
export const DOCUMENT_STATUS = {
  CHUA_XU_LY: 'Chưa xử lý',
  DANG_XU_LY: 'Đang xử lý',
  DA_HOAN_THANH: 'Đã hoàn thành',
  HOAN_THANH: 'hoàn thành'
};

// ❌ SAI: Hardcode string trực tiếp
if (task.status === 'Đang xử lý') { ... }
```

## 3. Quá trình kiểm duyệt
AI Agent và Developer trước khi commit mã nguồn chứa so sánh chuỗi cần tự xem xét liệu chuỗi này có khả năng được sử dụng lại ở những chỗ khác không. Nếu có, bắt buộc phải di chuyển nó vào thư mục `constants`.

---
**Status:** ACTIVE  
**Priority:** LEVEL 2 — Best Practice Coding Standard
