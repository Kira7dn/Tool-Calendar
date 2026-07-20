---
trigger: always_on
description: "Quy tắc kiến trúc Frontend React — Global Fetch Interceptor, Tailwind v4, shadcn/ui."
---

# TC-RULE-FRONTEND-ARCHITECTURE

Quy tắc này định nghĩa các ràng buộc bắt buộc cho layer Frontend React của Tool-Calendar.

## 1. HTTP Client — Chỉ dùng `fetch` Native

> [!IMPORTANT]
> Dự án này KHÔNG dùng Axios. Mọi API call phải dùng `fetch` native với Global Fetch Interceptor đã được thiết lập trong `main.jsx`.

### Global Fetch Interceptor (đã có trong `main.jsx`)

Interceptor xử lý tự động:
- **Unwrap response**: Tự động lấy `.data` từ `ApiResponse<T>`.
- **Error handling**: Tự động xử lý lỗi 401 (redirect login), 403, 500.
- **Token injection**: Tự động thêm `Authorization: Bearer <token>` header.

### Cách gọi API đúng:
```js
// ✅ Chỉ cần gọi fetch — interceptor lo phần còn lại
const data = await fetch('/api/documents').then(r => r.json());

// ✅ POST với body
const result = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData
}).then(r => r.json());
```

### Cách sai:
```js
// ❌ Không dùng Axios
import axios from 'axios';
axios.get('/api/documents');

// ❌ Không tự thêm Authorization header thủ công (interceptor đã làm)
fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
```

---

## 2. Styling — Tailwind CSS v4 + shadcn/ui

### Quy tắc:
- Dùng **Tailwind CSS v4** classes — cú pháp v4 khác v3 (không có `tailwind.config.js`, dùng `@import "tailwindcss"` trong CSS).
- Dùng **shadcn/ui** components cho UI elements chuẩn (Button, Dialog, Table, Badge, Select...).
- **Không** viết CSS custom inline style cho những gì Tailwind hoặc shadcn đã có.
- Màu sắc dùng CSS custom properties của shadcn (`bg-primary`, `text-muted-foreground`...) — không hardcode hex.

### Responsive:
- Mobile-first: `sm:`, `md:`, `lg:` breakpoints.
- Kiểm tra trên cả Mobile và Desktop trước khi hoàn thành.

---

## 3. State Management

- Dùng **React hooks** (`useState`, `useEffect`, `useContext`) cho local và shared state.
- Không thêm Redux/Zustand/Jotai mà không hỏi Developer — thay đổi kiến trúc lớn.
- Auth state quản lý qua `localStorage` (token) và React Context.

---

## 4. Code Quality Rules (ESLint enforced)

Các quy tắc sau được enforce bởi ESLint hook (xem `eslint.config.js`):

| Rule | Mô tả |
|---|---|
| `===` bắt buộc | Không dùng `==` cho so sánh |
| No `var` | Chỉ dùng `const` và `let` |
| No `eval()` | Cấm tuyệt đối |
| No `console.log` | Xóa trước commit — dùng proper error handling |
| No `debugger` | Xóa trước commit |
| React `key` prop | Bắt buộc trong list render |
| Rules of Hooks | Không gọi hook trong điều kiện/vòng lặp |

---

## 5. Component Structure

```jsx
// ✅ Component chuẩn
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DocumentList() {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(setDocuments);
  }, []);

  return (
    <div className="space-y-4">
      {documents.map(doc => (
        <div key={doc.id} className="...">
          {/* ... */}
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Build & Dev Server

```bash
# Dev (trong ToolCalendar.Api/ClientApp/)
npm run dev

# Build production (chỉ khi cần deploy)
npm run build
# Output vào ../wwwroot/ — ASP.NET Core serve static files từ đây
```

---
**Status:** ACTIVE  
**Priority:** LEVEL 1 — Ràng buộc kiến trúc cứng