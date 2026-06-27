/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

const SCHEDULE_ENDPOINTS = {
  personal: '/api/phonghopkhonggiayto/meetings/schedule',
  leader: '/api/phonghopkhonggiayto/meetings/leader-schedule',
  unit: '/api/phonghopkhonggiayto/meetings/unit-schedule',
}

export function CabinetSchedule({ scheduleType = 'personal' }) {
  const [meetings, setMeetings] = useState([])
  const [viewMode, setViewMode] = useState('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const calendarRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    const url = SCHEDULE_ENDPOINTS[scheduleType] || SCHEDULE_ENDPOINTS.personal
    fetch(url, { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        // Handle both wrapped and unwrapped response
        const data = json.data || json
        if (Array.isArray(data)) {
          const events = data.map((m) => ({
            id: m.id,
            title: m.title,
            start: m.startTime,
            end: m.endTime,
            backgroundColor: statusColor(m.status),
            borderColor: 'transparent',
            extendedProps: { room: m.roomName, status: m.status },
          }))
          setMeetings(events)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [scheduleType])

  const statusColor = (status) => {
    switch (status) {
      case 'Đang diễn ra':
        return '#16a34a'
      case 'Sắp diễn ra':
        return '#2563eb'
      case 'Hoàn thành':
        return '#6b7280'
      case 'Hủy':
        return '#dc2626'
      default:
        return '#c8102e'
    }
  }

  const calendarApi = () => calendarRef.current?.getApi()

  const handlePrev = () => {
    calendarApi()?.prev()
    setCalendarTitle(calendarApi()?.view.title || '')
  }
  const handleNext = () => {
    calendarApi()?.next()
    setCalendarTitle(calendarApi()?.view.title || '')
  }
  const handleToday = () => {
    calendarApi()?.today()
    setCalendarTitle(calendarApi()?.view.title || '')
  }
  const handleViewChange = (v) => {
    setViewMode(v)
    calendarApi()?.changeView(v)
    setCalendarTitle(calendarApi()?.view.title || '')
  }

  useEffect(() => {
    setTimeout(() => {
      setCalendarTitle(calendarApi()?.view.title || '')
    }, 120)
  }, [])

  const VIEW_BUTTONS = [
    { key: 'timeGridDay', label: 'Ngày' },
    { key: 'timeGridWeek', label: 'Tuần' },
    { key: 'dayGridMonth', label: 'Tháng' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Lịch họp</h1>
        <button className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus size={15} />
          Tạo phiên họp mới
        </button>
      </div>

      {/* Calendar toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 font-medium transition"
          >
            Hôm nay
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[220px] text-center">
            {calendarTitle}
          </span>
          <button
            onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {VIEW_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              onClick={() => handleViewChange(btn.key)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                viewMode === btn.key
                  ? 'bg-[#c8102e] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-[#c8102e] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Đang tải lịch họp...</span>
            </div>
          </div>
        ) : (
          <div
            className="h-full w-full p-2"
            style={{
              '--fc-border-color': '#e5e7eb',
              '--fc-today-bg-color': 'rgba(200,16,46,0.04)',
              '--fc-now-indicator-color': '#c8102e',
            }}
          >
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
              nowIndicator={true}
              eventContent={(arg) => (
                <div className="px-1.5 py-1 text-[11px] text-white h-full overflow-hidden rounded cursor-pointer hover:brightness-90 transition-all">
                  <div className="font-bold leading-tight truncate">{arg.event.title}</div>
                  <div className="opacity-90 mt-0.5">{arg.timeText}</div>
                  <div className="opacity-75 truncate">{arg.event.extendedProps.room}</div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}
