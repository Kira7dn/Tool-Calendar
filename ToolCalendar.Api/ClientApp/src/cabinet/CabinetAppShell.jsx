/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Home,
  Users,
  MapPin,
  Bell,
  Menu,
  User,
  ChevronDown,
  Building2,
  UserCheck,
  ArrowLeft,
  FileText,
  ClipboardList,
  Settings,
  BookOpen,
  ShieldCheck,
  MessageSquare,
  List,
  Search,
  MoreVertical,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CabinetHome } from './pages/CabinetHome'
import { CabinetSchedule } from './pages/CabinetSchedule'
import { CabinetRooms } from './pages/CabinetRooms'
import { CabinetQuestionnaire } from './pages/CabinetQuestionnaire'
import { CabinetMeetings } from './pages/CabinetMeetings'

// ─── Logo Block ────────────────────────────────────────────────────────────────
function CabinetLogo({ onClick }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 h-full border-r border-[#a50e27] min-w-[200px] cursor-pointer shrink-0"
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-sm bg-[#da020b] flex items-center justify-center border border-yellow-400 shrink-0">
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect width="36" height="36" fill="#da020b" />
          <polygon
            points="18,4 21.5,14.5 32,14.5 23.5,21 26.5,32 18,25.5 9.5,32 12.5,21 4,14.5 14.5,14.5"
            fill="#ffda00"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-sm text-white">iCPV Cabinet</span>
        <span className="text-[10px] text-red-200">Phòng họp không giấy</span>
      </div>
    </div>
  )
}

// ─── Main Shell ────────────────────────────────────────────────────────────────
export function CabinetAppShell() {
  // Active nav tab (top bar)
  const [activeNav, setActiveNav] = useState('home')
  // Active sidebar item — for schedule tabs
  const [activeSidebar, setActiveSidebar] = useState(0)
  // User info from localStorage
  const [userName, setUserName] = useState('Người dùng')

  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUserName(
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
            payload.unique_name ||
            payload.sub ||
            'Người dùng'
        )
      }
    } catch {
      /* silent */
    }
  }, [])

  // ── Top navigation items ────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'Trang chủ' },
    { id: 'schedule', icon: Calendar, label: 'Lịch họp' },
    { id: 'manage_meetings', icon: MessageSquare, label: 'Quản lý họp' },
    { id: 'rooms', icon: MapPin, label: 'Phòng họp' },
    { id: 'questionnaire', icon: ClipboardList, label: 'Phiếu lấy ý kiến' },
    { id: 'library', icon: BookOpen, label: 'Thư viện' },
    { id: 'admin', icon: ShieldCheck, label: 'Phân quyền và quản trị' },
  ]

  // ── Sidebar items — only visible when on "schedule" tab ────────────────────
  const SCHEDULE_SIDEBAR = [
    { icon: Calendar, label: 'Lịch họp cá nhân', type: 'personal' },
    { icon: UserCheck, label: 'Lịch họp lãnh đạo', type: 'leader' },
    { icon: Building2, label: 'Lịch họp đơn vị', type: 'unit' },
  ]

  // ── Rooms sidebar ──────────────────────────────────────────────────────────
  const ROOMS_SIDEBAR = [
    { icon: Building2, label: 'Quản lý phòng họp' },
    { icon: Settings, label: 'Cấu hình thành phần' },
    { icon: FileText, label: 'Cấu hình màu sắc' },
    { icon: Users, label: 'Quản lý yêu cầu đặt phòng' },
  ]

  // ── Manage meetings sidebar ──────────────────────────────────────────────
  const MEETINGS_SIDEBAR = [
    { icon: List, label: 'Danh sách phiên họp' },
    { icon: FileText, label: 'Kỷ yếu phiên họp' },
    { icon: Search, label: 'Tra cứu kết luận phiên họp' },
    { icon: BookOpen, label: 'Quản lý sổ tay' },
  ]

  // Decide sidebar visibility
  const hasSidebar =
    activeNav === 'schedule' || activeNav === 'rooms' || activeNav === 'manage_meetings'

  // Current schedule type
  const currentScheduleType = SCHEDULE_SIDEBAR[activeSidebar]?.type || 'personal'

  // Render active page content
  const renderPage = () => {
    switch (activeNav) {
      case 'home':
        return <CabinetHome />
      case 'schedule':
        return <CabinetSchedule scheduleType={currentScheduleType} />
      case 'manage_meetings':
        return <CabinetMeetings activeTab={activeSidebar} />
      case 'rooms':
        return <CabinetRooms />
      case 'questionnaire':
        return <CabinetQuestionnaire />
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <FileText size={28} className="opacity-25" />
            </div>
            <h3 className="text-base font-bold text-gray-600 mb-1">Đang phát triển</h3>
            <p className="text-sm">
              Tính năng &quot;{NAV_ITEMS.find((x) => x.id === activeNav)?.label}&quot; sẽ sớm được
              cập nhật.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100 font-sans">
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="bg-[#c8102e] text-white flex items-center h-14 shrink-0 shadow-md z-20">
        {/* Logo */}
        <CabinetLogo
          onClick={() => {
            setActiveNav('home')
            setActiveSidebar(0)
          }}
        />

        {/* Hamburger */}
        <button className="px-3 h-full flex items-center hover:bg-[#a50e27] transition">
          <Menu size={20} />
        </button>

        {/* Nav links */}
        <nav className="flex items-center h-full flex-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id)
                setActiveSidebar(0)
              }}
              className={`flex items-center gap-1.5 px-4 h-full text-sm font-medium whitespace-nowrap transition border-b-2 shrink-0 ${
                activeNav === item.id
                  ? 'bg-[#a50e27] border-white'
                  : 'border-transparent hover:bg-[#a50e27]/70'
              }`}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-0.5 px-3 shrink-0">
          {/* Về hệ thống chính — icon only, luôn hiển thị */}
          <button
            onClick={() => (window.location.href = '/')}
            className="p-2 hover:bg-[#a50e27] rounded-full transition"
            title="Về Hệ thống chính"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="w-px h-7 bg-[#a50e27] mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2 hover:bg-[#a50e27] rounded-full relative transition outline-none">
                <Bell size={17} />
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border border-white px-1 shadow-sm">
                  99+
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[400px] p-0 mr-4 mt-2 shadow-xl border-gray-100 rounded-xl"
              align="end"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white rounded-t-xl">
                <h3 className="font-bold text-[#1a202c] text-lg">Thông báo</h3>
                <button className="text-sm text-gray-500 hover:text-[#c8102e] transition-colors">
                  Đánh dấu tất cả đã đọc
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto flex flex-col">
                {/* Unread item */}
                <div className="flex gap-3 px-4 py-3 bg-[#f8fafc] border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer relative">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-[#1a202c] leading-snug pr-4">
                      Phiếu lấy ý kiến{' '}
                      <span className="font-bold">
                        VP Đảng ủy phường xin ý kiến BCĐ về phát triển khoa học, công nghệ, đổi mới
                        sáng tạo và chuyển đổi số phường về dự thảo nội dung một số văn bản
                      </span>{' '}
                      đã hết hạn trả lời.
                    </p>
                    <p className="text-xs text-gray-500">11:30:22 06/07/2026</p>
                  </div>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                    <MoreVertical size={16} />
                  </button>
                </div>

                {/* Read item */}
                <div className="flex gap-3 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer relative">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-[#1a202c] leading-snug pr-4">
                      Đồng chí đã được mời tham gia phiên họp{' '}
                      <span className="font-bold">
                        Hội nghị sơ kết đánh giá kết quả 6 tháng đầu năm về triển khai Nghị quyết số
                        57-NQ/TW, ngày 22/12/2024 của Bộ Chính trị về đột phá phát triển khoa học,
                        công nghệ, đổi mới sáng tạo và chuyển đổi số quốc gia và Quyết định số
                        204-QĐ/TW, ngày 29/11/2024 của Ban Bí thư về phê duyệt Đề án Chuyển đổi số
                        trong các cơ quan đảng rên địa bàn phường
                      </span>{' '}
                      Kính đề nghị đồng chí vào phần mềm iCPV - Cabinet để xác nhận tham gia. Trân
                      trọng!
                    </p>
                    <p className="text-xs text-gray-500">16:15:45 05/07/2026</p>
                  </div>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                    <MoreVertical size={16} />
                  </button>
                </div>

                {/* Read item */}
                <div className="flex gap-3 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer relative">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-[#1a202c] leading-snug pr-4">
                      Đồng chí đã được mời tham gia phiên họp{' '}
                      <span className="font-bold">
                        Hội nghị Thường trực Đảng ủy, Ban Thường vụ Đảng ủy nghe và cho ý kiến về
                        một số nội dung theo quy chế làm việc
                      </span>{' '}
                      Kính đề nghị đồng chí...
                    </p>
                    <p className="text-xs text-gray-500">09:12:00 03/07/2026</p>
                  </div>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-7 bg-[#a50e27] mx-1" />
          <button className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#a50e27] rounded text-sm transition">
            <div className="w-6 h-6 rounded-full bg-[#a50e27] flex items-center justify-center border border-white/30">
              <User size={13} />
            </div>
            <span className="max-w-[120px] truncate">{userName}</span>
            <ChevronDown size={12} />
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — contextual */}
        {hasSidebar && (
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 shadow-sm z-10">
            {activeNav === 'schedule' &&
              SCHEDULE_SIDEBAR.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => setActiveSidebar(i)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 transition-colors ${
                    activeSidebar === i
                      ? 'bg-[#c8102e] text-white'
                      : 'text-gray-700 hover:bg-red-50 hover:text-[#c8102e]'
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}

            {activeNav === 'rooms' &&
              ROOMS_SIDEBAR.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => setActiveSidebar(i)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 transition-colors ${
                    activeSidebar === i
                      ? 'bg-[#c8102e] text-white'
                      : 'text-gray-700 hover:bg-red-50 hover:text-[#c8102e]'
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}

            {activeNav === 'manage_meetings' &&
              MEETINGS_SIDEBAR.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => setActiveSidebar(i)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 transition-colors ${
                    activeSidebar === i
                      ? 'bg-[#c8102e] text-white'
                      : 'text-gray-700 hover:bg-red-50 hover:text-[#c8102e]'
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}

            {/* Back to main system */}
            <div className="mt-auto p-4 border-t border-gray-100">
              <Button
                variant="outline"
                className="w-full justify-start text-gray-600 hover:text-[#c8102e] hover:bg-red-50 text-sm"
                onClick={() => (window.location.href = '/')}
              >
                <ArrowLeft className="mr-2 size-4" />
                Về hệ thống chính
              </Button>
            </div>
          </aside>
        )}

        {/* ── Main content area ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">{renderPage()}</main>
      </div>
    </div>
  )
}
