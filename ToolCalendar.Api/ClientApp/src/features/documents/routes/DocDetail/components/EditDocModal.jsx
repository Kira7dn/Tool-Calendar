/* eslint-disable react/prop-types, no-unused-vars */
import React, { useState } from 'react'
import {
  X,
  Edit,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Calendar,
  Clock,
  Building2,
  Save,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ROLES } from '@/constants/roles'

const FormField = ({ label, value, onChange, icon: Icon, type = 'text' }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
      {label}
    </label>
    <div className="relative group">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-500 transition-colors">
          <Icon size={16} strokeWidth={2.5} />
        </div>
      )}
      {type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 transition-all leading-relaxed resize-none"
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 transition-all',
            Icon ? 'pl-12 pr-4' : 'px-4'
          )}
        />
      )}
    </div>
  </div>
)

export function EditDocModal({
  docId,
  setDoc,
  isEditModalOpen,
  setIsEditModalOpen,
  editForm,
  setEditForm,
  departments,
  users,
  pdfPage,
  setPdfPage,
}) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        setDoc(editForm)
        setIsEditModalOpen(false)
        toast.success('Cập nhật văn bản thành công')
      } else {
        toast.error('Có lỗi xảy ra khi lưu')
      }
    } catch (error) {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
              <Edit size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Chỉnh sửa thông tin văn bản
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Đối chiếu trực tiếp với bản gốc PDF
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditModalOpen(false)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="hidden md:flex flex-1 flex-col bg-slate-100 border-r border-slate-100 relative">
            <div className="flex-1 relative overflow-hidden">
              <iframe
                key={pdfPage}
                src={`/api/documents/${docId}/file?access_token=${localStorage.getItem('auth_token')}#page=${pdfPage}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-none shadow-inner"
                title="PDF Comparison"
              />
            </div>
            <div className="h-14 bg-slate-900 flex items-center justify-between px-6 shrink-0 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                  <FileText size={16} />
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Bản gốc PDF
                </span>
              </div>
              <div className="flex items-center gap-4 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                <button
                  onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                  disabled={pdfPage <= 1}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-white disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <div className="flex items-center gap-2 px-3 border-x border-slate-700">
                  <span className="text-[10px] font-black text-red-500">TRANG</span>
                  <span className="text-xs font-black text-white">{pdfPage}</span>
                </div>
                <button
                  onClick={() => setPdfPage(pdfPage + 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-white transition-all"
                >
                  <ChevronRight size={16} strokeWidth={3} />
                </button>
              </div>
              <button
                onClick={() => {
                  const token = localStorage.getItem('auth_token')
                  document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
                  window.open(`/api/documents/${docId}/file`, '_blank')
                }}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-red-600 transition-all"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div className="w-full md:w-[450px] flex flex-col bg-white overflow-auto">
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <FormField
                  label="Số văn bản"
                  value={editForm?.soVanBan}
                  onChange={(val) => setEditForm({ ...editForm, soVanBan: val })}
                  icon={FileText}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Ngày ban hành"
                    type="date"
                    value={editForm?.ngayBanHanh?.split('T')[0]}
                    onChange={(val) => setEditForm({ ...editForm, ngayBanHanh: val })}
                    icon={Calendar}
                  />
                  <FormField
                    label="Thời hạn xử lý"
                    type="date"
                    value={editForm?.thoiHan?.split('T')[0]}
                    onChange={(val) => setEditForm({ ...editForm, thoiHan: val })}
                    icon={Clock}
                  />
                </div>
                <FormField
                  label="Cơ quan ban hành"
                  value={editForm?.coQuanBanHanh}
                  onChange={(val) => setEditForm({ ...editForm, coQuanBanHanh: val })}
                  icon={Building2}
                />
                <FormField
                  label="Trích yếu nội dung"
                  type="textarea"
                  value={editForm?.trichYeu}
                  onChange={(val) => setEditForm({ ...editForm, trichYeu: val })}
                />

                <div className="pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Thông tin nâng cao
                  </p>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                        Đơn vị chủ trì
                      </label>
                      <select
                        value={editForm?.departmentId || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            departmentId: e.target.value ? parseInt(e.target.value) : null,
                            assignedTo: null,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Chọn đơn vị...</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                        Cán bộ xử lý
                        {editForm?.departmentId && (
                          <span className="ml-2 text-red-500 normal-case tracking-normal font-bold">
                            — {departments.find((d) => d.id === editForm.departmentId)?.name}
                          </span>
                        )}
                      </label>
                      <select
                        value={editForm?.assignedTo || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            assignedTo: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Chọn cán bộ...</option>
                        {(editForm?.departmentId
                          ? users.filter(
                              (u) =>
                                u.role === ROLES.ADMIN || u.departmentId === editForm.departmentId
                            )
                          : users
                        ).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                            {u.role === ROLES.ADMIN ? ' (Quản trị viên)' : ''}
                          </option>
                        ))}
                      </select>
                      {editForm?.departmentId && (
                        <p className="text-[9px] font-bold text-slate-400 ml-1 mt-0.5">
                          * Hiển thị cán bộ thuộc đơn vị này và Quản trị viên hệ thống
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-end gap-3">
          <button
            onClick={() => setIsEditModalOpen(false)}
            className="px-6 py-2.5 rounded-xl text-[11px] bg-slate-100 font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-all"
          >
            HỦY BỎ
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  )
}
