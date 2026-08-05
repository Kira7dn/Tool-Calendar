/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import multiMonthPlugin from '@fullcalendar/multimonth'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { MeetingModal } from '../components/MeetingModal'

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

const getVietnameseDay = (dayIndex) => {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  return days[dayIndex]
}

export function CabinetUnitSchedule() {
  const [meetings, setMeetings] = useState([])
  const [viewMode, setViewMode] = useState('dayGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const calendarRef = useRef(null)

  const fetchMeetings = useCallback(() => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/meetings/schedule')
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || json
        if (Array.isArray(data)) {
          const events = data.map((m) => ({
            id: m.id,
            title: m.title,
            start: m.startTime,
            end: m.endTime,
            backgroundColor: statusColor(m.status),
            borderColor: 'transparent',
            extendedProps: { room: m.roomName, status: m.status, meeting: m },
          }))
          setMeetings(events)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const calendarApi = () => calendarRef.current?.getApi()

  const updateTitle = useCallback(() => {
    const api = calendarApi()
    if (!api) return
    const title = api.view.title
    // Format title if needed, or just use FullCalendar's built in vi locale title
    // "Thg 7 6 – 12, 2026" -> we might want to tweak it, but let's stick to default for now
    setCalendarTitle(title)
  }, [])

  const handlePrev = () => {
    calendarApi()?.prev()
    updateTitle()
  }
  const handleNext = () => {
    calendarApi()?.next()
    updateTitle()
  }
  const handleViewChange = (v) => {
    setViewMode(v)
    calendarApi()?.changeView(v)
    updateTitle()
  }

  useEffect(() => {
    setTimeout(updateTitle, 120)
  }, [updateTitle])

  const handleSaved = () => {
    setModal(null)
    fetchMeetings()
  }

  const VIEW_BUTTONS = [
    { key: 'dayGridWeek', label: 'Tuần' },
    { key: 'dayGridMonth', label: 'Tháng' },
    { key: 'multiMonthYear', label: 'Năm' },
  ]

  // Custom Day Header rendering
  const renderDayHeader = (arg) => {
    const d = arg.date
    if (viewMode === 'dayGridWeek') {
      const dayStr = getVietnameseDay(d.getDay())
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`
      return (
        <div className="font-semibold text-gray-700 py-1">
          {dayStr}, {dateStr}
        </div>
      )
    }
    return <div className="font-semibold text-gray-700 py-1">{arg.text}</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {modal && (
        <MeetingModal
          meeting={modal.mode === 'edit' ? modal.meeting : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Main Title Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center shrink-0">
        <h1 className="text-xl font-bold text-[#1a202c]">Lịch họp</h1>
      </div>

      {/* Toolbar */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shrink-0 m-4 mb-0 rounded-t-lg border border-gray-200 border-b-0">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900 min-w-[200px]">{calendarTitle}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm bg-gray-50 p-1">
          {VIEW_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              onClick={() => handleViewChange(btn.key)}
              className={`px-6 py-1.5 font-medium transition-colors rounded-md ${
                viewMode === btn.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full bg-white rounded-b-lg border border-t-0 border-gray-200">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-[#c8102e] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Đang tải lịch họp...</span>
            </div>
          </div>
        ) : (
          <div
            className="h-full w-full bg-white rounded-b-lg border border-t-0 border-gray-200"
            style={{
              '--fc-border-color': '#f3f4f6',
              '--fc-today-bg-color': '#fce8e8', // Light pink/red background for today
              '--fc-event-bg-color': '#c8102e',
              '--fc-event-border-color': 'transparent',
            }}
          >
            <style>{`
              /* Make FullCalendar edges flush with container */
              .fc-theme-standard .fc-scrollgrid { border: none !important; }
              /* Minimal styling overrides */
              .fc-col-header-cell { padding-top: 8px; padding-bottom: 8px; }
              .fc-daygrid-day-top { flex-direction: row; justify-content: center; padding-top: 4px; }
              .fc-daygrid-day-number { font-size: 0.875rem; color: #4b5563; font-weight: 500; }
              .fc-event { border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; }
              .fc-multimonth-daygrid { background-color: white; }
            `}</style>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin, multiMonthPlugin]}
              initialView={viewMode}
              headerToolbar={false}
              events={meetings}
              locale="vi"
              height="100%"
              dayHeaderContent={renderDayHeader}
              eventClick={(info) => {
                fetch(`/api/phonghopkhonggiayto/meetings/${info.event.id}`)
                  .then((r) => r.json())
                  .then((json) => {
                    const fullMeeting = json.data || json
                    setModal({ mode: 'edit', meeting: fullMeeting })
                  })
                  .catch((err) => console.error('Failed to fetch meeting details', err))
              }}
              eventContent={(arg) => (
                <div className="text-[11px] text-white w-full overflow-hidden cursor-pointer hover:brightness-90 transition-all px-1">
                  <div className="font-bold leading-tight truncate">{arg.event.title}</div>
                  <div className="opacity-90 truncate">{arg.event.extendedProps.room}</div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}
