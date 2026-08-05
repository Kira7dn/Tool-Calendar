const fs = require('fs');
const path = require('path');

function fixCommas(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Remove lone commas in objects: { , } or { \n , \n }
  content = content.replace(/\{\s*,\s*\}/g, '{}');
  
  // Remove trailing commas in empty options: fetch(url, {\n  ,\n}) -> fetch(url, {})
  content = content.replace(/,\s*\}/g, '}');
  
  // Remove fetch(url, {}) -> fetch(url)
  content = content.replace(/,\s*\{\s*\}/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed commas in: ${filePath}`);
  }
}

const files = [
  'ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Documents.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/MyTasks.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Review.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Search.jsx',
  'ToolCalendar.Api/ClientApp/src/documents/pages/Upload.jsx'
];

files.forEach(f => fixCommas(path.resolve(f)));
