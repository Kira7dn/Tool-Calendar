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
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export function MeetingDetail({ meeting, onBack }) {
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
        <Button className="bg-[#c8102e] hover:bg-[#a50e27] text-white">
          <ArrowLeft size={16} className="mr-2 rotate-180" />
          Xem diễn biến
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          {/* Main Title Area */}
          <div className="text-center mb-8 relative">
            <h2 className="text-xl md:text-2xl font-bold text-[#1a202c] leading-snug uppercase mb-4 px-12">
              {meeting.title ||
                'HỘI NGHỊ SƠ KẾT ĐÁNH GIÁ KẾT QUẢ 6 THÁNG ĐẦU NĂM VỀ TRIỂN KHAI NGHỊ QUYẾT SỐ 57-NQ/TW, NGÀY 22/12/2024 CỦA BỘ CHÍNH TRỊ VỀ ĐỘT PHÁ PHÁT TRIỂN KHOA HỌC, CÔNG NGHỆ, ĐỔI MỚI SÁNG TẠO VÀ CHUYỂN ĐỔI SỐ QUỐC GIA VÀ QUYẾT ĐỊNH SỐ 204-QĐ/TW, NGÀY 29/11/2024 CỦA BAN BÍ THƯ VỀ PHÊ DUYỆT ĐỀ ÁN CHUYỂN ĐỔI SỐ TRONG CÁC CƠ QUAN ĐẢNG TRÊN ĐỊA BÀN PHƯỜNG'}
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-2">Thời gian: 06/07/2026 08:00 - 11:30</span>
              <span className="flex items-center gap-2">
                Phòng họp: Phòng Họp Tầng 2 - Trụ sở Đảng ủy phường Cẩm Phả
              </span>
            </div>

            {/* Floating Action Button (Red Chat Icon) on the right edge */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden lg:block">
              <button className="w-10 h-10 bg-white border border-[#c8102e] text-[#c8102e] rounded-l-xl flex items-center justify-center hover:bg-red-50 shadow-sm relative right-[-1px]">
                <MessageSquare size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {/* 1. Thông tin chi tiết phiên họp */}
            <AccordionSection title="Thông tin chi tiết phiên họp" defaultOpen={true}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Chủ trì:</span>
                  <span className="font-semibold text-gray-900">
                    Đồng chí Phạm Lê Hưng - Chủ tịch HĐND, Bí thư Đảng ủy phường Cẩm Phả
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Thời gian còn lại:</span>
                  <span className="font-semibold text-gray-900">Hết thời gian!</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Địa điểm họp:</span>
                  <span className="font-semibold text-[#c8102e]">
                    Phòng Họp Tầng 2 - Trụ sở Đảng ủy phường Cẩm Phả
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
                    Đang diễn ra
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-[140px] shrink-0">Kết luận phiên họp:</span>
                  <span className="font-semibold text-gray-900">-</span>
                </div>
              </div>
            </AccordionSection>

            {/* 2. Nội dung họp */}
            <AccordionSection title="Nội dung họp" count={2} defaultOpen={true}>
              <div className="space-y-4">
                {/* Meeting Item 1 */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <h4 className="text-[15px] font-bold text-[#1a202c] leading-snug flex-1">
                      Hội nghị đánh giá kết quả 6 tháng đầu năm về triển khai Nghị quyết số
                      57-NQ/TW, ngày 22/12/2024 của Bộ Chính trị về đột phá phát triển khoa học,
                      công nghệ, đổi mới sáng tạo và chuyển đổi số quốc gia và Quyết định số
                      204-QĐ/TW, ngày 29/11/2024 của Ban Bí thư về phê duyệt Đề án Chuyển đổi số
                      trong các cơ quan đảng theo giấy mời số 52-GM/VPTU ngày 02/7/2026 của Văn
                      phòng Tỉnh ủy Quảng Ninh (bằng hình thức trực tuyến từ Tỉnh)
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
                      <span className="font-semibold text-gray-900">-</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-[130px]">Thời gian:</span>
                      <span className="font-semibold text-gray-900">-</span>
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
                        Đang họp
                      </span>
                    </div>
                  </div>

                  {/* Documents List */}
                  <div className="mb-4">
                    <h5 className="text-[13px] font-bold text-[#1a202c] mb-2">
                      Danh sách tài liệu:
                    </h5>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-[13px]">
                        <FileText size={16} className="text-red-500 shrink-0" />
                        <span className="font-medium text-[#1a202c] truncate">
                          1. Báo_cáo_6 tháng 2026-3.7 VH_daky.pdf
                        </span>
                        <button className="text-gray-400 hover:text-[#c8102e] ml-1">
                          <Download size={14} />
                        </button>
                      </li>
                      <li className="flex items-center gap-2 text-[13px]">
                        <FileIcon size={16} className="text-blue-500 shrink-0" />
                        <span className="font-medium text-[#1a202c] truncate">
                          2. Phu luc kem theo Bao cao 6 thang.docx
                        </span>
                        <button className="text-gray-400 hover:text-[#c8102e] ml-1">
                          <Download size={14} />
                        </button>
                      </li>
                    </ul>
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
    </div>
  )
}
