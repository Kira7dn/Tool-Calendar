const fs = require('fs');
const content = `\n### [2026-08-05 23:38] Refactor Giai đoạn 2: Xóa bỏ truyền Auth Token thủ công (Documents & Cabinet)
- **Mô tả**: Loại bỏ hoàn toàn việc lấy auth_token từ localStorage và truyền vào header cho fetch API ở các module Documents và Cabinet, tận dụng triệt để Global Fetch Interceptor nhằm đơn giản hóa code và tăng tính bảo mật.
- **Tệp thay đổi**:
  - Các file thuộc \`ToolCalendar.Api/ClientApp/src/documents/\` (Sửa đổi)
  - Các file thuộc \`ToolCalendar.Api/ClientApp/src/cabinet/\` (Sửa đổi)
- **Lệnh git commit**: \`git commit -m "refactor(api): xóa bỏ truyền auth token thủ công trong requests"\`
`;
fs.appendFileSync('COMMIT_LOG.md', content);
