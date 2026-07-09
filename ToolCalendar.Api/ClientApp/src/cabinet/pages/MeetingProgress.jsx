/* eslint-disable */
import React, { useState } from 'react'
import {
  ArrowLeft,
  UserCheck,
  Download,
  FileText,
  File as FileIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Book,
  ChevronRight,
  ListMusic,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 rounded-lg mb-3 bg-white overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="text-sm font-bold text-[#1a202c]">{title}</h4>
        <button className="text-gray-500">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {isOpen && <div className="p-4 pt-0 border-t border-gray-50">{children}</div>}
    </div>
  )
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12">
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

export function MeetingProgress({ meeting, onBack }) {
  const [activeContent, setActiveContent] = useState(1)

  if (!meeting) return null

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-[#1a202c]">Diễn biến phiên họp</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Banner */}
          <div className="bg-[#f0f4f8] rounded-xl p-6 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left flex-1">
              <h2 className="text-[15px] md:text-base font-bold text-[#1a202c] uppercase leading-snug mb-2 max-w-4xl">
                {meeting.title ||
                  'HỘI NGHỊ SƠ KẾT ĐÁNH GIÁ KẾT QUẢ 6 THÁNG ĐẦU NĂM VỀ TRIỂN KHAI NGHỊ QUYẾT SỐ 57-NQ/TW, NGÀY 22/12/2024 CỦA BỘ CHÍNH TRỊ VỀ ĐỘT PHÁ PHÁT TRIỂN KHOA HỌC, CÔNG NGHỆ, ĐỔI MỚI SÁNG TẠO VÀ CHUYỂN ĐỔI SỐ QUỐC GIA VÀ QUYẾT ĐỊNH SỐ 204-QĐ/TW, NGÀY 29/11/2024 CỦA BAN BÍ THƯ VỀ PHÊ DUYỆT ĐỀ ÁN CHUYỂN ĐỔI SỐ TRONG CÁC CƠ QUAN ĐẢNG RÊN ĐỊA BÀN PHƯỜNG'}
              </h2>
              <div className="text-sm font-semibold text-gray-600">
                Thời gian: 06/07/2026 08:00 - 11:30
              </div>
            </div>
            <Button className="bg-[#c8102e] hover:bg-[#a50e27] text-white shrink-0">
              <UserCheck size={16} className="mr-2" />
              Điểm danh
            </Button>
          </div>

          {/* Three Columns Layout */}
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[500px]">
            {/* Column 1: Nội dung họp */}
            <div className="w-full lg:w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-[#1a202c]">Nội dung họp</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <button
                  onClick={() => setActiveContent(1)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                    activeContent === 1
                      ? 'bg-[#c8102e] text-white font-semibold'
                      : 'bg-white border border-[#c8102e] text-[#c8102e] hover:bg-red-50 font-medium'
                  }`}
                >
                  <span>Nội dung 1</span>
                  {activeContent === 1 ? <ListMusic size={18} /> : <ChevronRight size={18} />}
                </button>
                <button
                  onClick={() => setActiveContent(2)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                    activeContent === 2
                      ? 'bg-[#c8102e] text-white font-semibold'
                      : 'bg-white border border-[#c8102e] text-[#c8102e] hover:bg-red-50 font-medium'
                  }`}
                >
                  <span>Nội dung 2</span>
                  {activeContent === 2 ? <ListMusic size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>
            </div>

            {/* Column 2: Chi tiết nội dung */}
            <div className="w-full lg:w-2/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1a202c] leading-snug mb-4">
                    Hội nghị đánh giá kết quả 6 tháng đầu năm về triển khai Nghị quyết số 57-NQ/TW,
                    ngày 22/12/2024 của Bộ Chính trị về đột phá phát triển khoa học, công nghệ, đổi
                    mới sáng tạo và chuyển đổi số quốc gia và Quyết định số 204-QĐ/TW, ngày
                    29/11/2024 của Ban Bí thư về phê duyệt Đề án Chuyển đổi số trong các cơ quan
                    đảng theo giấy mời số 52-GM/VPTU ngày 02/7/2026 của Văn phòng Tỉnh ủy Quảng Ninh
                    (bằng hình thức trực tuyến từ Tỉnh)
                  </h3>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-900 font-semibold w-20">Thời gian:</span>
                      <span className="text-gray-900">-</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-900 font-semibold w-20">Chủ trì:</span>
                      <span className="text-gray-900">
                        Đồng chí Phạm Lê Hưng - Chủ tịch HĐND, Bí thư Đảng ủy phường Cẩm Phả
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-semibold w-20">Trạng thái:</span>
                      <span className="px-2.5 py-0.5 bg-[#e6fcf5] text-[#059669] text-xs font-semibold rounded-md border border-[#a7f3d0]">
                        Đang họp
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Accordion title="Tài liệu đính kèm" defaultOpen={true}>
                    <ul className="space-y-3 pt-2">
                      <li className="flex items-center gap-2 text-[13px]">
                        <FileText size={18} className="text-red-500 shrink-0" />
                        <span className="font-medium text-[#1a202c] truncate flex-1">
                          1. Báo_cáo_6 tháng 2026-3.7 VH_daky.pdf
                        </span>
                        <button className="text-gray-400 hover:text-[#c8102e] p-1">
                          <Download size={16} />
                        </button>
                      </li>
                      <li className="flex items-center gap-2 text-[13px]">
                        <FileIcon size={18} className="text-blue-500 shrink-0" />
                        <span className="font-medium text-[#1a202c] truncate flex-1">
                          2. Phu luc kem theo Bao cao 6 thang.docx
                        </span>
                        <button className="text-gray-400 hover:text-[#c8102e] p-1">
                          <Download size={16} />
                        </button>
                      </li>
                    </ul>
                  </Accordion>

                  <Accordion title="File ghi âm" defaultOpen={false}>
                    <div className="py-2 text-sm text-gray-500">Không có file ghi âm</div>
                  </Accordion>
                </div>
              </div>
            </div>

            {/* Column 3: Chờ phát biểu */}
            <div className="w-full lg:w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-[#1a202c]">Danh sách chờ phát biểu (0)</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <Eye size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex items-center justify-center bg-gray-50/30">
                <EmptyState />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Notebook Button */}
      <div className="fixed right-0 top-[40%] z-40 flex items-center group cursor-pointer transition-transform translate-x-[calc(100%-3rem)] hover:translate-x-0">
        <button className="bg-white border-y border-l border-[#c8102e] rounded-l-full flex items-center shadow-md overflow-hidden h-12">
          <div className="bg-[#c8102e] text-white w-9 h-9 flex items-center justify-center rounded-md ml-1.5 shrink-0">
            <Book size={18} />
          </div>
          <span className="text-[#c8102e] font-bold px-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Sổ tay
          </span>
        </button>
      </div>
    </div>
  )
}
