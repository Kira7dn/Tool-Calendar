/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react'
import { Search, Plus, FileText, Trash2, Loader2, UploadCloud, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

const fmt = (dt) => {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export function CabinetNotebook() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [meetings, setMeetings] = useState([])

  // Form state
  const [formMeetingId, setFormMeetingId] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formFiles, setFormFiles] = useState([])
  const fileInputRef = useRef(null)

  const fetchNotes = (currentSearch = '') => {
    setLoading(true)
    const params = currentSearch ? `?search=${encodeURIComponent(currentSearch)}` : ''
    fetch(`/api/phonghopkhonggiayto/notes${params}`)
      .then((r) => r.json())
      .then((json) => setData(json.data || []))
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
    fetchNotes()
    fetchMeetings()
  }, [])

  const handleSearch = (e) => {
    const q = e.target.value
    setSearch(q)
    fetchNotes(q)
  }

  const handleAddFile = (e) => {
    const files = Array.from(e.target.files)
    setFormFiles((prev) => [...prev, ...files])
  }

  const handleRemoveFile = (idx) => {
    setFormFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (!formMeetingId || !formContent.trim()) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('meetingId', formMeetingId)
      formData.append('content', formContent)
      formFiles.forEach((f) => formData.append('files', f))

      const resp = await fetch('/api/phonghopkhonggiayto/notes', {
        method: 'POST',
        body: formData,
      })
      const json = await resp.json()
      if (json.success) {
        fetchNotes(search)
        setIsAddModalOpen(false)
        setFormMeetingId('')
        setFormContent('')
        setFormFiles([])
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Bạn có chắc muốn xóa ghi chú này?')) return
    await fetch(`/api/phonghopkhonggiayto/notes/${id}`, {
      method: 'DELETE',
    })
    fetchNotes(search)
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-xl text-slate-800">Quản lý sổ tay</h3>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm mới
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="font-medium text-slate-800">Danh sách ghi chú ({data.length})</div>
        <div className="flex items-center gap-2">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên phiên họp..."
              className="pl-9 bg-white"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500"
            onClick={() => fetchNotes(search)}
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
              <TableHead>Tên phiên họp</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-center">Đính kèm</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mb-4" />
                    <p>Không có dữ liệu</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => {
                let attachments = []
                try {
                  attachments = JSON.parse(row.attachmentPaths || '[]')
                } catch (e) {
                  console.error('Error parsing attachments', e)
                }
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-gray-900">{row.meetingTitle}</TableCell>
                    <TableCell
                      className="text-gray-600 max-w-[200px] truncate"
                      title={row.content || ''}
                    >
                      {row.content || '—'}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{fmt(row.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      {attachments.length > 0 ? (
                        <span className="text-xs text-[#c8102e] font-medium">
                          {attachments.length} file
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600"
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Note Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Thêm mới ghi chú</DialogTitle>
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
              <p className="text-xs text-gray-500">
                Danh sách phiên họp chọn để lưu ghi chú là các phiên họp cá nhân được mời
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Ghi chú <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Nhập ghi chú"
                rows={6}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tài liệu đính kèm ({formFiles.length}) :</Label>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                accept=".doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx,.pdf"
                onChange={handleAddFile}
              />
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm font-medium">
                  <span className="text-red-500">Chọn file</span> hoặc Kéo thả từ máy tính
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tối đa 50MB, định dạng .doc, .docx, .xls, .xlsx, .txt, .ppt, .pptx, .pdf
                </p>
              </div>
              {formFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {formFiles.map((f, i) => (
                    <li
                      key={f.name}
                      className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm"
                    >
                      <span className="truncate text-gray-700">{f.name}</span>
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="ml-2 text-red-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Hủy
              </Button>
              <Button
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
                onClick={handleCreate}
                disabled={saving || !formMeetingId || !formContent.trim()}
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
