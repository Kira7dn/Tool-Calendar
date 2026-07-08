/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { MeetingModal } from '../components/MeetingModal'
import { CabinetLeaderSchedule } from './CabinetLeaderSchedule'
import { CabinetUnitSchedule } from './CabinetUnitSchedule'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

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

export function CabinetSchedule({ scheduleType = 'personal' }) {
  const [meetings, setMeetings] = useState([])
  const [viewMode, setViewMode] = useState('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', meeting }
  const calendarRef = useRef(null)

  const fetchMeetings = useCallback(() => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/meetings/schedule', { headers: AUTH_HEADER() })
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
  }, [scheduleType, fetchMeetings])

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

  const handleSaved = () => {
    setModal(null)
    fetchMeetings()
  }

  const VIEW_BUTTONS = [
    { key: 'timeGridDay', label: 'Ngày' },
    { key: 'timeGridWeek', label: 'Tuần' },
    { key: 'dayGridMonth', label: 'Tháng' },
  ]

  if (scheduleType === 'leader') {
    return <CabinetLeaderSchedule />
  }

  if (scheduleType === 'unit') {
    return <CabinetUnitSchedule />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Meeting modal */}
      {modal && (
        <MeetingModal
          meeting={modal.mode === 'edit' ? modal.meeting : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Lịch họp</h1>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
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
            className="h-full w-full"
            style={{
              '--fc-border-color': '#e5e7eb',
              '--fc-today-bg-color': 'rgba(200,16,46,0.04)',
              '--fc-now-indicator-color': '#c8102e',
            }}
          >
            <style>{`
              .fc-theme-standard .fc-scrollgrid { border: none !important; }
            `}</style>
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
              eventDisplay="block"
              eventClick={(info) => {
                // Fetch full meeting details (including participants) before opening modal
                fetch(`/api/phonghopkhonggiayto/meetings/${info.event.id}`, {
                  headers: AUTH_HEADER(),
                })
                  .then((r) => r.json())
                  .then((json) => {
                    const fullMeeting = json.data || json
                    setModal({ mode: 'edit', meeting: fullMeeting })
                  })
                  .catch((err) => console.error('Failed to fetch meeting details', err))
              }}
              eventContent={(arg) => (
                <div
                  className="px-1.5 py-1 text-[11px] text-white h-full w-full overflow-hidden rounded cursor-pointer hover:brightness-90 transition-all"
                  style={{ backgroundColor: arg.event.backgroundColor || '#c8102e' }}
                >
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
