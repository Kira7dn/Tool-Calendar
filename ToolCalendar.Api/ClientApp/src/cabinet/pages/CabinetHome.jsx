/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Video,
  CalendarClock,
  ChevronRight,
  MapPin,
  Calendar as CalendarIcon,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

function StatRow({ color, label, value, percent }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-md ${color}`} />
        <span className="text-sm font-medium text-gray-800">{label}</span>
      </div>
      <div className="flex gap-6 text-sm text-gray-800">
        <span className="w-12 text-right font-bold">{value}</span>
        <span className="w-16 text-right">{percent.toFixed(2)}</span>
      </div>
    </div>
  )
}

function MeetingCard({ meeting, isOngoing }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border mb-2 last:mb-0 transition-all hover:shadow-sm ${
        isOngoing
          ? 'border-green-200 bg-green-50'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <div
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isOngoing ? 'bg-green-500' : 'bg-blue-500'
        }`}
      >
        {isOngoing ? (
          <Video size={14} className="text-white" />
        ) : (
          <CalendarClock size={14} className="text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{meeting.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <MapPin size={11} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 truncate">
            {meeting.roomName || 'Chưa xác định'}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <CalendarClock size={11} className="text-gray-400" />
          <span className="text-xs text-gray-500">
            {meeting.startTime
              ? new Date(meeting.startTime).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })
              : '--'}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {isOngoing && (
          <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            ĐANG DIỄN RA
          </span>
        )}
        <button
          onClick={() =>
            alert(
              `Tính năng phòng họp trực tuyến đang được phát triển. (Meeting ID: ${meeting.id})`
            )
          }
          className="text-xs px-3 py-1.5 bg-[#c8102e] text-white rounded-md hover:bg-[#a50e27] transition shadow-sm font-medium"
        >
          {isOngoing ? 'Vào họp' : 'Chi tiết'}
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="relative mb-3">
        <svg
          width="80"
          height="80"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 65 L80 65 L75 85 L25 85 Z"
            fill="#e2e8f0"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M30 45 L70 45 L70 65 L30 65 Z"
            fill="#f8fafc"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M40 50 L60 50 M40 55 L50 55"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="70" cy="35" r="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
          <path
            d="M66 35 L74 35 M70 31 L70 39"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-sm font-bold text-[#1a202c]">Không có dữ liệu</p>
    </div>
  )
}

function SectionCard({ title, count, children, showAction = false }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-bold text-[#1a202c] text-base">
          {title} {count !== undefined && `(${count})`}
        </h2>
        {showAction && (
          <button className="text-xs text-[#c8102e] border border-[#c8102e] px-2 py-0.5 rounded flex items-center hover:bg-red-50 transition">
            Xem tất cả <ChevronRight size={12} className="ml-0.5" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function MonthPicker({ selectedMonth, selectedYear, onChange }) {
  const [currentYear, setCurrentYear] = useState(selectedYear)
  const [isOpen, setIsOpen] = useState(false)

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleSelect = (m) => {
    onChange(m, currentYear)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-[#1a202c] hover:bg-gray-50 transition outline-none">
          {String(selectedMonth).padStart(2, '0')}/{selectedYear}
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-300 pl-2">
            <X
              size={14}
              className="text-gray-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null, null)
              }}
            />
            <CalendarIcon size={14} className="text-gray-500" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 rounded-xl shadow-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setCurrentYear((y) => y - 1)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 transition"
          >
            <ChevronsLeft size={16} />
          </button>
          <span className="font-bold text-[#1a202c]">{currentYear}</span>
          <button
            onClick={() => setCurrentYear((y) => y + 1)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 transition"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => handleSelect(m)}
              className={`py-2 rounded-md text-sm font-medium transition ${
                m === selectedMonth && currentYear === selectedYear
                  ? 'bg-[#c8102e] text-white'
                  : 'text-[#1a202c] hover:bg-gray-100'
              }`}
            >
              thg {m}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CabinetHome() {
  const d = new Date()
  const [selectedMonth, setSelectedMonth] = useState(d.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(d.getFullYear())

  const [ongoingMeetings, setOngoingMeetings] = useState([])
  const [upcomingMeetings, setUpcomingMeetings] = useState([])
  const [unconfirmedMeetings, setUnconfirmedMeetings] = useState([])
  const [unansweredQuestions, setUnansweredQuestions] = useState([])

  const [stats, setStats] = useState({
    attended: 2,
    pending: 0,
    absent: 0,
    total: 2,
  })

  const [docPrepStats, setDocPrepStats] = useState({ prepared: 0, unprepared: 0 })
  const [questionStats, setQuestionStats] = useState({ answered: 0, unanswered: 0 })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const promises = [
      fetch('/api/phonghopkhonggiayto/meetings/schedule', { headers: AUTH_HEADER() })
        .then((r) => r.json())
        .catch(() => null),
      fetch('/api/phonghopkhonggiayto/meetings/my-meetings', { headers: AUTH_HEADER() })
        .then((r) => r.json())
        .catch(() => null),
    ]
    Promise.all(promises).then(([scheduleData, myMeetingsData]) => {
      if (scheduleData && scheduleData.data) {
        const now = new Date()
        const all = scheduleData.data

        // Let's filter by selected month/year if not null
        let filtered = all
        if (selectedMonth && selectedYear) {
          filtered = all.filter((m) => {
            const date = new Date(m.startTime)
            return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear
          })
        }

        setOngoingMeetings(
          filtered.filter((m) => {
            const s = new Date(m.startTime)
            const e = new Date(m.endTime)
            return s <= now && e >= now
          })
        )
        setUpcomingMeetings(
          filtered
            .filter((m) => new Date(m.startTime) > now)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .slice(0, 5)
        )
        setUnconfirmedMeetings([])
        setUnansweredQuestions([])
      }

      if (myMeetingsData && myMeetingsData.data) {
        let myMeetings = myMeetingsData.data
        if (selectedMonth && selectedYear) {
          myMeetings = myMeetings.filter((m) => {
            const date = new Date(m.startTime)
            return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear
          })
        }

        const attended = myMeetings.filter((m) => {
          const status = m.participants?.[0]?.attendanceStatus
          return status === 'Tham gia'
        }).length

        const pending = myMeetings.filter((m) => {
          const status = m.participants?.[0]?.attendanceStatus
          return status === 'Chưa xác nhận' || !status
        }).length

        const absent = myMeetings.filter((m) => {
          const status = m.participants?.[0]?.attendanceStatus
          return status === 'Vắng mặt'
        }).length

        setStats({
          attended,
          pending,
          absent,
          total: myMeetings.length,
        })
      }
      setLoading(false)
    })
  }, [selectedMonth, selectedYear])

  const attended = stats.total > 0 ? (stats.attended / stats.total) * 100 : 0
  const pending = stats.total > 0 ? (stats.pending / stats.total) * 100 : 0
  const absent = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a202c]">Trang chủ</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan tình trạng họp và phiên họp diễn ra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Thống kê tình trạng tham gia họp */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-[#1a202c] text-lg">Thống kê tình trạng tham gia họp</h2>
              <MonthPicker
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onChange={(m, y) => {
                  setSelectedMonth(m)
                  setSelectedYear(y)
                }}
              />
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                  {stats.total > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="#22d3ee" // Use primary color from the screenshot - bright green/cyan
                      strokeWidth="6"
                      strokeDasharray={`${attended} ${100 - attended}`}
                      strokeLinecap="butt"
                      className="text-[#2dd4bf]"
                      style={{ stroke: '#2dd4bf' }} // Bright green/cyan ring
                    />
                  )}
                </svg>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1a202c] mb-3 px-1">
                <span>Trạng thái</span>
                <div className="flex gap-6">
                  <span className="w-12 text-right">Giá trị</span>
                  <span className="w-16 text-right">Tỷ lệ (%)</span>
                </div>
              </div>
              <StatRow
                color="bg-[#2dd4bf]"
                label="Có tham gia"
                value={stats.attended}
                percent={attended}
              />
              <StatRow
                color="bg-orange-400"
                label="Chưa xác nhận tham gia"
                value={stats.pending}
                percent={pending}
              />
              <StatRow
                color="bg-[#fb7185]"
                label="Đã báo vắng"
                value={stats.absent}
                percent={absent}
              />
            </div>
          </div>

          {/* Phiên họp cần chuẩn bị tài liệu */}
          <div className="mt-6">
            <h3 className="font-bold text-[#1a202c] mb-3">Phiên họp cần chuẩn bị tài liệu (0)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#e6fbf1] rounded-lg p-5 text-center shadow-sm">
                <p className="text-sm font-bold text-[#1a202c] mb-2">Đã chuẩn bị</p>
                <p className="text-3xl font-bold text-[#1a202c]">0</p>
              </div>
              <div className="bg-[#fef8e6] rounded-lg p-5 text-center shadow-sm">
                <p className="text-sm font-bold text-[#1a202c] mb-2">Chưa chuẩn bị</p>
                <p className="text-3xl font-bold text-[#1a202c]">0</p>
              </div>
            </div>
          </div>

          {/* Tổng số phiếu lấy ý kiến */}
          <div className="mt-6">
            <h3 className="font-bold text-[#1a202c] mb-3">Tổng số phiếu lấy ý kiến (0)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#e6fbf1] rounded-lg p-5 text-center shadow-sm">
                <p className="text-sm font-bold text-[#1a202c] mb-2">Đã trả lời</p>
                <p className="text-3xl font-bold text-[#1a202c]">0</p>
              </div>
              <div className="bg-[#fef8e6] rounded-lg p-5 text-center shadow-sm">
                <p className="text-sm font-bold text-[#1a202c] mb-2">Chưa trả lời</p>
                <p className="text-3xl font-bold text-[#1a202c]">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Phiên họp đang diễn ra" count={ongoingMeetings.length}>
            {loading ? (
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ) : ongoingMeetings.length === 0 ? (
              <EmptyState />
            ) : (
              ongoingMeetings.map((m) => <MeetingCard key={m.id} meeting={m} isOngoing={true} />)
            )}
          </SectionCard>

          <SectionCard
            title="Phiên họp sắp diễn ra"
            count={upcomingMeetings.length}
            showAction={true}
          >
            {loading ? (
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ) : upcomingMeetings.length === 0 ? (
              <EmptyState />
            ) : (
              upcomingMeetings.map((m) => <MeetingCard key={m.id} meeting={m} isOngoing={false} />)
            )}
          </SectionCard>

          <SectionCard title="Phiên họp chưa xác nhận" count={unconfirmedMeetings.length}>
            {unconfirmedMeetings.length === 0 ? <EmptyState /> : <div>Data here</div>}
          </SectionCard>

          <SectionCard title="Phiếu lấy ý kiến chưa trả lời" count={unansweredQuestions.length}>
            {unansweredQuestions.length === 0 ? <EmptyState /> : <div>Data here</div>}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
