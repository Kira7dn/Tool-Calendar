/* eslint-disable */
import React, { useState } from 'react'
import {
  ArrowLeft,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Download,
  FileText,
  File as FileIcon,
  Eye,
  Book,
  CloudUpload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const AccordionSection = ({ title, count, children, defaultOpen = false, rightAction = null }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-center justify-between py-4 cursor-pointer hover:bg-gray-50 px-2 -mx-2 transition-colors rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#1a202c]">
            {title} {count !== undefined && `(${count})`}
          </h3>
          {rightAction && <div onClick={(e) => e.stopPropagation()}>{rightAction}</div>}
        </div>
        <button className="p-1 text-gray-500 hover:text-gray-700">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      {isOpen && <div className="pb-6 pt-2">{children}</div>}
    </div>
  )
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12">
    {/* SVG Illustration - similar to the image's tray */}
    <div className="relative mb-3">
      <svg
        width="80"
        height="80"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20 45L80 45" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 35H70" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <rect
          x="25"
          y="55"
          width="50"
          height="25"
          rx="2"
          fill="#E2E8F0"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        <path
          d="M35 55V40C35 37.2386 37.2386 35 40 35H60C62.7614 35 65 37.2386 65 40V55"
          fill="white"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        <rect x="42" y="42" width="16" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="42" y="48" width="10" height="3" rx="1.5" fill="#CBD5E1" />
        <circle cx="75" cy="25" r="12" fill="white" stroke="#94A3B8" strokeWidth="1.5" />
        <text x="75" y="28" fontSize="8" fill="#64748B" textAnchor="middle" fontWeight="bold">
          ADO
        </text>
      </svg>
    </div>
    <span className="text-sm font-semibold text-gray-600">Không có dữ liệu</span>
  </div>
)

export function MeetingDetail({ meeting, onBack, onViewProgress }) {
  const [isNotebookOpen, setIsNotebookOpen] = useState(false)

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  if (!meeting) return null

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-[#1a202c]">Thông tin phiên họp</h1>
        </div>
        <button
          className="bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-md flex items-center text-sm font-medium transition-colors"
          onClick={(e) => {
            console.log('Xem diễn biến clicked!', onViewProgress)
            if (onViewProgress) onViewProgress()
          }}
        >
          <ArrowLeft size={16} className="mr-2 rotate-180" />
          Xem diễn biến
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          {/* Main Title Area */}
          <div className="text-center mb-8 relative">
            <h2 className="text-xl md:text-2xl font-bold text-[#1a202c] leading-snug uppercase mb-4 px-12">
              {meeting.title || 'KHÔNG CÓ TIÊU ĐỀ'}
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-2">
                Thời gian: {formatDateTime(meeting.startTime)} - {formatTimeOnly(meeting.endTime)}
              </span>
              <span className="flex items-center gap-2">
                Phòng họp: {meeting.roomName || meeting.location || 'Chưa cập nhật'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {/* 1. Thông tin chi tiết phiên họp */}
            <AccordionSection title="Thông tin chi tiết phiên họp" defaultOpen={true}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Chủ trì:</span>
                  <span className="font-semibold text-gray-900">
                    {meeting.presider || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Thời gian còn lại:</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(meeting.endTime) < new Date() ? 'Hết thời gian!' : 'Đang diễn ra'}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Địa điểm họp:</span>
                  <span className="font-semibold text-[#c8102e]">
                    {meeting.roomName || meeting.location || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Thành phần tham gia:</span>
                  <button className="font-semibold text-[#c8102e] hover:underline">
                    Xem thành phần tham gia
                  </button>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Giấy mời họp:</span>
                  <a
                    href="#"
                    className="font-semibold text-[#c8102e] hover:underline truncate max-w-[250px]"
                  >
                    A49.50.01-VBNB_2026-GM-0197-2026_dak...
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Chương trình họp:</span>
                  <span className="font-semibold text-gray-900">-</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Phiếu mời:</span>
                  <span className="font-semibold text-gray-900">-</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Trạng thái phiên họp:</span>
                  <span className="px-2.5 py-0.5 bg-[#e6fcf5] text-[#059669] text-xs font-semibold rounded-md border border-[#a7f3d0]">
                    {meeting.status}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Kết luận phiên họp:</span>
                  <span className="font-semibold text-gray-900">-</span>
                </div>
              </div>
            </AccordionSection>

            {/* 2. Nội dung họp */}
            <AccordionSection title="Nội dung họp" count={1} defaultOpen={true}>
              <div className="space-y-4">
                {/* Meeting Item 1 */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <h4 className="text-[15px] font-bold text-[#1a202c] leading-snug flex-1">
                      {meeting.content || meeting.title || 'Chưa cập nhật nội dung'}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button className="bg-[#c8102e] hover:bg-[#a50e27] text-white h-8 text-xs font-semibold px-4 rounded-md">
                        Thêm góp ý
                      </Button>
                      <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-50">
                        <ChevronUp size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-[13px] mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Người chuẩn bị tài liệu:</span>
                      <span className="font-semibold text-gray-900">
                        {meeting.preparingUnit || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Thời gian:</span>
                      <span className="font-semibold text-gray-900">
                        {formatDateTime(meeting.startTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Người duyệt tài liệu:</span>
                      <span className="font-semibold text-gray-900">-</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Kết luận nội dung họp:</span>
                      <span className="font-semibold text-gray-900">-</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Thành phần tham gia:</span>
                      <button className="font-semibold text-[#c8102e] hover:underline">
                        Xem thành phần tham gia
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Trạng thái:</span>
                      <span className="px-2.5 py-0.5 bg-[#e6fcf5] text-[#059669] text-xs font-semibold rounded-md border border-[#a7f3d0]">
                        {meeting.status}
                      </span>
                    </div>
                  </div>

                  {/* Documents List */}
                  <div className="mb-4">
                    <h5 className="text-[13px] font-bold text-[#1a202c] mb-2">
                      Danh sách tài liệu:
                    </h5>
                    {meeting.documents && meeting.documents.length > 0 ? (
                      <ul className="space-y-2">
                        {meeting.documents.map((doc, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-[13px]">
                            <FileText size={16} className="text-red-500 shrink-0" />
                            <span className="font-medium text-[#1a202c] truncate">
                              {idx + 1}. {doc.name || 'Tài liệu'}
                            </span>
                            <button className="text-gray-400 hover:text-[#c8102e] ml-1">
                              <Download size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[13px] text-gray-500 italic">Chưa có tài liệu</div>
                    )}
                  </div>

                  {/* Audio list accordion (simulated) */}
                  <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50">
                    <span className="text-[13px] font-bold text-[#1a202c]">Danh sách ghi âm</span>
                    <ChevronDown size={16} className="text-gray-500" />
                  </div>
                </div>
              </div>
            </AccordionSection>

            {/* 3. Vấn đề biểu quyết */}
            <AccordionSection title="Danh sách vấn đề cần biểu quyết" count={0}>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-[13px] text-[#1a202c] font-bold bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center w-16">STT</th>
                      <th className="px-4 py-3">Nội dung</th>
                      <th className="px-4 py-3 w-1/4">Vấn đề</th>
                      <th className="px-4 py-3 text-center w-32">Trạng thái</th>
                      <th className="px-4 py-3 text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                </table>
                <EmptyState />
              </div>
            </AccordionSection>

            {/* 4. Đăng ký phát biểu */}
            <AccordionSection
              title="Danh sách đăng ký phát biểu"
              count={0}
              rightAction={
                <button className="text-gray-400 hover:text-gray-600 font-medium text-xl leading-none ml-2">
                  +
                </button>
              }
            >
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button className="flex-1 py-3 text-center font-bold text-sm text-[#c8102e] border-b-2 border-[#c8102e] bg-white">
                    Chờ phát biểu
                  </button>
                  <button className="flex-1 py-3 text-center font-bold text-sm text-gray-600 hover:bg-gray-50">
                    Bác bỏ
                  </button>
                </div>
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-[13px] text-[#1a202c] font-bold bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">STT</th>
                      <th className="px-4 py-3">Tên đại biểu</th>
                      <th className="px-4 py-3">Chức vụ</th>
                      <th className="px-4 py-3">Nội dung đăng ký</th>
                      <th className="px-4 py-3">Ghi chú</th>
                      <th className="px-4 py-3">Thời gian bắt đầu phát biểu</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                      <th className="px-4 py-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                </table>
                <EmptyState />
              </div>
            </AccordionSection>

            {/* 5. Góp ý */}
            <AccordionSection title="Danh sách tham gia góp ý (0) (Người góp ý: 0/14)">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-[13px] text-[#1a202c] font-bold bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center w-16">STT</th>
                      <th className="px-4 py-3">Tên đại biểu</th>
                      <th className="px-4 py-3 w-1/5">Chức vụ</th>
                      <th className="px-4 py-3 w-1/4">Góp ý cho nội dung</th>
                      <th className="px-4 py-3 w-1/5">Chi tiết góp ý</th>
                      <th className="px-4 py-3 text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                </table>
                <EmptyState />
              </div>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* Floating Notebook Button */}
      <div className="fixed right-0 top-[40%] z-40 flex items-center group cursor-pointer transition-transform translate-x-[calc(100%-3rem)] hover:translate-x-0">
        <button
          onClick={() => setIsNotebookOpen(true)}
          className="bg-white border-y border-l border-[#c8102e] rounded-l-full flex items-center shadow-md overflow-hidden h-12"
        >
          <div className="bg-[#c8102e] text-white w-9 h-9 flex items-center justify-center rounded-md ml-1.5 shrink-0">
            <Book size={18} />
          </div>
          <span className="text-[#c8102e] font-bold px-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Sổ tay
          </span>
        </button>
      </div>

      {/* Notebook Modal */}
      <Dialog open={isNotebookOpen} onOpenChange={setIsNotebookOpen}>
        <DialogContent className="max-w-[1000px] p-0 overflow-hidden gap-0 border-0 rounded-xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-white">
            <DialogTitle className="text-[#1a202c] text-xl font-bold">Sổ tay</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:flex-row bg-gray-50/50 p-6 gap-8 h-[70vh] overflow-y-auto">
            {/* Left Column - Meeting Info */}
            <div className="w-full md:w-2/5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-500">
                  Phiên họp <span className="text-red-500">*</span>
                </label>
                <div className="text-[13px] font-bold text-[#1a202c] leading-snug">
                  {meeting.title || 'KHÔNG CÓ TIÊU ĐỀ'}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-500">
                  Thời gian <span className="text-red-500">*</span>
                </label>
                <div className="text-[13px] font-bold text-[#1a202c]">
                  {formatDateTime(meeting.startTime)} - {formatTimeOnly(meeting.endTime)}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-500">
                  Phòng họp <span className="text-red-500">*</span>
                </label>
                <div className="text-[13px] font-bold text-[#1a202c]">
                  {meeting.roomName || meeting.location || 'Chưa cập nhật'}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-500">
                  Chủ trì <span className="text-red-500">*</span>
                </label>
                <div className="text-[13px] font-bold text-[#1a202c] leading-snug">
                  {meeting.presider || 'Chưa cập nhật'}
                </div>
              </div>

              <div className="pt-2">
                <table className="w-full text-sm text-left text-gray-600 border-b border-gray-200">
                  <thead className="text-[13px] text-[#1a202c] font-bold">
                    <tr>
                      <th className="pb-3 text-center w-16">STT</th>
                      <th className="pb-3 text-center">Nội dung ghi chú</th>
                      <th className="pb-3 text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                </table>
                <div className="mt-8 scale-90 origin-top">
                  <EmptyState />
                </div>
              </div>
            </div>

            {/* Right Column - Editor */}
            <div className="w-full md:w-3/5 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a202c]">
                  Ghi chú <span className="text-red-500">*</span>
                </label>
                <textarea className="w-full h-48 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#c8102e] resize-none"></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a202c]">Tài liệu đính kèm (0):</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg bg-white p-8 flex flex-col items-center justify-center text-center hover:bg-red-50/30 transition-colors cursor-pointer">
                  <CloudUpload size={32} className="text-[#c8102e] mb-3" />
                  <div className="text-sm text-gray-700 mb-1">
                    <span className="text-[#c8102e] font-semibold">Chọn file</span> hoặc Kéo thả từ
                    máy tính
                  </div>
                  <div className="text-xs text-gray-400">
                    Tối đa 50MB, định dạng .doc, .docx, .xls, .xlsx, .txt, .ppt, .pptx, .pdf
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsNotebookOpen(false)}
              className="text-[#c8102e] border-[#c8102e] hover:bg-red-50 font-semibold px-6 rounded-full"
            >
              Hủy bỏ
            </Button>
            <Button className="bg-[#c8102e] hover:bg-[#a50e27] text-white font-semibold px-6 rounded-full">
              Thêm mới
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
