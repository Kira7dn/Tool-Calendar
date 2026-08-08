import { ROLES } from '@/constants/roles'
/* eslint-disable react/prop-types, no-unused-vars, react/no-array-index-key */
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
  Paperclip,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ForwardDocumentModal } from '@/components/ForwardDocumentModal'

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

export function DocModals({
  docId,
  doc,
  setDoc,
  isEditModalOpen,
  setIsEditModalOpen,
  editForm,
  setEditForm,
  departments,
  users,
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  executeDelete,
  isEvidenceModalOpen,
  setIsEvidenceModalOpen,
  fetchData,
  previewImage,
  setPreviewImage,
  isFullscreenPdf,
  setIsFullscreenPdf,
  pdfUrl,
  isForwardModalOpen,
  setIsForwardModalOpen,
  fetchRoutings,
  pdfPage,
  setPdfPage,
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])

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

  const handleSubmitEvidence = async () => {
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('notes', evidenceNote)
      evidenceFiles.forEach((f) => formData.append('files', f))
      const response = await fetch(`/api/documents/${docId}/submit-evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: formData,
      })
      if (response.ok) {
        toast.success('Đã nộp kết quả xử lý thành công')
        setIsEvidenceModalOpen(false)
        fetchData()
      } else {
        toast.error('Có lỗi xảy ra khi lưu')
      }
    } catch (error) {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* --- Edit Modal (Split Screen) --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
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

            {/* Modal Content - Split Screen */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side: PDF Viewer with Custom Controls */}
              <div className="hidden md:flex flex-1 flex-col bg-slate-100 border-r border-slate-100 relative">
                <div className="flex-1 relative overflow-hidden">
                  <iframe
                    key={pdfPage}
                    src={`/api/documents/${docId}/file?access_token=${localStorage.getItem('auth_token')}#page=${pdfPage}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-none shadow-inner"
                    title="PDF Comparison"
                  />
                </div>

                {/* Custom PDF Toolbar */}
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
                      // ✅ Bảo mật: Dùng cookie thay vì ?access_token= trên URL
                      document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
                      window.open(`/api/documents/${docId}/file`, '_blank')
                    }}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-red-600 transition-all"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>

              {/* Right Side: Edit Form */}
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
                                assignedTo: null, // Reset cán bộ khi đổi đơn vị
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
                                    u.role === ROLES.ADMIN ||
                                    u.departmentId === editForm.departmentId
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

            {/* Modal Footer */}
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
      )}

      {/* --- Forward Modal --- */}
      <ForwardDocumentModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        documentId={docId}
        parentRoutingId={null} // TODO: pass correct parent ID if replying to a specific routing
        onForwardSuccess={() => {
          fetchRoutings()
          fetchData()
        }}
      />

      <ConfirmationModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Xác nhận xóa văn bản?"
        description="Bạn có chắc chắn muốn xóa văn bản này không? Thao tác này sẽ xóa vĩnh viễn dữ liệu và các tệp đính kèm liên quan."
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />

      {/* --- Evidence Submission Modal --- */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Nộp kết quả xử lý
              </h3>
              <button
                onClick={() => setIsEvidenceModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Ghi chú kết quả
                </label>
                <textarea
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="Mô tả kết quả công việc..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 outline-none focus:border-red-300 min-h-[100px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  File bằng chứng (Ảnh/PDF)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    id="evidence-upload"
                    onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
                  />
                  <label
                    htmlFor="evidence-upload"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-200 transition-all uppercase"
                  >
                    <Paperclip size={14} /> Chọn file
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">
                    {evidenceFiles.length} file đã chọn
                  </span>
                </div>
                {evidenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {evidenceFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm animate-in zoom-in-95 duration-300"
                      >
                        <Paperclip size={10} className="text-slate-400" />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                onClick={() => setIsEvidenceModalOpen(false)}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitEvidence}
                disabled={isSaving || evidenceFiles.length === 0}
                className="px-8 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'HOÀN THÀNH VĂN BẢN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Image Lightbox Modal --- */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
          >
            <X size={24} />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500 border-4 border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmationModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Xác nhận xóa văn bản?"
        description="Bạn có chắc chắn muốn xóa văn bản này không? Thao tác này sẽ xóa vĩnh viễn dữ liệu và các tệp đính kèm liên quan."
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />

      {/* --- Fullscreen PDF Modal (Mobile) --- */}
      {isFullscreenPdf && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              XEM TOÀN MÀN HÌNH
            </h3>
            <button
              onClick={() => setIsFullscreenPdf(false)}
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-slate-100">
            <iframe
              src={pdfUrl}
              className="w-full h-full border-none"
              title="Fullscreen PDF Viewer"
            />
          </div>
        </div>
      )}
    </>
  )
}
