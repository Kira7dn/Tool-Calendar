/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Calendar,
  Home,
  Users,
  MapPin,
  MessageSquare,
  HelpCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Menu,
  User,
  ChevronDown,
  Building2,
  UserCheck,
  ArrowLeft,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CabinetAppShell() {
  // Navigation State
  const [activeNav, setActiveNav] = useState('Lịch họp')
  const [activeSidebar, setActiveSidebar] = useState(0)

  // Calendar State
  const [meetings, setMeetings] = useState([])
  const [viewMode, setViewMode] = useState('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')
  const calendarRef = useRef(null)

  const sidebarItems = [
    { icon: Calendar, label: 'Lịch họp cá nhân' },
    { icon: UserCheck, label: 'Lịch họp lãnh đạo' },
    { icon: Building2, label: 'Lịch họp đơn vị' },
  ]

  const navItems = [
    { icon: Home, label: 'Trang chủ', id: 'home' },
    { icon: FileText, label: 'Tài liệu cuộc họp', id: 'documents' },
    { icon: Calendar, label: 'Lịch họp', id: 'Lịch họp' },
    { icon: Users, label: 'Biểu quyết', id: 'voting' },
  ]

  useEffect(() => {
    fetch('/api/phonghopkhonggiayto/meetings/schedule', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const events = json.data.map((m) => ({
            id: m.id,
            title: m.title,
            start: m.startTime,
            end: m.endTime,
            extendedProps: { room: m.roomName, status: m.status },
          }))
          setMeetings(events)
        }
      })
      .catch((err) => console.error('Error fetching meetings:', err))
  }, [])

  const handlePrev = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.prev()
      setCalendarTitle(calendarApi.view.title)
    }
  }

  const handleNext = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.next()
      setCalendarTitle(calendarApi.view.title)
    }
  }

  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.today()
      setCalendarTitle(calendarApi.view.title)
    }
  }

  const handleViewChange = (viewName) => {
    setViewMode(viewName)
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.changeView(viewName)
      setCalendarTitle(calendarApi.view.title)
    }
  }

  // Update title initially after calendar mounts
  useEffect(() => {
    setTimeout(() => {
      const calendarApi = calendarRef.current?.getApi()
      if (calendarApi) {
        setCalendarTitle(calendarApi.view.title)
      }
    }, 100)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-[#c8102e] text-white flex items-center px-0 h-14 shrink-0 shadow-md z-10">
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 h-full border-r border-[#a50e27] min-w-[220px] cursor-pointer"
          onClick={() => (window.location.href = '/')}
        >
          <div className="relative w-9 h-9 shrink-0">
            {/* Vietnamese flag emoji as logo placeholder */}
            <div className="w-9 h-9 rounded-sm bg-[#da020b] flex items-center justify-center border border-yellow-400">
              <svg viewBox="0 0 36 36" className="w-8 h-8">
                <rect width="36" height="36" fill="#da020b" />
                <polygon
                  points="18,4 21.5,14.5 32,14.5 23.5,21 26.5,32 18,25.5 9.5,32 12.5,21 4,14.5 14.5,14.5"
                  fill="#ffda00"
                />
              </svg>
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sm">iCPV Cabinet</span>
            <span className="text-[10px] text-red-200">Phòng họp không giấy</span>
          </div>
        </div>

        {/* Hamburger */}
        <button className="px-4 hover:bg-[#a50e27] h-full flex items-center">
          <Menu size={20} />
        </button>

        {/* Nav Links */}
        <nav className="flex items-center h-full flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex items-center gap-2 px-4 h-full text-sm font-medium transition-colors border-b-2 ${
                activeNav === item.id
                  ? 'bg-[#a50e27] border-white'
                  : 'border-transparent hover:bg-[#a50e27]'
              }`}
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side icons */}
        <div className="flex items-center gap-1 px-3">
          <button className="p-2 hover:bg-[#a50e27] rounded-full relative">
            <Bell size={17} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />
          </button>
          <div className="w-px h-8 bg-[#a50e27] mx-1" />
          <button className="flex items-center gap-2 px-2 py-1 hover:bg-[#a50e27] rounded text-sm">
            <User size={17} />
            <span>Người dùng</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 shadow-sm">
          {sidebarItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setActiveSidebar(i)}
              className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors text-left border-b border-gray-100 ${
                activeSidebar === i
                  ? 'bg-[#c8102e] text-white'
                  : 'text-gray-700 hover:bg-red-50 hover:text-[#c8102e]'
              }`}
            >
              <item.icon size={17} className="shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}

          <div className="mt-auto p-4 border-t border-gray-100">
            <Button
              variant="outline"
              className="w-full justify-start text-gray-600 hover:text-[#c8102e] hover:bg-red-50"
              onClick={() => (window.location.href = '/')}
            >
              <ArrowLeft className="mr-2 size-4" />
              Về hệ thống chính
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {activeNav === 'Lịch họp' ? (
            <>
              {/* Content Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-gray-800">Lịch họp</h1>
                <button className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
                  <Plus size={16} />
                  Tạo phiên họp mới
                </button>
              </div>

              {/* Calendar Controls */}
              <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrev}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium"
                  >
                    Hôm nay
                  </button>
                  <span className="text-sm font-semibold text-gray-700 capitalize min-w-[200px] text-center">
                    {calendarTitle}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
                  <button
                    onClick={() => handleViewChange('timeGridDay')}
                    className={`px-4 py-1.5 font-medium transition-colors ${
                      viewMode === 'timeGridDay'
                        ? 'bg-[#c8102e] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Ngày
                  </button>
                  <button
                    onClick={() => handleViewChange('timeGridWeek')}
                    className={`px-4 py-1.5 font-medium transition-colors ${
                      viewMode === 'timeGridWeek'
                        ? 'bg-[#c8102e] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tuần
                  </button>
                  <button
                    onClick={() => handleViewChange('dayGridMonth')}
                    className={`px-4 py-1.5 font-medium transition-colors ${
                      viewMode === 'dayGridMonth'
                        ? 'bg-[#c8102e] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tháng
                  </button>
                </div>
              </div>

              {/* Calendar Grid (FullCalendar) */}
              <div className="flex-1 overflow-auto bg-white p-4">
                {/* Custom styling for FullCalendar to match the theme */}
                <div className="h-full w-full [&_.fc-toolbar]:hidden [&_.fc-col-header-cell]:bg-gray-50 [&_.fc-col-header-cell]:py-2 [&_.fc-event]:cursor-pointer [&_.fc-event]:border-none [&_.fc-event]:shadow-sm [&_.fc-theme-standard_.fc-scrollgrid]:border-gray-200 [&_.fc-theme-standard_td]:border-gray-100 [&_.fc-theme-standard_th]:border-gray-200">
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView={viewMode}
                    headerToolbar={false}
                    events={meetings}
                    locale="vi"
                    height="100%"
                    slotMinTime="07:00:00"
                    slotMaxTime="20:00:00"
                    allDaySlot={false}
                    eventContent={(arg) => {
                      return (
                        <div className="p-1.5 text-xs whitespace-normal truncate bg-[#c8102e] h-full rounded text-white overflow-hidden hover:opacity-90 transition-opacity">
                          <div className="font-bold leading-tight">{arg.event.title}</div>
                          <div className="text-[10px] opacity-90 mt-0.5">{arg.timeText}</div>
                          <div className="text-[10px] opacity-80 truncate">
                            {arg.event.extendedProps.room}
                          </div>
                        </div>
                      )
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 flex-1">
              <h3 className="text-xl font-bold mb-2">Đang phát triển</h3>
              <p className="text-sm">
                Tính năng "{navItems.find((x) => x.id === activeNav)?.label}" sẽ được cập nhật trong
                các phiên bản tới.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
