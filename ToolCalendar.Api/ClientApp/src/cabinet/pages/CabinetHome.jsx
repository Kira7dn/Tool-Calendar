/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Video,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  MapPin,
} from 'lucide-react'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

function StatRow({ color, label, value, percent }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex gap-6 text-sm text-gray-600">
        <span className="w-12 text-right font-semibold">{value}</span>
        <span className="w-14 text-right">{percent.toFixed(2)}</span>
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
          <Clock size={11} className="text-gray-400" />
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
          onClick={() => alert(`Tính năng phòng họp trực tuyến đang được phát triển. (Meeting ID: ${meeting.id})`)}
          className="text-xs px-3 py-1.5 bg-[#c8102e] text-white rounded-md hover:bg-[#a50e27] transition shadow-sm font-medium"
        >
          {isOngoing ? 'Vào họp' : 'Chi tiết'}
        </button>
      </div>
    </div>
  )
}

export function CabinetHome() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
  const [ongoingMeetings, setOngoingMeetings] = useState([])
  const [upcomingMeetings, setUpcomingMeetings] = useState([])
  const [stats, setStats] = useState({
    attended: 0,
    pending: 0,
    absent: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const promises = [
      fetch('/api/phonghopkhonggiayto/meetings/schedule', { headers: AUTH_HEADER() })
        .then((r) => r.json())
        .catch(() => null),
    ]
    Promise.all(promises).then(([scheduleData]) => {
      if (scheduleData && scheduleData.data) {
        const now = new Date()
        const all = scheduleData.data
        setOngoingMeetings(
          all.filter((m) => {
            const s = new Date(m.startTime)
            const e = new Date(m.endTime)
            return s <= now && e >= now
          })
        )
        setUpcomingMeetings(
          all
            .filter((m) => new Date(m.startTime) > now)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .slice(0, 5)
        )
        // Mock stats from total meetings (replace with real API later)
        const total = all.length
        setStats({
          attended: Math.floor(total * 0.7),
          pending: Math.floor(total * 0.2),
          absent: Math.floor(total * 0.1),
          total,
        })
      }
      setLoading(false)
    })
  }, [month])

  const attended = stats.total > 0 ? (stats.attended / stats.total) * 100 : 0
  const pending = stats.total > 0 ? (stats.pending / stats.total) * 100 : 0
  const absent = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Trang chủ</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan tình trạng họp và phiên họp diễn ra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Thống kê tình trạng tham gia họp */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <CalendarCheck size={16} className="text-blue-600" />
              </div>
              <h2 className="font-semibold text-gray-800">Thống kê tình trạng tham gia họp</h2>
            </div>
            {/* Month picker */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600">
              <span>{month}</span>
              <span className="text-gray-300">×</span>
            </div>
          </div>
          <div className="p-5">
            {/* Mini donut visual */}
            <div className="flex items-center gap-6 mb-4">
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.8" />
                  {stats.total > 0 && (
                    <>
                      <circle
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3.8"
                        strokeDasharray={`${attended} ${100 - attended}`}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-800">{stats.total}</span>
                  <span className="text-[10px] text-gray-400">tổng</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-600 flex-1">Có tham gia</span>
                  <span className="text-xs font-bold text-gray-800">{stats.attended}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-gray-600 flex-1">Chưa xác nhận</span>
                  <span className="text-xs font-bold text-gray-800">{stats.pending}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-xs text-gray-600 flex-1">Vắng mặt</span>
                  <span className="text-xs font-bold text-gray-800">{stats.absent}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2 px-1">
                <span>Trạng thái</span>
                <div className="flex gap-6">
                  <span className="w-12 text-right">Giá trị</span>
                  <span className="w-14 text-right">Tỷ lệ (%)</span>
                </div>
              </div>
              <StatRow
                color="bg-green-500"
                label="Có tham gia"
                value={stats.attended}
                percent={attended}
              />
              <StatRow
                color="bg-amber-400"
                label="Chưa xác nhận tham gia"
                value={stats.pending}
                percent={pending}
              />
              <StatRow color="bg-red-400" label="Vắng mặt" value={stats.absent} percent={absent} />
              <StatRow color="bg-gray-200" label="Tổng" value={stats.total} percent={100} />
            </div>
          </div>
        </div>

        {/* Right column: Ongoing + Upcoming */}
        <div className="flex flex-col gap-6">
          {/* Phiên họp đang diễn ra */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <Video size={16} className="text-green-600" />
                </div>
                <h2 className="font-semibold text-gray-800">
                  Phiên họp đang diễn ra
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    ({ongoingMeetings.length})
                  </span>
                </h2>
              </div>
              {ongoingMeetings.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : ongoingMeetings.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <Video size={22} className="opacity-30" />
                  </div>
                  <p className="text-sm">Không có dữ liệu</p>
                </div>
              ) : (
                ongoingMeetings.map((m) => <MeetingCard key={m.id} meeting={m} isOngoing={true} />)
              )}
            </div>
          </div>

          {/* Phiên họp sắp diễn ra */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <CalendarClock size={16} className="text-blue-600" />
                </div>
                <h2 className="font-semibold text-gray-800">
                  Phiên họp sắp diễn ra
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    ({upcomingMeetings.length})
                  </span>
                </h2>
              </div>
              <button className="text-xs text-[#c8102e] hover:underline flex items-center gap-0.5">
                Xem tất cả <ChevronRight size={12} />
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : upcomingMeetings.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <CalendarClock size={22} className="opacity-30" />
                  </div>
                  <p className="text-sm">Không có dữ liệu</p>
                </div>
              ) : (
                upcomingMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} isOngoing={false} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
