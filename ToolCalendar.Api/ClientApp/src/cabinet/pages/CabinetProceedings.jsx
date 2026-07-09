/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react'
import {
  Folder,
  MoreVertical,
  Search,
  Download,
  Plus,
  ArrowUpDown,
  RefreshCw,
  ChevronDown,
  Loader2,
  FileText,
} from 'lucide-react'
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

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  'Content-Type': 'application/json',
})

const fmt = (dt) => {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function CabinetProceedings() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [proceedings, setProceedings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedProceeding, setSelectedProceeding] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [searchLeft, setSearchLeft] = useState('')
  const [searchRight, setSearchRight] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formMeetingId, setFormMeetingId] = useState('')
  const [allMeetings, setAllMeetings] = useState([])
  const [saving, setSaving] = useState(false)

  const fetchProceedings = () => {
    setLoadingList(true)
    fetch('/api/phonghopkhonggiayto/proceedings', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => setProceedings(json.data || []))
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }

  const fetchDetail = (id) => {
    setLoadingDetail(true)
    fetch(`/api/phonghopkhonggiayto/proceedings/${id}`, { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        setSelectedProceeding(json.data)
        setMeetings(json.data?.meetings || [])
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }

  const fetchAllMeetings = () => {
    fetch('/api/phonghopkhonggiayto/meetings/schedule', { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => setAllMeetings(json.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchProceedings()
    fetchAllMeetings()
  }, [])

  const handleSelectProceeding = (item) => {
    setSelectedId(item.id)
    fetchDetail(item.id)
  }

  const handleCreate = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const body = {
        name: formName,
        description: formDesc,
        meetingIds: formMeetingId ? [Number(formMeetingId)] : [],
      }
      const resp = await fetch('/api/phonghopkhonggiayto/proceedings', {
        method: 'POST',
        headers: AUTH_HEADER(),
        body: JSON.stringify(body),
      })
      const json = await resp.json()
      if (json.success) {
        fetchProceedings()
        setIsAddModalOpen(false)
        setFormName('')
        setFormDesc('')
        setFormMeetingId('')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredProceedings = proceedings.filter((p) =>
    p.name?.toLowerCase().includes(searchLeft.toLowerCase())
  )

  const filteredMeetings = meetings.filter((m) =>
    m.title?.toLowerCase().includes(searchRight.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Left Sidebar */}
      <div className="w-[400px] flex-shrink-0 bg-white rounded-lg p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-slate-800">Danh sách kỷ yếu</h3>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm mới kỷ yếu
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên kỷ yếu"
              className="pl-9 bg-white"
              value={searchLeft}
              onChange={(e) => setSearchLeft(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="text-gray-500" onClick={fetchProceedings}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredProceedings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mb-2" />
              <p className="text-sm">Chưa có kỷ yếu nào</p>
            </div>
          ) : (
            filteredProceedings.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectProceeding(item)}
                className={`flex items-center justify-between p-3 rounded-md cursor-pointer mb-1 ${
                  selectedId === item.id ? 'bg-red-50 border border-red-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Folder
                    className={`h-5 w-5 ${selectedId === item.id ? 'text-[#c8102e]' : 'text-gray-400'}`}
                  />
                  <span
                    className={`text-sm ${selectedId === item.id ? 'font-semibold text-[#c8102e]' : 'text-gray-700'}`}
                  >
                    {item.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 bg-white rounded-lg p-6 shadow-sm flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <h3 className="font-semibold text-lg text-slate-800 max-w-[400px]">
            {selectedProceeding
              ? selectedProceeding.name
              : 'Chọn kỷ yếu để xem danh sách phiên họp'}
          </h3>
          {selectedProceeding && (
            <div className="flex items-center gap-3">
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm phiên họp"
                  className="pl-9 bg-white"
                  value={searchRight}
                  onChange={(e) => setSearchRight(e.target.value)}
                />
              </div>
              <Button variant="outline" className="text-[#c8102e] border-[#c8102e] hover:bg-red-50">
                <Download className="h-4 w-4 mr-2" />
                Xuất file
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !selectedProceeding ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Folder className="h-14 w-14 mb-3" />
              <p className="text-sm">Chọn một kỷ yếu ở bên trái để xem danh sách phiên họp</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mb-2" />
              <p className="text-sm">Kỷ yếu này chưa có phiên họp nào</p>
            </div>
          ) : (
            filteredMeetings.map((m) => (
              <div
                key={m.id}
                className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-gray-300 transition-colors cursor-pointer"
              >
                <span className="font-medium text-slate-800 text-sm">
                  {m.title}{' '}
                  <span className="font-normal text-gray-500">
                    ({fmt(m.startTime)} - {fmt(m.endTime)})
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Thêm mới kỷ yếu phiên họp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>
                Tên kỷ yếu <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Nhập tên kỷ yếu"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Gắn phiên họp (tùy chọn)</Label>
              <Select value={formMeetingId} onValueChange={setFormMeetingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phiên họp" />
                </SelectTrigger>
                <SelectContent>
                  {allMeetings.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                placeholder="Nhập mô tả"
                rows={4}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
                onClick={handleCreate}
                disabled={saving || !formName.trim()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Thêm mới
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
