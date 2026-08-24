---
trigger: always_on
description: "Quy tắc kiến trúc Frontend React — Bulletproof React Feature-Driven, Global Fetch Interceptor, Tailwind v4, shadcn/ui."
---

# TC-RULE-FRONTEND-ARCHITECTURE

Quy tắc này định nghĩa các ràng buộc bắt buộc cho layer Frontend React của Tool-Calendar.

---

## 1. Kiến trúc Thư mục — Bulletproof React (Feature-Driven)

> [!IMPORTANT]
> Dự án áp dụng **Bulletproof React** (Feature-Driven Architecture). Mọi code mới phải tuân theo cấu trúc này. TUYỆT ĐỐI không tạo file component/hook trực tiếp ở `src/` root.

### Cấu trúc chuẩn

```
src/
├── components/              ← Shared UI (dùng toàn app, không thuộc feature nào)
│   ├── ui/                  ← shadcn/ui components (Button, Dialog, Badge...)
│   └── dashboard/           ← Shared dashboard widgets
├── constants/               ← App-wide constants (roles, document status...)
├── features/                ← ✅ TRUNG TÂM — Mọi tính năng đều nằm ở đây
│   ├── documents/           ← Feature: Quản lý công văn
│   │   ├── api/             ← API calls (documentApi.js)
│   │   ├── components/      ← UI components của feature (ReviewModal, UploadDropzone)
│   │   ├── hooks/           ← Custom hooks (useSaveAll, useBulkSelect, useDocumentUpload)
│   │   ├── routes/          ← Page-level components (Dashboard, Documents, DocDetail...)
│   │   │   └── DocDetail/
│   │   │       ├── components/  ← Sub-components của page (DocModals, DocComments...)
│   │   │       └── hooks/       ← Page-specific hooks (useDocDetail)
│   │   ├── constants/       ← Feature-specific constants
│   │   └── types/           ← TypeScript types (nếu dùng)
│   ├── notifications/       ← Feature: Thông báo
│   │   ├── components/      ← NotifAvatar, NotificationList
│   │   └── hooks/           ← useNotifications
│   └── tasks/               ← Feature: Nhiệm vụ cán bộ
│       ├── components/      ← EvidenceModal
│       └── hooks/           ← useMyTasks
├── hooks/                   ← Global hooks (dùng nhiều features)
├── lib/                     ← Utilities (utils, constants, signalr, push-notifications)
├── pages/                   ← Non-feature pages (Login, Users, Settings)
└── shell/                   ← App layout (AppShell, Sidebar, NotifPanel, UserMenu)
```

### Quy tắc đặt file

| Loại code | Vị trí đúng | Ví dụ |
|---|---|---|
| API calls cho 1 feature | `features/<name>/api/` | `documentApi.js` |
| Hook chỉ dùng trong 1 feature | `features/<name>/hooks/` | `useSaveAll.js` |
| Component chỉ dùng trong 1 feature | `features/<name>/components/` | `ReviewModal.jsx` |
| Page (route level) | `features/<name>/routes/` | `Dashboard.jsx`, `Documents.jsx` |
| Sub-components của 1 page | `features/<name>/routes/<Page>/components/` | `DocModals.jsx` |
| Hook riêng cho 1 page | `features/<name>/routes/<Page>/hooks/` | `useDocDetail.js` |
| Component dùng ở nhiều features | `components/` | `ErrorState.jsx` |
| Hook dùng ở nhiều features | `hooks/` | `useDebounce.js` |
| Layout toàn app | `shell/` | `AppShell.jsx`, `Sidebar.jsx` |

### ❌ KHÔNG làm

```
src/components/DocumentUploadModal.jsx    ← Sai: thuộc features/documents/
src/hooks/useDocumentList.js              ← Sai: thuộc features/documents/hooks/
src/documents/pages/Upload.jsx            ← Sai: legacy, đã xóa
```

---

## 2. Quy tắc Kích thước Component (Lines of Code)

> [!WARNING]
> Vi phạm giới hạn dòng = phải refactor ngay, không được merge.

| Ngưỡng | Hành động |
|---|---|
| ≤ 250 dòng | ✅ Lý tưởng |
| 251–400 dòng | 🟡 Cân nhắc tách |
| > 400 dòng | 🔴 BẮT BUỘC phải tách |
| > 500 dòng | 🚨 KHÔNG CHẤP NHẬN — tách ngay |

---

## 3. Chiến lược Tách Component (Container–Presentational Pattern)

### Bước 1: Tách Logic → Custom Hook

```js
// ✅ Tách tất cả state + API + side effects ra hook riêng
// features/documents/hooks/useDocumentList.js
export function useDocumentList() {
  const [docs, setDocs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    fetch('/api/documents').then(r => r.json()).then(setDocs)
      .finally(() => setIsLoading(false))
  }, [])
  
  return { docs, isLoading }
}
```

### Bước 2: Page chỉ còn UI

```jsx
// ✅ Page component chỉ có JSX — không có fetch, không có business logic
export function Documents() {
  const { docs, isLoading } = useDocumentList()
  return <DocumentTable docs={docs} isLoading={isLoading} />
}
```

### Bước 3: Tách Modal/Panel thành component riêng

```
features/documents/routes/DocDetail/
  components/
    DocModals.jsx        → Tách thành: AssignModal.jsx, EvidenceModal.jsx, ForwardModal.jsx
    DocComments.jsx      ← Đã đúng
    DocOverviewTab.jsx   ← Đã đúng
```

---

## 4. HTTP Client — Chỉ dùng `fetch` Native

> [!IMPORTANT]
> Dự án này KHÔNG dùng Axios. Mọi API call phải dùng `fetch` native với Global Fetch Interceptor đã được thiết lập trong `main.jsx`.

Interceptor xử lý tự động:
- **Token injection**: Tự động thêm `Authorization: Bearer <token>` header.
- **Error handling**: Tự động xử lý lỗi 401 (redirect login), 403, 500.

```js
// ✅ ĐÚNG — interceptor lo hết
const data = await fetch('/api/documents').then(r => r.json())

// ❌ SAI — không tự thêm header
fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })

// ❌ SAI — không dùng Axios
import axios from 'axios'
```

---

## 5. Styling — Tailwind CSS v4 + shadcn/ui

- Dùng **Tailwind CSS v4** — không có `tailwind.config.js`, dùng `@import "tailwindcss"`.
- Dùng **shadcn/ui** components: `Button`, `Dialog`, `Table`, `Badge`, `Select`...
- Màu sắc dùng CSS custom properties: `bg-primary`, `text-muted-foreground` — không hardcode hex.
- Mobile-first: `sm:`, `md:`, `lg:` breakpoints.

---

## 6. State Management

- Dùng **React hooks** (`useState`, `useEffect`, `useContext`) — không Redux/Zustand.
- Auth state: `localStorage` (token) + React Context.

---

## 7. Code Quality (ESLint enforced)

| Rule | Mô tả |
|---|---|
| `===` bắt buộc | Không dùng `==` |
| No `var` | Chỉ `const` và `let` |
| No `console.log` | Xóa trước commit |
| No `debugger` | Xóa trước commit |
| React `key` prop | Bắt buộc trong list render |

---

## 8. Coding Convention: Magic Strings

```js
// ✅ ĐÚNG: Dùng Constants
export const DOCUMENT_STATUS = {
  CHUA_XU_LY: 'Chưa xử lý',
  DANG_XU_LY: 'Đang xử lý',
  HOAN_THANH: 'Hoàn thành',
}

// ❌ SAI: Hardcode string
if (status === 'Chưa xử lý') { ... }
```

---

## 9. Build & Dev Server

```bash
# Dev
cd ToolCalendar.Api/ClientApp && npm run dev

# Production build
npm run build  # Output → ../wwwroot/
```

---
**Status:** ACTIVE  
**Priority:** LEVEL 1 — Ràng buộc kiến trúc cứng  
**Last Updated:** 2026-08-08  
**Architecture Reference:** Bulletproof React (https://github.com/alan2207/bulletproof-react)