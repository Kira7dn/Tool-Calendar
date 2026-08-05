/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { CabinetQuestionnaireTemplates } from './CabinetQuestionnaireTemplates'
import { CabinetQuestionnaireCreate } from './CabinetQuestionnaireCreate'
import {
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

const TABS = [
  { id: 'pending', label: 'Phiếu chưa trả lời' },
  { id: 'answered', label: 'Phiếu đã trả lời' },
  { id: 'expired', label: 'Phiếu đã hết hạn' },
  { id: 'created', label: 'Phiếu đã tạo' },
]

const STATUS_BADGE = {
  pending: {
    label: 'Chờ trả lời',
    class: 'bg-amber-100 text-amber-700 border border-amber-200',
    icon: Clock,
  },
  answered: {
    label: 'Đã trả lời',
    class: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    icon: CheckCircle2,
  },
  expired: {
    label: 'Hết hạn',
    class: 'bg-red-100 text-red-700 border border-red-200',
    icon: XCircle,
  },
  created: {
    label: 'Đã tạo',
    class: 'bg-blue-100 text-blue-700 border border-blue-200',
    icon: FileText,
  },
}

export function CabinetQuestionnaire() {
  const [activeTab, setActiveTab] = useState('pending')
  const [activeSidebar, setActiveSidebar] = useState('list')
  const [mode, setMode] = useState('list') // 'list' | 'create'
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const fetchQuestionnaires = () => {
    setLoading(true)
    setPage(1)
    fetch('/api/phonghopkhonggiayto/questionnaires', { headers: AUTH_HEADER() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const data = Array.isArray(json.data) ? json.data : []
          setQuestionnaires(data)
        } else if (Array.isArray(json)) {
          setQuestionnaires(json)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchQuestionnaires()
  }, [])

  const filtered = questionnaires.filter(
    (q) => !search || q.title?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const sideNavItems = [
    { id: 'list', label: 'Danh sách phiếu', icon: FileText },
    { id: 'template', label: 'Mẫu phiếu lấy ý kiến', icon: FileText },
  ]

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50">
      {/* Sub-sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {sideNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveSidebar(item.id)
              setMode('list')
            }}
            className={`flex items-center gap-3 px-6 py-4 text-sm font-medium transition-colors border-l-4 ${
              activeSidebar === item.id
                ? 'border-[#c8102e] text-[#c8102e] bg-red-50/50'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Area */}
      {mode === 'create' ? (
        <CabinetQuestionnaireCreate
          onBack={() => setMode('list')}
          onSaved={() => {
            setMode('list')
            fetchQuestionnaires()
          }}
        />
      ) : activeSidebar === 'template' ? (
        <CabinetQuestionnaireTemplates />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <h1 className="text-xl font-bold text-gray-800">Quản lý phiếu lấy ý kiến</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm phiếu..."
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#c8102e] focus:ring-1 focus:ring-[#c8102e] w-64 transition-all"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Filter size={16} />
                Lọc
              </button>
              <button
                onClick={() => setMode('create')}
                className="flex items-center gap-2 px-4 py-2 bg-[#c8102e] text-white rounded-lg text-sm font-medium hover:bg-[#a50e27] transition-colors shadow-sm"
              >
                <Plus size={16} />
                Thêm mới
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white px-6 border-b border-gray-200 shrink-0">
            <div className="flex gap-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 text-sm font-medium border-b-2 transition-colors relative ${
                    activeTab === tab.id
                      ? 'border-[#c8102e] text-[#c8102e]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute -bottom-[2px] left-0 w-full h-[2px] bg-[#c8102e] rounded-t-full shadow-[0_-2px_8px_rgba(200,16,46,0.5)]"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Table controls */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-700">Danh sách phiếu lấy ý kiến</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên phiếu..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e] w-60"
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
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">
                      STT
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Tên phiếu
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Chuyên viên phụ trách
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Hạn trả lời
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Trạng thái phiếu
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4" colSpan={6}>
                          <div className="h-4 bg-gray-100 rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center text-gray-400">
                          {/* Illustration matching the screenshot */}
                          <div className="w-20 h-20 mb-3 relative">
                            <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
                              <FileText size={32} className="opacity-20" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-[10px] font-bold text-gray-400">?</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium">Không có dữ liệu</p>
                          <p className="text-xs mt-1 text-gray-300">
                            {search
                              ? 'Không tìm thấy phiếu phù hợp'
                              : 'Chưa có phiếu lấy ý kiến nào trong mục này'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paged.map((q, idx) => {
                      const badge = STATUS_BADGE[activeTab] || STATUS_BADGE.pending
                      const Icon = badge.icon
                      return (
                        <tr
                          key={q.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3 text-gray-500">
                            {(page - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-800">{q.title}</p>
                            {q.description && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">
                                {q.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {q.assignedTo || q.createdByName || '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {q.deadline ? new Date(q.deadline).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${badge.class}`}
                            >
                              <Icon size={11} />
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button className="text-xs text-[#c8102e] hover:underline flex items-center gap-0.5 mx-auto">
                              Chi tiết <ChevronRight size={11} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
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
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
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
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                  >
                    »
                  </button>
                  <span className="ml-2 text-xs border border-gray-200 rounded px-2 py-1">
                    10 / trang
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
