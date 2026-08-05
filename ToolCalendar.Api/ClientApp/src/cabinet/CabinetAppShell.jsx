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
  Tag,
  LogOut,
  Check,
  X,
  Edit,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
export function CabinetAppShell({ children }) {
  // Active nav tab (top bar)
  const [activeNav, setActiveNav] = useState('home')
  // Active sidebar item — for schedule tabs
  const [activeSidebar, setActiveSidebar] = useState(0)
  // User info from localStorage
  const [userName, setUserName] = useState('Người dùng')
  // Modals state
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [userLoginName, setUserLoginName] = useState('022182002686')
  const [userLastLogin, setUserLastLogin] = useState('Lần đầu đăng nhập')

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
        setUserLoginName(
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
            payload.unique_name ||
            '022182002686'
        )
        setUserLastLogin(payload.LastLogin || 'Lần đầu đăng nhập')
      }
    } catch {
      /* silent */
    }
  }, [])

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [notifCount, setNotifCount] = useState(0)

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notification')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
        setNotifCount(data.filter((n) => !n.isRead).length)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/notification/mark-all-read', {
        method: 'POST',
      })
      fetchNotifications()
    } catch (e) {
      console.error(e)
    }
  }

  const markRead = async (id) => {
    try {
      await fetch(`/api/notification/mark-read/${id}`, {
        method: 'POST',
      })
      fetchNotifications()
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Listen for realtime updates if needed
    const handleNotifUpdate = () => fetchNotifications()
    document.addEventListener('realtime:notifications_updated', handleNotifUpdate)
    return () => {
      document.removeEventListener('realtime:notifications_updated', handleNotifUpdate)
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
    { id: 'admin', icon: ShieldCheck, label: 'Phân quyền' },
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
          {/* Về hệ thống chính */}
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#a50e27] rounded-full transition text-sm font-medium mr-1"
            title="Về Hệ thống chính"
          >
            <ArrowLeft size={16} />
            <span className="hidden md:inline">Quay lại hệ thống chính</span>
          </button>
          <div className="w-px h-7 bg-[#a50e27] mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2 hover:bg-[#a50e27] rounded-full relative transition outline-none">
                <Bell size={17} />
                {notifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border border-white px-1 shadow-sm">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[400px] p-0 mr-4 mt-2 shadow-xl border-gray-100 rounded-xl"
              align="end"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white rounded-t-xl">
                <h3 className="font-bold text-[#1a202c] text-lg">Thông báo</h3>
                <button
                  onClick={markAllRead}
                  className="text-sm text-gray-500 hover:text-[#c8102e] transition-colors"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto flex flex-col">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Không có thông báo nào.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`flex gap-3 px-4 py-3 border-b border-gray-100 transition cursor-pointer relative ${
                        n.isRead ? 'bg-white hover:bg-gray-50' : 'bg-[#eff6ff] hover:bg-[#e0f2fe]'
                      }`}
                    >
                      <div className="flex-1 space-y-1">
                        <p
                          className={`text-sm leading-snug pr-4 ${n.isRead ? 'text-gray-600' : 'text-[#1a202c] font-medium'}`}
                        >
                          {n.title && <span className="font-bold mr-1 block">{n.title}</span>}
                          {n.body}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(n.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 absolute right-4 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-7 bg-[#a50e27] mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#a50e27] rounded text-sm transition outline-none">
                <div className="w-6 h-6 rounded-full bg-[#a50e27] flex items-center justify-center border border-white/30">
                  <User size={13} />
                </div>
                <span className="max-w-[120px] truncate">{userName}</span>
                <ChevronDown size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 p-0 mt-2 shadow-xl border-gray-100 rounded-xl"
              align="end"
            >
              <div className="flex flex-col py-1">
                <button
                  onClick={() => {
                    document.body.click() // close popover
                    setIsProfileModalOpen(true)
                  }}
                  className="flex items-center gap-3 px-4 py-3 bg-[#c8102e] text-white hover:bg-[#a50e27] transition-colors text-sm font-semibold"
                >
                  <User size={16} />
                  <span>Hồ sơ cá nhân</span>
                </button>
                <button
                  onClick={() => setIsThemeModalOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 text-[#1a202c] hover:bg-gray-50 transition-colors text-sm font-bold"
                >
                  <Settings size={16} />
                  <span>Giao diện</span>
                </button>
                <button
                  onClick={() => setIsVersionModalOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 text-[#1a202c] hover:bg-gray-50 transition-colors text-sm font-bold"
                >
                  <Tag size={16} />
                  <span>Phiên bản</span>
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => {
                    localStorage.removeItem('auth_token')
                    window.location.href = '/login'
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-[#c8102e] hover:bg-red-50 transition-colors text-sm font-bold"
                >
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
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
        <main className="flex-1 bg-gray-50 overflow-hidden relative flex flex-col">
          {children || renderPage()}
        </main>
      </div>

      {/* Profile Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-[450px] p-0 overflow-hidden border-0 rounded-xl bg-white">
          {/* Header */}
          <div className="bg-[#c8102e] text-white pt-10 pb-6 px-6 relative flex flex-col items-center">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 text-white hover:opacity-80 outline-none"
            >
              <X size={20} />
            </button>
            <h2 className="absolute top-4 left-6 font-bold text-lg">Hồ sơ cá nhân</h2>

            <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white mb-3 mt-4 overflow-hidden flex items-center justify-center">
              <User size={48} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-xl mb-1">{userName}</h3>
            <p className="text-sm opacity-90">
              {userLastLogin === 'Lần đầu đăng nhập'
                ? userLastLogin
                : `Lần đăng nhập gần nhất ${userLastLogin}`}
            </p>
          </div>

          {/* Body */}
          <div className="p-6">
            <h4 className="font-bold text-[#1a202c] text-base mb-4">Hồ sơ cá nhân</h4>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Tên đăng nhập</span>
                <span className="font-semibold text-[#1a202c]">{userLoginName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Tên đại biểu</span>
                <span className="font-semibold text-[#1a202c]">{userName}</span>
              </div>
            </div>

            <div className="h-px bg-gray-100 my-6" />

            <h4 className="font-bold text-[#1a202c] text-base mb-4">Cài đặt</h4>
            <div className="space-y-1">
              <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <Edit size={18} className="text-gray-500" />
                  <span className="font-medium text-[#1a202c]">Chỉnh sửa hồ sơ</span>
                </div>
                <ChevronDown
                  size={18}
                  className="text-gray-400 -rotate-90 group-hover:text-gray-600"
                />
              </button>
              <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <ImageIcon size={18} className="text-gray-500" />
                  <span className="font-medium text-[#1a202c]">Đổi ảnh đại diện</span>
                </div>
                <ChevronDown
                  size={18}
                  className="text-gray-400 -rotate-90 group-hover:text-gray-600"
                />
              </button>
              <button
                onClick={() => {
                  setIsProfileModalOpen(false)
                  setIsLoggingOut(true)
                  setTimeout(() => {
                    localStorage.removeItem('auth_token')
                    window.location.href = '/login.html'
                  }, 1500)
                }}
                className="w-full flex items-center justify-between px-2 py-3 hover:bg-red-50 rounded-lg transition-colors mt-2"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={18} className="text-[#c8102e]" />
                  <span className="font-medium text-[#c8102e]">Đăng xuất</span>
                </div>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Theme Modal */}
      <Dialog open={isThemeModalOpen} onOpenChange={setIsThemeModalOpen}>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden border-0 rounded-xl">
          <DialogHeader className="px-6 py-4 bg-white relative">
            <DialogTitle className="text-[#1a202c] text-xl font-bold">
              Thay đổi màu sắc giao diện
            </DialogTitle>
          </DialogHeader>
          <div className="h-3 bg-[#f0f4f8]" />
          <div className="p-6 bg-white">
            <p className="text-sm text-gray-500 italic mb-8">
              Chọn màu bên dưới để thay đổi màu sắc giao diện.
            </p>
            <div className="flex flex-col sm:flex-row gap-12 items-start justify-center">
              <label className="flex items-start gap-3 cursor-pointer group w-[140px]">
                <div className="w-6 h-6 shrink-0 rounded bg-[#c8102e] flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
                <span className="text-[#c8102e] font-medium group-hover:text-[#a50e27] transition-colors leading-tight">
                  Đỏ Rouge
                  <br />
                  Écarlate
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group w-[140px]">
                <div className="w-6 h-6 shrink-0 rounded bg-[#004282] border border-gray-200" />
                <span className="text-[#004282] font-medium group-hover:text-[#002f5e] transition-colors leading-tight">
                  Xanh Dark
                  <br />
                  Cerulean
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group w-[140px]">
                <div className="w-6 h-6 shrink-0 rounded bg-[#0061ff] border border-gray-200" />
                <span className="text-[#0061ff] font-medium group-hover:text-[#004bcc] transition-colors leading-tight">
                  Xanh
                  <br />
                  Brandeis
                </span>
              </label>
            </div>
            <div className="flex justify-center pt-10">
              <Button
                onClick={() => setIsThemeModalOpen(false)}
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white px-8 py-2 h-auto rounded-lg font-bold"
              >
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version Modal */}
      <Dialog open={isVersionModalOpen} onOpenChange={setIsVersionModalOpen}>
        <DialogContent className="max-w-[500px] p-0 overflow-hidden border-0 rounded-xl">
          <DialogHeader className="px-6 py-4 bg-white relative">
            <DialogTitle className="text-[#1a202c] text-xl font-bold">Phiên bản</DialogTitle>
          </DialogHeader>
          <div className="h-3 bg-[#f0f4f8]" />
          <div className="p-8 bg-white space-y-4">
            <div className="flex items-end gap-3 mb-6">
              <span className="text-[40px] leading-none font-bold text-[#1a202c]">1.0</span>
              <span className="text-gray-500 font-medium mb-1">09.07.2026</span>
            </div>

            <div className="space-y-4">
              <span className="inline-block px-4 py-1.5 bg-[#9300d3] text-white text-xs font-bold rounded-lg">
                Fixed
              </span>
              <ul className="list-disc list-inside space-y-2 text-[#1a202c]">
                <li className="marker:text-gray-400">Hoàn thiện giao diện theo chuẩn UI</li>
              </ul>
            </div>

            <div className="flex justify-center pt-8 mt-6 border-t border-gray-100">
              <Button
                onClick={() => setIsVersionModalOpen(false)}
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white px-10 py-2 h-auto rounded-lg font-bold"
              >
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
          <h2 className="text-white text-xl font-bold">Đang đăng xuất...</h2>
          <p className="text-gray-200 mt-2">Vui lòng chờ trong giây lát</p>
        </div>
      )}
    </div>
  )
}
