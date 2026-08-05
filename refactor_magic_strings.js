const fs = require('fs');
const path = require('path');

const filesToRefactor = [
  'ToolCalendar.Api/ClientApp/src/documents/pages/Review.jsx',
  'ToolCalendar.Api/ClientApp/src/pages/Users.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocModals.jsx',
  'ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Dashboard.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Upload.jsx',
  'ToolCalendar.Api/ClientApp/src/components/settings/AuditTab.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Documents.jsx',
  'ToolCalendar.Api/ClientApp/src/shell/Sidebar.jsx',
  'ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocHistoryTab.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocRoutingTab.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocOverviewTab.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail.jsx',
  'ToolCalendar.Api/ClientApp/src/components/DocumentRoutingTree.jsx'
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('Skipping missing file: ' + filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace ROLES
  const roleReplacements = {
    "'Admin'": "ROLES.ADMIN",
    '"Admin"': "ROLES.ADMIN",
    "'CanBo'": "ROLES.CAN_BO",
    '"CanBo"': "ROLES.CAN_BO",
    "'VanThu'": "ROLES.VAN_THU",
    '"VanThu"': "ROLES.VAN_THU",
    "'LanhDao'": "ROLES.LANH_DAO",
    '"LanhDao"': "ROLES.LANH_DAO"
  };

  const statusReplacements = {
    "'Chưa xử lý'": "DOCUMENT_STATUS.CHUA_XU_LY",
    '"Chưa xử lý"': "DOCUMENT_STATUS.CHUA_XU_LY",
    "'Đang xử lý'": "DOCUMENT_STATUS.DANG_XU_LY",
    '"Đang xử lý"': "DOCUMENT_STATUS.DANG_XU_LY",
    "'Đã hoàn thành'": "DOCUMENT_STATUS.DA_HOAN_THANH",
    '"Đã hoàn thành"': "DOCUMENT_STATUS.DA_HOAN_THANH",
    "'Đã xử lý'": "DOCUMENT_STATUS.DA_HOAN_THANH", // Treat as DA_HOAN_THANH for routing ? No wait, don't replace 'Đã xử lý' unless defined
    "'Lỗi OCR'": "DOCUMENT_STATUS.LOI_OCR",
    '"Lỗi OCR"': "DOCUMENT_STATUS.LOI_OCR"
  };

  const priorityReplacements = {
    "'Thường'": "DOCUMENT_PRIORITY.THUONG",
    '"Thường"': "DOCUMENT_PRIORITY.THUONG",
    "'Khẩn'": "DOCUMENT_PRIORITY.KHAN",
    '"Khẩn"': "DOCUMENT_PRIORITY.KHAN",
    "'Hỏa tốc'": "DOCUMENT_PRIORITY.HOA_TOC",
    '"Hỏa tốc"': "DOCUMENT_PRIORITY.HOA_TOC"
  };

  let hasRoles = false;
  let hasStatus = false;
  let hasPriority = false;

  for (const [key, value] of Object.entries(roleReplacements)) {
    if (content.includes(key)) {
      content = content.split(key).join(value);
      hasRoles = true;
    }
  }

  for (const [key, value] of Object.entries(statusReplacements)) {
    if (content.includes(key)) {
      content = content.split(key).join(value);
      hasStatus = true;
    }
  }

  for (const [key, value] of Object.entries(priorityReplacements)) {
    if (content.includes(key)) {
      content = content.split(key).join(value);
      hasPriority = true;
    }
  }

  // Inject imports if needed
  if (hasRoles && !content.includes('import { ROLES }')) {
    // Determine path level
    const depth = filePath.split('/').length - 4; // ToolCalendar.Api/ClientApp/src is depth 0
    const relativePrefix = depth === 0 ? './' : '../'.repeat(depth);
    content = `import { ROLES } from '${relativePrefix}constants/roles'\n` + content;
  }

  if (hasStatus && !content.includes('DOCUMENT_STATUS')) {
    const depth = filePath.split('/').length - 4;
    const relativePrefix = depth === 0 ? './' : '../'.repeat(depth);
    content = `import { DOCUMENT_STATUS } from '${relativePrefix}constants/document'\n` + content;
  }
  
  if (hasPriority && !content.includes('DOCUMENT_PRIORITY')) {
    const depth = filePath.split('/').length - 4;
    const relativePrefix = depth === 0 ? './' : '../'.repeat(depth);
    // If we already imported DOCUMENT_STATUS, we can just add DOCUMENT_PRIORITY
    if (content.includes(`import { DOCUMENT_STATUS } from '${relativePrefix}constants/document'`)) {
      content = content.replace(
        `import { DOCUMENT_STATUS } from '${relativePrefix}constants/document'`,
        `import { DOCUMENT_STATUS, DOCUMENT_PRIORITY } from '${relativePrefix}constants/document'`
      );
    } else {
      content = `import { DOCUMENT_PRIORITY } from '${relativePrefix}constants/document'\n` + content;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`Refactored ${filePath}`);
}

filesToRefactor.forEach(processFile);
