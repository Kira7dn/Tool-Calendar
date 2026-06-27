/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Eye,
  MoreVertical,
  Filter,
  ToggleLeft,
  ToggleRight,
  Building2,
  MapPin,
} from 'lucide-react'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

function StatusToggle({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-green-600">
      <span className="w-9 h-5 bg-green-500 rounded-full flex items-center justify-end pr-0.5 transition-all">
        <span className="w-4 h-4 bg-white rounded-full shadow" />
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-gray-400">
      <span className="w-9 h-5 bg-gray-300 rounded-full flex items-center pl-0.5 transition-all">
        <span className="w-4 h-4 bg-white rounded-full shadow" />
      </span>
    </span>
  )
}

export function CabinetRooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  useEffect(() => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/rooms', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        const data = Array.isArray(json) ? json : json.data || []
        setRooms(data)
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = rooms.filter(
    (r) =>
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.location?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Quản lý phòng họp</h1>
        <button className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus size={15} />
          Thêm phòng họp
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table header controls */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-700">Danh sách phòng họp</h2>
            <div className="flex items-center gap-2">
              {/* Search */}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
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
                        <p className="text-sm">
                          {search ? 'Không tìm thấy phòng họp phù hợp' : 'Chưa có phòng họp nào'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((room, idx) => (
                    <tr key={room.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 size={13} className="text-[#c8102e]" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 leading-tight">{room.name}</p>
                            {room.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} />
                                {room.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {room.organizationUnit || room.unit || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusToggle active={room.isActive !== false} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Xem chi tiết"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#c8102e] transition"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            title="Thêm tuỳ chọn"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
                          >
                            <MoreVertical size={15} />
                          </button>
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
