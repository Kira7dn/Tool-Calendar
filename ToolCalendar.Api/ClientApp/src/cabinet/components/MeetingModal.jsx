/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  UserCheck,
  FileText,
  StickyNote,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from 'lucide-react'

const AUTH_HEADER = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

// Format datetime-local value
function toDatetimeLocal(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MeetingModal({ meeting, onClose, onSaved }) {
  const isEdit = !!meeting
  const [rooms, setRooms] = useState([])
  const [users, setUsers] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('basic')

  const [form, setForm] = useState({
    title: meeting?.title || '',
    startTime: meeting?.startTime ? toDatetimeLocal(meeting.startTime) : '',
    endTime: meeting?.endTime ? toDatetimeLocal(meeting.endTime) : '',
    roomId: meeting?.roomId || '',
    location: meeting?.location || '',
    presider: meeting?.presider || '',
    preparingUnit: meeting?.preparingUnit || '',
    content: meeting?.content || '',
    notes: meeting?.notes || '',
    organizingUnit: meeting?.organizingUnit || '',
    expectedAttendees: meeting?.expectedAttendees || 0,
    participantUserIds: meeting?.participants?.map((p) => p.userId) || [],
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  useEffect(() => {
    setLoadingOptions(true)
    Promise.all([
      fetch('/api/phonghopkhonggiayto/rooms', { headers: AUTH_HEADER() })
        .then((r) => r.json())
        .then((j) => setRooms(Array.isArray(j) ? j : j.data || [])),
      fetch('/api/admin/users', { headers: AUTH_HEADER() })
        .then((r) => r.json())
        .then((j) => setUsers(Array.isArray(j) ? j : j.data || [])),
    ])
      .catch(() => {})
      .finally(() => setLoadingOptions(false))
  }, [])

  const toggleParticipant = (userId) => {
    setForm((f) => ({
      ...f,
      participantUserIds: f.participantUserIds.includes(userId)
        ? f.participantUserIds.filter((id) => id !== userId)
        : [...f.participantUserIds, userId],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Tên phiên họp không được để trống.')
      return
    }
    if (!form.startTime) {
      setError('Vui lòng chọn thời gian bắt đầu.')
      return
    }
    if (!form.endTime) {
      setError('Vui lòng chọn thời gian kết thúc.')
      return
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }
    if (!form.roomId) {
      setError('Vui lòng chọn phòng họp.')
      return
    }

    setSaving(true)
    setError('')

    const body = {
      title: form.title.trim(),
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      roomId: parseInt(form.roomId),
      location: form.location.trim() || null,
      presider: form.presider.trim() || null,
      preparingUnit: form.preparingUnit.trim() || null,
      content: form.content.trim() || null,
      notes: form.notes.trim() || null,
      organizingUnit: form.organizingUnit.trim() || null,
      expectedAttendees: parseInt(form.expectedAttendees) || 0,
      participantUserIds: form.participantUserIds,
    }

    const url = isEdit
      ? `/api/phonghopkhonggiayto/meetings/${meeting.id}`
      : '/api/phonghopkhonggiayto/meetings'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, { method, headers: AUTH_HEADER(), body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        setError(json.message || 'Có lỗi xảy ra, vui lòng thử lại.')
        return
      }
      onSaved(json.data, isEdit ? 'updated' : 'created')
    } catch {
      setError('Không thể kết nối đến máy chủ.')
    } finally {
      setSaving(false)
    }
  }

  const SECTIONS = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: Calendar },
    { id: 'detail', label: 'Nội dung họp', icon: FileText },
    { id: 'participants', label: 'Danh sách tham dự', icon: Users },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#c8102e] shrink-0">
          <div className="flex items-center gap-2 text-white">
            <Calendar size={18} />
            <h2 className="font-bold text-base">
              {isEdit ? 'Chỉnh sửa phiên họp' : 'Tạo phiên họp mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-gray-200 shrink-0 bg-gray-50">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === s.id
                  ? 'border-[#c8102e] text-[#c8102e] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* ── SECTION: Thông tin cơ bản ── */}
            {activeSection === 'basic' && (
              <div className="space-y-4">
                {/* Tên phiên họp */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Tên phiên họp / Nội dung <span className="text-[#c8102e]">*</span>
                  </label>
                  <textarea
                    value={form.title}
                    onChange={set('title')}
                    rows={2}
                    placeholder="VD: Họp về kiểm đếm tiến độ Đề án ứng dụng CNTT trong đảm bảo ANTT, VSMT"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition resize-none"
                    autoFocus
                  />
                </div>

                {/* Thời gian */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      <Clock size={13} className="inline mr-1" />
                      Bắt đầu <span className="text-[#c8102e]">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={set('startTime')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      <Clock size={13} className="inline mr-1" />
                      Kết thúc <span className="text-[#c8102e]">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={set('endTime')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                    />
                  </div>
                </div>

                {/* Phòng họp */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <Building2 size={13} className="inline mr-1" />
                    Phòng họp <span className="text-[#c8102e]">*</span>
                  </label>
                  {loadingOptions ? (
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ) : (
                    <select
                      value={form.roomId}
                      onChange={set('roomId')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition bg-white"
                    >
                      <option value="">-- Chọn phòng họp --</option>
                      {rooms
                        .filter((r) => r.status === 1)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Địa điểm chi tiết */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <MapPin size={13} className="inline mr-1" />
                    Địa điểm chi tiết
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={set('location')}
                    placeholder="VD: Tại Phòng họp tầng 4, Trụ sở HĐND - UBND phường"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                  />
                </div>

                {/* Đơn vị tổ chức */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Đơn vị tổ chức
                  </label>
                  <input
                    type="text"
                    value={form.organizingUnit}
                    onChange={set('organizingUnit')}
                    placeholder="VD: Văn phòng HĐND - UBND phường"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                  />
                </div>
              </div>
            )}

            {/* ── SECTION: Nội dung họp ── */}
            {activeSection === 'detail' && (
              <div className="space-y-4">
                {/* Người chủ trì */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <UserCheck size={13} className="inline mr-1" />
                    Người chủ trì
                  </label>
                  <input
                    type="text"
                    value={form.presider}
                    onChange={set('presider')}
                    placeholder="VD: Đ/c Nguyễn Đức Dương - Phó Chủ tịch UBND (chủ trì)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                  />
                </div>

                {/* Đơn vị chuẩn bị tài liệu */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Đơn vị chuẩn bị tài liệu
                  </label>
                  <input
                    type="text"
                    value={form.preparingUnit}
                    onChange={set('preparingUnit')}
                    placeholder="VD: Phòng VH-XH chuẩn bị tài liệu"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                  />
                </div>

                {/* Số lượng đại biểu */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Số lượng đại biểu dự kiến
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.expectedAttendees}
                    onChange={set('expectedAttendees')}
                    className="w-40 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
                  />
                </div>

                {/* Nội dung chương trình họp */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <FileText size={13} className="inline mr-1" />
                    Nội dung / Chương trình họp
                  </label>
                  <textarea
                    value={form.content}
                    onChange={set('content')}
                    rows={5}
                    placeholder="Nhập nội dung chương trình cuộc họp, các điểm thảo luận..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition resize-none"
                  />
                </div>

                {/* Ghi chú */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <StickyNote size={13} className="inline mr-1" />
                    Ghi chú thêm
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={set('notes')}
                    rows={3}
                    placeholder="Các ghi chú, yêu cầu đặc biệt cho phiên họp..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── SECTION: Danh sách tham dự ── */}
            {activeSection === 'participants' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Chọn thành viên tham dự
                    {form.participantUserIds.length > 0 && (
                      <span className="ml-2 bg-[#c8102e] text-white text-xs px-2 py-0.5 rounded-full">
                        {form.participantUserIds.length} đã chọn
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, participantUserIds: [] }))}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>

                {loadingOptions ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Không có dữ liệu người dùng
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {users.map((u) => {
                      const selected = form.participantUserIds.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleParticipant(u.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${
                            selected
                              ? 'bg-red-50 border-[#c8102e] text-[#c8102e]'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              selected ? 'bg-[#c8102e] text-white' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {(u.fullName || u.username || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {u.fullName || u.username}
                            </p>
                            {u.departmentName && (
                              <p className="text-xs text-gray-400 truncate">{u.departmentName}</p>
                            )}
                          </div>
                          {selected && <CheckCircle2 size={15} className="shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-[#c8102e] hover:bg-[#a50e27] text-white rounded-lg font-semibold transition disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : isEdit ? (
                  'Lưu thay đổi'
                ) : (
                  'Tạo phiên họp'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
