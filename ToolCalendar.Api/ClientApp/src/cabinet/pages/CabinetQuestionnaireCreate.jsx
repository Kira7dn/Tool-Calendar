/* eslint-disable react/prop-types, no-unused-vars, no-alert, react/no-array-index-key */
import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, UploadCloud, X, Check, Search, Plus } from 'lucide-react'

export function CabinetQuestionnaireCreate({ onBack, onSaved }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState([])
  const [users, setUsers] = useState([])

  const [formData, setFormData] = useState({
    title: '',
    templateId: '',
    deadline: '',
    type: '',
    content: '',
  })

  const [selectedUsers, setSelectedUsers] = useState([])
  const [files, setFiles] = useState([])

  const fileInputRef = useRef(null)

  useEffect(() => {
    // Fetch Templates
    fetch('/api/phonghopkhonggiayto/questionnaire-templates')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setTemplates(json.data)
      })
      .catch(() => {})

    // Fetch Users
    fetch('/api/users')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setUsers(json.data)
      })
      .catch(() => {})
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.deadline) {
      alert('Vui lòng nhập tên phiếu và hạn trả lời')
      return
    }

    setLoading(true)
    const fd = new FormData()
    fd.append('title', formData.title)
    if (formData.templateId) fd.append('templateId', formData.templateId)
    if (formData.type) fd.append('type', formData.type)
    if (formData.content) fd.append('content', formData.content)
    if (formData.deadline) fd.append('deadline', formData.deadline)
    fd.append('assignedUserIdsStr', JSON.stringify(selectedUsers))

    files.forEach((file) => {
      fd.append('files', file)
    })

    try {
      const res = await fetch('/api/phonghopkhonggiayto/questionnaires', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (json.success) {
        onSaved()
      } else {
        alert(json.message || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Có lỗi xảy ra khi lưu phiếu')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { id: 1, title: 'Chi tiết phiếu' },
    { id: 2, title: 'Nội dung cần lấy ý kiến' },
    { id: 3, title: 'Thành viên tham gia trả lời' },
  ]

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center shrink-0">
        <button
          onClick={onBack}
          className="mr-3 p-1 hover:bg-gray-100 rounded-full transition text-gray-500"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Thêm mới phiếu lấy ý kiến</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto overflow-hidden flex flex-col">
          {/* Stepper */}
          <div className="px-8 py-6 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-gray-100 -z-10" />
              {steps.map((s, idx) => {
                const isActive = step === s.id
                const isPassed = step > s.id
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-4">
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
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên phiếu <span className="text-[#c8102e]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
                    placeholder="Nhập tên phiếu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mẫu phiếu <span className="text-[#c8102e]">*</span>
                  </label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
                  >
                    <option value="">Chọn mẫu phiếu</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hạn trả lời <span className="text-[#c8102e]">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loại phiếu ý kiến <span className="text-[#c8102e]">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
                    >
                      <option value="">Loại phiếu ý kiến</option>
                      <option value="Đồng ý / Không đồng ý">Đồng ý / Không đồng ý</option>
                      <option value="Trắc nghiệm nhiều lựa chọn">Trắc nghiệm nhiều lựa chọn</option>
                      <option value="Ý kiến tự do">Ý kiến tự do</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Tài liệu đính kèm
                    </label>
                    <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                      <Plus size={14} /> Tạo thư mục
                    </button>
                  </div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#c8102e]/30 rounded-xl bg-red-50/50 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-red-50 transition-colors"
                  >
                    <UploadCloud size={32} className="text-[#c8102e] mb-3" />
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-semibold text-[#c8102e]">Chọn file</span> hoặc Kéo thả
                      từ máy tính
                    </p>
                    <p className="text-xs text-gray-500">
                      Tối đa 50MB, định dạng .doc, .docx, .xls, .xlsx, .ppt, .pptx, .pdf, .msg,
                      .mpp, .txt, .jpeg, .png, .tiff, .gif, .jpg, .bmp, .mp3, .mp4, .wmv, .flv, .avi
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={handleFileChange}
                    />
                  </div>
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg border border-gray-200"
                        >
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nội dung lấy ý kiến
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e] min-h-[300px]"
                  placeholder="Nhập nội dung cần lấy ý kiến tại đây..."
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chọn thành viên
                </label>
                <div className="relative mb-4">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Tìm kiếm cán bộ..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8102e]/20 focus:border-[#c8102e]"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="w-4 h-4 text-[#c8102e] rounded border-gray-300 focus:ring-[#c8102e]"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {u.fullName || u.username}
                          </p>
                          <p className="text-xs text-gray-500">{u.email || u.phoneNumber}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between shrink-0">
            <button
              onClick={onBack}
              className="px-6 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="px-6 py-2 text-sm font-medium text-[#c8102e] bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Quay lại
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="px-6 py-2 text-sm font-medium text-[#c8102e] bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-transparent"
                >
                  Tiếp tục
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 text-sm font-medium text-white bg-[#c8102e] rounded-lg hover:bg-[#a50e27] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu nháp'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
