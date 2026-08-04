const fs = require('fs')

const path = '/Users/macbookpro/Tool-Calendar/ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx'
let content = fs.readFileSync(path, 'utf8')

// Fix the title area
content = content.replace(
  /\{meeting\.title \|\|[\s\S]*?'HỘI NGHỊ SƠ KẾT.*\}<\/h2>/m,
  '{meeting.title || \'KHÔNG CÓ TIÊU ĐỀ\'}</h2>'
)

// Add a helper for date parsing if needed, but we can do it inline
const inlineTimeHelper = `
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
  }
`
content = content.replace(
  'if (!meeting) return null',
  `${inlineTimeHelper}\n  if (!meeting) return null`
)

content = content.replace(
  'Thời gian: 06/07/2026 08:00 - 11:30',
  'Thời gian: {formatDateTime(meeting.startTime)} - {formatTimeOnly(meeting.endTime)}'
)
content = content.replace(
  'Phòng họp: Phòng Họp Tầng 2 - Trụ sở Đảng ủy phường Cẩm Phả',
  'Phòng họp: {meeting.roomName || meeting.location || \'Chưa cập nhật\'}'
)

// Info section
content = content.replace(
  /Đồng chí Phạm Lê Hưng - Chủ tịch HĐND, Bí thư Đảng ủy phường Cẩm Phả/g,
  '{meeting.presider || \'Chưa cập nhật\'}'
)

content = content.replace(
  /<span className="font-semibold text-gray-900">Hết thời gian!<\/span>/g,
  '<span className="font-semibold text-gray-900">{new Date(meeting.endTime) < new Date() ? \'Hết thời gian\' : \'Đang diễn ra\'}</span>'
)

content = content.replace(
  /<span className="font-semibold text-\[#c8102e\]">\s*Phòng Họp Tầng 2 - Trụ sở Đảng ủy phường Cẩm Phả\s*<\/span>/g,
  '<span className="font-semibold text-[#c8102e]">{meeting.location || meeting.roomName || \'Chưa cập nhật\'}</span>'
)

content = content.replace(
  /<span className="px-2\.5 py-0\.5 bg-\[#e6fcf5\].*?>\s*Đang diễn ra\s*<\/span>/g,
  '<span className="px-2.5 py-0.5 bg-[#e6fcf5] text-[#059669] text-xs font-semibold rounded-md border border-[#a7f3d0]">{meeting.status}</span>'
)

// Accordion Nội dung họp
content = content.replace(
  /<AccordionSection title="Nội dung họp" count=\{2\} defaultOpen=\{true\}>/g,
  '<AccordionSection title="Nội dung họp" count={1} defaultOpen={true}>'
)

content = content.replace(
  /Hội nghị đánh giá kết quả 6 tháng đầu năm về triển khai Nghị quyết số\s*57-NQ\/TW, ngày 22\/12\/2024 của Bộ Chính trị về đột phá phát triển khoa học,\s*công nghệ, đổi mới sáng tạo và chuyển đổi số quốc gia và Quyết định số\s*204-QĐ\/TW, ngày 29\/11\/2024 của Ban Bí thư về phê duyệt Đề án Chuyển đổi số\s*trong các cơ quan đảng theo giấy mời số 52-GM\/VPTU ngày 02\/7\/2026 của Văn\s*phòng Tỉnh ủy Quảng Ninh \(bằng hình thức trực tuyến từ Tỉnh\)/g,
  '{meeting.content || meeting.title || \'Chưa cập nhật nội dung\'}'
)

content = content.replace(
  /<span className="text-gray-500 w-\[130px\]">Người chuẩn bị tài liệu:<\/span>\s*<span className="font-semibold text-gray-900">-<\/span>/g,
  '<span className="text-gray-500 w-[130px]">Người chuẩn bị tài liệu:</span><span className="font-semibold text-gray-900">{meeting.preparingUnit || \'-\'}</span>'
)

content = content.replace(
  /<span className="text-gray-500 w-\[130px\]">Thời gian:<\/span>\s*<span className="font-semibold text-gray-900">-<\/span>/g,
  '<span className="text-gray-500 w-[130px]">Thời gian:</span><span className="font-semibold text-gray-900">{formatDateTime(meeting.startTime)}</span>'
)

content = content.replace(
  /<span className="text-gray-500 w-\[130px\]">Trạng thái:<\/span>\s*<span className="px-2\.5 py-0\.5 bg-\[#e6fcf5\].*?>\s*Đang họp\s*<\/span>/g,
  '<span className="text-gray-500 w-[130px]">Trạng thái:</span><span className="px-2.5 py-0.5 bg-[#e6fcf5] text-[#059669] text-xs font-semibold rounded-md border border-[#a7f3d0]">{meeting.status}</span>'
)

// Sổ tay
content = content.replace(
  /\{meeting\.title \|\|[\s\S]*?'Hội nghị sơ kết.*'\}/m,
  '{meeting.title || \'KHÔNG CÓ TIÊU ĐỀ\'}'
)

fs.writeFileSync(path, content)
