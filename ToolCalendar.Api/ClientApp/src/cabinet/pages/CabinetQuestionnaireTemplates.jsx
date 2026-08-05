/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Eye,
  MoreVertical,
  FileText,
  ChevronRight,
  Loader2,
  Save,
  X,
  Trash2,
  Edit,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  'Content-Type': 'application/json',
})

export function CabinetQuestionnaireTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [templateName, setTemplateName] = useState('')

  const fetchTemplates = () => {
    setLoading(true)
    fetch('/api/phonghopkhonggiayto/questionnaire-templates', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        const data = Array.isArray(json) ? json : json.data || []
        setTemplates(data)
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const filtered = templates.filter(
    (t) => !search || t.name?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleOpenAdd = () => {
    setEditingId(null)
    setTemplateName('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (t) => {
    setEditingId(t.id)
    setTemplateName(t.name)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!templateName.trim()) return

    setIsSaving(true)
    try {
      const url = editingId
        ? `/api/phonghopkhonggiayto/questionnaire-templates/${editingId}`
        : '/api/phonghopkhonggiayto/questionnaire-templates'

      const method = editingId ? 'PUT' : 'POST'

      await fetch(url, {
        method,
        headers: AUTH_HEADER(),
        body: JSON.stringify({ name: templateName }),
      })

      setIsModalOpen(false)
      fetchTemplates()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mẫu phiếu này không?')) return

    try {
      await fetch(`/api/phonghopkhonggiayto/questionnaire-templates/${id}`, {
        method: 'DELETE',
        headers: AUTH_HEADER(),
      })
      fetchTemplates()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Quản lý mẫu phiếu lấy ý kiến</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <FileText size={15} />
            Xuất file
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-[#c8102e] hover:bg-[#a50e27] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={15} />
            Thêm mẫu PLYK
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table controls */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-700">Danh sách mẫu phiếu lấy ý kiến</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên mẫu phiếu..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e] w-72"
                />
              </div>
              <button className="flex items-center gap-1.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                <Filter size={13} />
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                <MoreVertical size={13} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 text-center">
                    STT
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tên mẫu
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
                      <td className="px-5 py-4" colSpan={3}>
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <FileText size={32} className="opacity-20 mb-3" />
                        <p className="text-sm font-medium">Không có dữ liệu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 text-center">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{t.name}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-400">
                          <button className="hover:text-gray-600 transition" title="Xem">
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="hover:text-blue-600 transition"
                            title="Sửa"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="hover:text-red-600 transition"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
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
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 bg-gray-50">
              <span>
                {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} /{' '}
                {filtered.length} bản ghi
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let start = Math.max(1, page - 2)
                  let end = Math.min(totalPages, start + 4)
                  start = Math.max(1, end - 4)
                  const p = start + i
                  return p <= totalPages ? (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded flex items-center justify-center font-medium transition ${page === p ? 'bg-[#c8102e] text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                    >
                      {p}
                    </button>
                  ) : null
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                >
                  »
                </button>
                <div className="ml-2 bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow-sm flex items-center gap-1 cursor-pointer">
                  10 / trang <ChevronRight size={10} className="rotate-90" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-0 rounded-xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-gray-800">
              {editingId ? 'Sửa mẫu phiếu' : 'Thêm mẫu phiếu lấy ý kiến'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên mẫu phiếu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
              placeholder="Nhập tên mẫu phiếu..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-gray-600"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !templateName.trim()}
              className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
            >
              {isSaving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
