/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Pencil,
  Trash2,
  MoreVertical,
  Building2,
  MapPin,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

const AUTH_HEADER = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const color =
    type === 'success'
      ? 'bg-green-50 border-green-400 text-green-800'
      : 'bg-red-50 border-red-400 text-red-800'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      className={`fixed bottom-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm text-sm font-medium animate-fade-in ${color}`}
    >
      <Icon size={17} className="shrink-0" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Status Toggle ────────────────────────────────────────────────────────────
function StatusToggle({ active, loading, onChange }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      title={active ? 'Đang hoạt động — click để tắt' : 'Không hoạt động — click để bật'}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
        loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'
      } ${active ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Room Form Modal ──────────────────────────────────────────────────────────
function RoomModal({ mode, room, departments, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    name: room?.name || '',
    departmentId: room?.departmentId || '',
    status: room?.status ?? 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Tên phòng họp không được để trống.')
      return
    }
    setSaving(true)
    setError('')

    const body = {
      name: form.name.trim(),
      departmentId: form.departmentId ? parseInt(form.departmentId) : null,
      status: parseInt(form.status),
    }

    const url = isEdit
      ? `/api/phonghopkhonggiayto/rooms/${room.id}`
      : '/api/phonghopkhonggiayto/rooms'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: AUTH_HEADER(),
        body: JSON.stringify(body),
      })
      const json = await res.json()
      // Global fetch interceptor trong main.jsx đã unwrap ApiResponse<T>
      // nên json ở đây ĐÃ là data rồi, không phải json.data
      if (!res.ok || json?.error || json?.success === false) {
        setError(json?.message || json?.error || 'Có lỗi xảy ra, vui lòng thử lại.')
        return
      }
      onSaved(json, isEdit ? 'updated' : 'created')
    } catch {
      setError('Không thể kết nối đến máy chủ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal box */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#c8102e]">
          <div className="flex items-center gap-2 text-white">
            <Building2 size={18} />
            <h2 className="font-bold text-base">
              {isEdit ? 'Chỉnh sửa phòng họp' : 'Thêm phòng họp mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tên phòng họp */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Tên phòng họp <span className="text-[#c8102e]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="VD: Hội trường A, tầng 1, Trụ sở Liên cơ quan"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition"
              autoFocus
            />
          </div>

          {/* Đơn vị */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Đơn vị quản lý
            </label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/25 focus:border-[#c8102e] transition bg-white"
            >
              <option value="">-- Không thuộc đơn vị cụ thể --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trạng thái */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Trạng thái</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, status: f.status === 1 ? 0 : 1 }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.status === 1 ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.status === 1 ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium ${form.status === 1 ? 'text-green-600' : 'text-gray-500'}`}
              >
                {form.status === 1 ? 'Đang hoạt động' : 'Không hoạt động'}
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
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
                'Cập nhật'
              ) : (
                'Thêm phòng họp'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirm({ room, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/phonghopkhonggiayto/rooms/${room.id}`, {
        method: 'DELETE',
        headers: AUTH_HEADER(),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        setError(json.message || 'Không thể xóa phòng họp này.')
        return
      }
      onDeleted(room.id)
    } catch {
      setError('Không thể kết nối đến máy chủ.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <Trash2 size={24} className="text-[#c8102e]" />
          </div>
          <h3 className="font-bold text-gray-800 text-lg mb-1">Xóa phòng họp?</h3>
          <p className="text-sm text-gray-500 mb-1">
            Bạn có chắc muốn xóa phòng họp{' '}
            <span className="font-semibold text-gray-700">"{room.name}"</span>?
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Hành động này không thể hoàn tác. Phòng họp đang có lịch họp trong tương lai sẽ không
            thể xóa.
          </p>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg w-full mb-4">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 text-sm bg-[#c8102e] hover:bg-[#a50e27] text-white rounded-lg font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dropdown action menu ─────────────────────────────────────────────────────
function ActionMenu({ room, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close, { once: true })
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
        title="Thêm tuỳ chọn"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setOpen(false)
              onEdit(room)
            }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Pencil size={13} className="text-blue-500" />
            Chỉnh sửa
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onDelete(room)
            }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 size={13} />
            Xóa phòng họp
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CabinetRooms() {
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [togglingId, setTogglingId] = useState(null)
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', room? }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const pageSize = 10

  const showToast = (message, type = 'success') => setToast({ message, type })

  // Fetch rooms & departments
  const fetchRooms = useCallback(() => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/rooms', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => setRooms(Array.isArray(json) ? json : json.data || []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchRooms()
    fetch('/api/phonghopkhonggiayto/rooms/departments', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => setDepartments(Array.isArray(json) ? json : json.data || []))
      .catch(() => setDepartments([]))
  }, [fetchRooms])

  // Toggle status inline
  const handleToggle = async (room) => {
    setTogglingId(room.id)
    const newStatus = room.status === 1 ? 0 : 1
    try {
      const res = await fetch(`/api/phonghopkhonggiayto/rooms/${room.id}/status`, {
        method: 'PUT',
        headers: AUTH_HEADER(),
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (res.ok && json.success !== false) {
        setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, status: newStatus } : r)))
        showToast(newStatus === 1 ? 'Đã bật phòng họp.' : 'Đã tắt phòng họp.')
      } else {
        showToast(json.message || 'Không thể cập nhật trạng thái.', 'error')
      }
    } catch {
      showToast('Lỗi kết nối máy chủ.', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  // After save (create or update)
  const handleSaved = (savedRoom, action) => {
    if (!savedRoom || typeof savedRoom !== 'object') {
      // Nếu dữ liệu trả về không hợp lệ, tải lại danh sách từ server
      fetchRooms()
      showToast(
        action === 'created' ? 'Thêm phòng họp thành công!' : 'Cập nhật phòng họp thành công!'
      )
      setModal(null)
      return
    }
    if (action === 'created') {
      setRooms((prev) => [savedRoom, ...prev])
      showToast('Thêm phòng họp thành công!')
    } else {
      setRooms((prev) => prev.map((r) => (r.id === savedRoom.id ? savedRoom : r)))
      showToast('Cập nhật phòng họp thành công!')
    }
    setModal(null)
  }

  // After delete
  const handleDeleted = (id) => {
    setRooms((prev) => prev.filter((r) => r.id !== id))
    setDeleteTarget(null)
    showToast('Xóa phòng họp thành công.')
  }

  // Filter & paginate
  const filtered = rooms.filter(
    (r) =>
      !search ||
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.departmentName || '').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Modal: Add / Edit */}
      {modal && (
        <RoomModal
          mode={modal.mode}
          room={modal.room}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Modal: Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          room={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Quản lý phòng họp</h1>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          Thêm phòng họp
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table header controls */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-700">
              Danh sách phòng họp
              {!loading && (
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({filtered.length} phòng)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên phòng họp..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e] w-64"
                />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                <Filter size={13} />
                Bộ lọc
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="w-10 px-4 py-3 text-left">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">
                    STT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tên phòng họp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Đơn vị
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3" colSpan={6}>
                        <div className="h-5 bg-gray-100 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <Building2 size={40} className="opacity-20 mb-3" />
                        <p className="text-sm font-medium">
                          {search ? 'Không tìm thấy phòng họp phù hợp' : 'Chưa có phòng họp nào'}
                        </p>
                        {!search && (
                          <button
                            onClick={() => setModal({ mode: 'add' })}
                            className="mt-3 flex items-center gap-1.5 text-xs text-[#c8102e] hover:underline"
                          >
                            <Plus size={12} />
                            Thêm phòng họp đầu tiên
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((room, idx) => (
                    <tr key={room.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 size={13} className="text-[#c8102e]" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 leading-tight">{room.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Tạo:{' '}
                              {room.createdAt
                                ? new Date(room.createdAt).toLocaleDateString('vi-VN')
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{room.departmentName || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusToggle
                          active={room.status === 1}
                          loading={togglingId === room.id}
                          onChange={() => handleToggle(room)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Xem chi tiết"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#c8102e] transition"
                          >
                            <Eye size={15} />
                          </button>
                          <ActionMenu
                            room={room}
                            onEdit={(r) => setModal({ mode: 'edit', room: r })}
                            onDelete={(r) => setDeleteTarget(r)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, filtered.length)} /{' '}
                {filtered.length} bản ghi
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded flex items-center justify-center font-medium transition ${
                      page === p ? 'bg-[#c8102e] text-white' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  »
                </button>
                <span className="ml-2 text-xs border border-gray-200 rounded px-2 py-1">
                  {pageSize} / trang
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
