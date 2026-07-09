/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react'
import { X, Send, Search, ChevronDown, Check, UserX, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export const ForwardDocumentModal = ({
  isOpen,
  onClose,
  documentId,
  parentRoutingId,
  onForwardSuccess,
}) => {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [role, setRole] = useState('Chủ trì')
  const [deadline, setDeadline] = useState('')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Custom dropdown states
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      setIsDropdownOpen(false)
      setSearchTerm('')
    }
  }, [isOpen])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
      if (response.ok) setUsers(await response.json())
    } catch (e) {
      console.error(e)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) {
      toast.error('Vui lòng chọn người nhận')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        receiverId: parseInt(selectedUser),
        parentRoutingId: parentRoutingId || null,
        role,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        comment,
        status: 'Chưa xử lý',
      }

      const response = await fetch(`/api/documents/${documentId}/routings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success('Chuyển xử lý thành công')
        onForwardSuccess()
        onClose()
        // Reset form
        setSelectedUser('')
        setComment('')
        setDeadline('')
        setRole('Chủ trì')
      } else {
        toast.error('Có lỗi xảy ra khi chuyển văn bản')
      }
    } catch (e) {
      console.error(e)
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Send size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Chuyển xử lý</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Giao việc cho cấp dưới hoặc người phối hợp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Người nhận <span className="text-red-500">*</span>
            </label>
            <div
              className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white cursor-pointer flex justify-between items-center transition-all ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className={selectedUser ? 'text-slate-900 font-semibold' : 'text-slate-400'}>
                {selectedUser
                  ? `${users.find((u) => u.id == selectedUser)?.fullName} (${users.find((u) => u.id == selectedUser)?.username})`
                  : '-- Chọn cán bộ xử lý --'}
              </span>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <Search size={16} className="text-slate-400 ml-2 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Tìm kiếm theo tên hoặc tài khoản..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 py-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between hover:bg-blue-50 transition-colors ${selectedUser == u.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}
                        onClick={() => {
                          setSelectedUser(u.id)
                          setIsDropdownOpen(false)
                          setSearchTerm('')
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{u.fullName}</span>
                          <span
                            className={`text-[10px] font-normal ${selectedUser == u.id ? 'text-blue-500' : 'text-slate-400'}`}
                          >
                            {u.username}
                          </span>
                        </div>
                        {selectedUser == u.id && <Check size={16} className="text-blue-600" />}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                      <UserX size={24} className="text-slate-300" />
                      Không tìm thấy cán bộ nào
                    </div>
                  )}
                </div>
              </div>
            )}
            <input
              type="text"
              className="absolute opacity-0 w-0 h-0 -z-10"
              required
              value={selectedUser}
              onChange={() => {}}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò xử lý</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              >
                <option value="Chủ trì">Chủ trì</option>
                <option value="Phối hợp">Phối hợp</option>
                <option value="Nhận để biết">Nhận để biết</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hạn xử lý (Tùy chọn)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ý kiến chỉ đạo / Bút phê
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Nhập nội dung yêu cầu xử lý..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
            >
              HỦY
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              CHUYỂN VĂN BẢN
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
