/* eslint-disable react/prop-types, no-unused-vars, no-alert, react/no-array-index-key */
import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  Check,
  UploadCloud,
  X,
  Plus,
  Users,
  Calendar,
  MapPin,
  AlignLeft,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

export function CabinetMeetingCreate({ onBack, onSaved }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [rooms, setRooms] = useState([])
  const [proceedings, setProceedings] = useState([])
  const [users, setUsers] = useState([])

  const [formData, setFormData] = useState({
    title: '',
    proceedingId: '',
    singleContent: false,
    startTime: '',
    endTime: '',
    roomId: '',
    meetingType: '',
    onlineMeetingUrl: '',
    location: '',
  })

  const [selectedUsers, setSelectedUsers] = useState([])
  const [programFiles, setProgramFiles] = useState([])
  const [invitationFiles, setInvitationFiles] = useState([])

  const programInputRef = useRef(null)
  const invitationInputRef = useRef(null)

  useEffect(() => {
    // Fetch Rooms
    fetch('/api/phonghopkhonggiayto/rooms', { headers: AUTH_HEADER() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRooms(json.data || [])
      })
      .catch(() => {})

    // Fetch Proceedings
    fetch('/api/phonghopkhonggiayto/proceedings', { headers: AUTH_HEADER() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setProceedings(json.data || [])
      })
      .catch(() => {})

    // Fetch Users
    fetch('/api/users', { headers: AUTH_HEADER() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setUsers(json.data || [])
      })
      .catch(() => {})
  }, [])

  const handleFileChange = (e, setFiles) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (idx, setFiles) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.startTime || !formData.endTime) {
      alert('Vui lòng nhập đầy đủ tên phiên họp và thời gian')
      return
    }

    setLoading(true)
    const requestJson = {
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      roomId: formData.roomId ? parseInt(formData.roomId) : null,
      location: formData.location,
      proceedingId: formData.proceedingId ? parseInt(formData.proceedingId) : null,
      meetingType: formData.meetingType,
      onlineMeetingUrl: formData.onlineMeetingUrl,
      participantUserIds: selectedUsers,
    }

    const fd = new FormData()
    fd.append('requestJson', JSON.stringify(requestJson))

    programFiles.forEach((file) => {
      fd.append('programFiles', file)
    })

    invitationFiles.forEach((file) => {
      fd.append('invitationFiles', file)
    })

    try {
      const res = await fetch('/api/phonghopkhonggiayto/meetings', {
        method: 'POST',
        headers: AUTH_HEADER(),
        body: fd,
      })
      const json = await res.json()
      if (json.success) {
        onSaved()
      } else {
        alert(json.message || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { id: 1, title: 'Chi tiết phiên họp' },
    { id: 2, title: 'Thành phần tham dự' },
    { id: 3, title: 'Nội dung họp' },
    { id: 4, title: 'Sơ đồ vị trí' },
  ]

  const renderFileUploader = (label, files, setFiles, inputRef) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name={`type_${label}`} defaultChecked className="text-blue-600" />
            Tải tài liệu
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name={`type_${label}`} className="text-blue-600" />
            Nhập văn bản
          </label>
        </div>
      </div>
      <div
        className="border-2 border-dashed border-gray-200 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition"
        onClick={() => inputRef.current?.click()}
      >
        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500 mb-2">
          <UploadCloud size={20} />
        </div>
        <p className="text-sm text-gray-500 mb-1">Click hoặc kéo thả file vào đây để tải lên</p>
        <p className="text-xs text-gray-400">PDF, DOC, DOCX (Max 20MB)</p>
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          multiple
          onChange={(e) => handleFileChange(e, setFiles)}
        />
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-white border border-gray-200 px-3 py-2 rounded-md"
            >
              <span className="text-sm text-gray-700 truncate max-w-[80%]">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(idx, setFiles)
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Kỷ yếu phiên họp</label>
          <Select
            value={formData.proceedingId}
            onValueChange={(v) => setFormData({ ...formData, proceedingId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn kỷ yếu" />
            </SelectTrigger>
            <SelectContent>
              {proceedings.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Plus size={16} className="mr-1" /> Thêm vào kỷ yếu
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-gray-700">
            Tên phiên họp <span className="text-red-500">*</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.singleContent}
              onChange={(e) => setFormData({ ...formData, singleContent: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            Phiên họp có một nội dung
          </label>
        </div>
        <Textarea
          placeholder="Nhập tên phiên họp"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Thời gian bắt đầu <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Thời gian kết thúc <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Input
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Địa điểm <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.roomId}
            onValueChange={(v) => setFormData({ ...formData, roomId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn phòng họp" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id.toString()}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="link" className="text-blue-600">
            Sơ đồ vị trí ngồi
          </Button>
        </div>
      </div>

      {renderFileUploader(
        'Nội dung chương trình họp',
        programFiles,
        setProgramFiles,
        programInputRef
      )}
      {renderFileUploader('Giấy mời', invitationFiles, setInvitationFiles, invitationInputRef)}

      {/* Accordion Rút gọn thông tin */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer border-b border-gray-200">
          <span className="font-semibold text-gray-700">Rút gọn thông tin</span>
          <ArrowLeft size={16} className="-rotate-90 text-gray-500" />
        </div>
        <div className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Loại phiên họp
              </label>
              <Select
                value={formData.meetingType}
                onValueChange={(v) => setFormData({ ...formData, meetingType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại phiên họp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Thường kỳ">Thường kỳ</SelectItem>
                  <SelectItem value="Chuyên đề">Chuyên đề</SelectItem>
                  <SelectItem value="Bất thường">Bất thường</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Link họp trực tuyến
              </label>
              <Input
                placeholder="Nhập link"
                value={formData.onlineMeetingUrl}
                onChange={(e) => setFormData({ ...formData, onlineMeetingUrl: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Chọn người tham gia</h3>
        <Button variant="outline" size="sm">
          Chọn tất cả
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
        {users.map((u) => (
          <div
            key={u.id}
            onClick={() => {
              const isSelected = selectedUsers.includes(u.id)
              setSelectedUsers((prev) =>
                isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
              )
            }}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedUsers.includes(u.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                selectedUsers.includes(u.id)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-300'
              }`}
            >
              {selectedUsers.includes(u.id) && <Check size={14} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{u.fullName}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded-full transition text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Tạo phiên họp mới</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
          >
            <Calendar size={16} className="mr-2" /> Nhắc lịch họp
          </Button>
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
          >
            <Info size={16} className="mr-2" /> Thêm thông báo mới họp
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto overflow-hidden flex flex-col">
          {/* Stepper */}
          <div className="px-8 py-6 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-gray-100 -z-10" />
              {steps.map((s) => {
                const isActive = step === s.id
                const isPassed = step > s.id
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#c8102e] text-white border-2 border-[#c8102e]'
                          : isPassed
                            ? 'bg-white text-[#c8102e] border-2 border-[#c8102e]'
                            : 'bg-white text-gray-400 border-2 border-gray-200'
                      }`}
                    >
                      {isPassed ? <Check size={16} /> : s.id}
                    </div>
                    <span
                      className={`text-xs font-medium ${isActive || isPassed ? 'text-gray-800' : 'text-gray-400'}`}
                    >
                      {s.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && (
              <div className="text-center text-gray-500 py-10">Chưa hỗ trợ (Nội dung họp)</div>
            )}
            {step === 4 && (
              <div className="text-center text-gray-500 py-10">Chưa hỗ trợ (Sơ đồ vị trí)</div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <div>
              <Button variant="outline" onClick={onBack} className="text-gray-600">
                Hủy bỏ
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="text-blue-600 border-blue-600">
                Lưu nháp
              </Button>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Quay lại
                </Button>
              )}
              {step < steps.length ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-[#c8102e] hover:bg-red-700 text-white min-w-[120px]"
                >
                  {loading ? 'Đang lưu...' : 'Lưu phiên họp'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
