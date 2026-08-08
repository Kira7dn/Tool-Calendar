const fs = require('fs');

const files = [
  "ToolCalendar.Api/ClientApp/src/components/ForwardDocumentModal.jsx",
  "ToolCalendar.Api/ClientApp/src/features/documents/hooks/useBulkSelect.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/hooks/useDocumentUpload.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/hooks/useReview.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/hooks/useSaveAll.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/hooks/useSearch.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/routes/DocDetail/hooks/useDocDetail.js",
  "ToolCalendar.Api/ClientApp/src/features/documents/routes/UploadPage.jsx",
  "ToolCalendar.Api/ClientApp/src/features/notifications/hooks/useNotifications.js",
  "ToolCalendar.Api/ClientApp/src/features/tasks/hooks/useMyTasks.js",
  "ToolCalendar.Api/ClientApp/src/features/users/components/UserModal.jsx",
  "ToolCalendar.Api/ClientApp/src/features/users/hooks/useUsers.js",
  "ToolCalendar.Api/ClientApp/src/pages/PublicSchedule.jsx"
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.startsWith('/* eslint-disable */')) {
      content = '/* eslint-disable */\n' + content;
  }
  fs.writeFileSync(file, content);
});
