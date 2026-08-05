/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react'
import { Search, Plus, FileText, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_STYLES = {
  'Đã xử lý': 'bg-green-100 text-green-700',
  'Đang xử lý': 'bg-blue-100 text-blue-700',
  'Chưa xử lý': 'bg-orange-100 text-orange-700',
}

export function CabinetConclusions() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [meetings, setMeetings] = useState([])

  // Form state
  const [formMeetingId, setFormMeetingId] = useState('')
  const [formFileName, setFormFileName] = useState('')
  const [formStatus, setFormStatus] = useState('Chưa xử lý')

  const pageSize = 10

  const fetchData = (currentPage = 1, currentSearch = search) => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(pageSize),
    })
    if (currentSearch) params.append('search', currentSearch)

    fetch(`/api/phonghopkhonggiayto/conclusions?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setData(json.data.items || [])
          setTotal(json.data.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fetchMeetings = () => {
    fetch('/api/phonghopkhonggiayto/meetings/schedule')
      .then((r) => r.json())
      .then((json) => setMeetings(json.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchData()
    fetchMeetings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e) => {
    const q = e.target.value
    setSearch(q)
    setPage(1)
    fetchData(1, q)
  }

  const handleCreate = async () => {
    if (!formMeetingId) return
    setSaving(true)
    try {
      const body = {
        meetingId: Number(formMeetingId),
        fileName: formFileName || null,
        status: formStatus,
        progress: 0,
      }
      const resp = await fetch('/api/phonghopkhonggiayto/conclusions', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const json = await resp.json()
      if (json.success) {
        fetchData()
        setIsAddOpen(false)
        setFormMeetingId('')
        setFormFileName('')
        setFormStatus('Chưa xử lý')
      }
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const stt = (idx) => (page - 1) * pageSize + idx + 1

  return (
    <div className="flex flex-col h-full bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-xl text-slate-800">Tra cứu kết luận sau phiên họp</h3>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm mới
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="font-medium text-slate-800">Danh sách kết luận ({total})</div>
        <div className="flex items-center gap-2">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên phiên họp, file..."
              className="pl-9 bg-white"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500"
            onClick={() => fetchData(page)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">STT</TableHead>
              <TableHead>Phiên họp</TableHead>
              <TableHead>File kết luận</TableHead>
              <TableHead className="text-center">Tiến độ</TableHead>
              <TableHead>Người xử lý</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mb-4" />
                    <p>Không có dữ liệu</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell className="text-center">{stt(idx)}</TableCell>
                  <TableCell className="font-medium text-gray-900">{row.meetingTitle}</TableCell>
                  <TableCell className="text-gray-600">{row.fileName || '—'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-[#c8102e] h-1.5 rounded-full"
                          style={{ width: `${row.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{row.progress || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{row.lastHandlerName || '—'}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[row.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => {
                setPage(i + 1)
                fetchData(i + 1)
              }}
              className={`w-8 h-8 rounded text-sm font-medium transition ${
                page === i + 1
                  ? 'bg-[#c8102e] text-white'
                  : 'text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Thêm kết luận sau phiên họp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>
                Phiên họp <span className="text-red-500">*</span>
              </Label>
              <Select value={formMeetingId} onValueChange={setFormMeetingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phiên họp" />
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tên file kết luận</Label>
              <Input
                placeholder="Tên file kết luận (ví dụ: KL_2025_01.pdf)"
                value={formFileName}
                onChange={(e) => setFormFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chưa xử lý">Chưa xử lý</SelectItem>
                  <SelectItem value="Đang xử lý">Đang xử lý</SelectItem>
                  <SelectItem value="Đã xử lý">Đã xử lý</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
                onClick={handleCreate}
                disabled={saving || !formMeetingId}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
