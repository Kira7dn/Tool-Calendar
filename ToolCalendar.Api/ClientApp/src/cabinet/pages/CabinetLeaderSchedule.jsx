/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { MeetingModal } from '../components/MeetingModal'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

const getStartOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CabinetLeaderSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', meeting }
  const [expandedDays, setExpandedDays] = useState([0, 1, 2, 3, 4, 5, 6]) // 0 = Mon, 6 = Sun

  const fetchMeetings = () => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/meetings/schedule', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || json
        if (Array.isArray(data)) {
          setMeetings(data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMeetings()
  }, [])

  const handlePrevWeek = () => setCurrentDate((d) => addDays(d, -7))
  const handleNextWeek = () => setCurrentDate((d) => addDays(d, 7))

  const startOfWeek = getStartOfWeek(currentDate)
  const endOfWeek = addDays(startOfWeek, 6)

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(startOfWeek, i)
      const isSunday = i === 6
      const title = isSunday
        ? `Chủ nhật - ${formatDate(date)}`
        : `Thứ ${i + 2} - ${formatDate(date)}`
      return { date, title, index: i }
    })
  }, [startOfWeek])

  const toggleDay = (index) => {
    setExpandedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]
    )
  }

  const handleSaved = () => {
    setModal(null)
    fetchMeetings()
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[#c8102e]">
            {formatDate(startOfWeek)} - {formatDate(endOfWeek)}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevWeek}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextWeek}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên phiên họp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm w-64 focus:outline-none focus:border-[#c8102e] focus:ring-1 focus:ring-[#c8102e] transition"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-[#c8102e] text-[#c8102e] rounded-full hover:bg-red-50 text-sm font-medium transition">
            <Filter size={16} />
            Bộ lọc
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-[#c8102e] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Đang tải lịch họp...</span>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-4">
            {daysOfWeek.map((day) => {
              const dayMeetings = meetings
                .filter((m) => {
                  const mDate = new Date(m.startTime)
                  mDate.setHours(0, 0, 0, 0)
                  const isSameDay = mDate.getTime() === day.date.getTime()
                  const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
                  return isSameDay && matchesSearch
                })
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

              const isExpanded = expandedDays.includes(day.index)

              return (
                <div
                  key={day.index}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => toggleDay(day.index)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition border-b border-gray-200"
                  >
                    <h3 className="font-bold text-gray-800 text-[15px]">
                      {day.title} (Có {dayMeetings.length} cuộc họp)
                    </h3>
                    {isExpanded ? (
                      <ChevronUp className="text-gray-500" size={20} />
                    ) : (
                      <ChevronDown className="text-gray-500" size={20} />
                    )}
                  </button>

                  {isExpanded && dayMeetings.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-semibold w-16 text-center">STT</th>
                            <th className="px-6 py-3 font-semibold w-40">Thời gian</th>
                            <th className="px-6 py-3 font-semibold">Chủ đề cuộc họp</th>
                            <th className="px-6 py-3 font-semibold w-64">Địa điểm</th>
                            <th className="px-6 py-3 font-semibold w-32">Trạng thái</th>
                            <th className="px-6 py-3 font-semibold w-48">Chủ trì</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dayMeetings.map((m, idx) => (
                            <tr
                              key={m.id}
                              className="hover:bg-red-50/50 transition cursor-pointer"
                              onClick={() => {
                                fetch(`/api/phonghopkhonggiayto/meetings/${m.id}`, {
                                  headers: AUTH_HEADER(),
                                })
                                  .then((r) => r.json())
                                  .then((json) => {
                                    const fullMeeting = json.data || json
                                    setModal({ mode: 'edit', meeting: fullMeeting })
                                  })
                                  .catch((err) => console.error('Failed to fetch meeting', err))
                              }}
                            >
                              <td className="px-6 py-4 text-center text-gray-500">{idx + 1}</td>
                              <td className="px-6 py-4 font-medium text-gray-700">
                                {formatTime(m.startTime)} - {formatTime(m.endTime)}
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900 leading-snug uppercase">
                                {m.title}
                              </td>
                              <td className="px-6 py-4 text-gray-600">
                                {m.roomName || m.location}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    m.status === 'Đã hủy' || m.status === 'Hủy'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : m.status === 'Đang diễn ra'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : m.status === 'Hoàn thành'
                                          ? 'bg-gray-100 text-gray-700 border-gray-300'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-700">{m.presider}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isExpanded && dayMeetings.length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      Không có cuộc họp nào trong ngày này.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
