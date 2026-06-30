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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CabinetHome } from './pages/CabinetHome'
import { CabinetSchedule } from './pages/CabinetSchedule'
import { CabinetRooms } from './pages/CabinetRooms'
import { CabinetQuestionnaire } from './pages/CabinetQuestionnaire'

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

  // Decide sidebar visibility
  const hasSidebar = activeNav === 'schedule' || activeNav === 'rooms'

  // Current schedule type
  const currentScheduleType = SCHEDULE_SIDEBAR[activeSidebar]?.type || 'personal'

  // Render active page content
  const renderPage = () => {
    switch (activeNav) {
      case 'home':
        return <CabinetHome />
      case 'schedule':
        return <CabinetSchedule scheduleType={currentScheduleType} />
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
            className="flex items-center gap-1.5 px-3 py-1.5 mr-1 hover:bg-[#a50e27] rounded text-sm transition border border-white/20"
            title="Về hệ thống chính"
          >
            <ArrowLeft size={14} />
            <span className="hidden md:inline">Hệ thống chính</span>
          </button>
          <div className="w-px h-7 bg-[#a50e27] mx-1" />
          <button className="p-2 hover:bg-[#a50e27] rounded-full relative transition">
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          </button>
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
