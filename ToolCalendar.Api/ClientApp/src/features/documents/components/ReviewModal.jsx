// features/documents/components/ReviewModal.jsx
// Modal đối soát PDF + chỉnh sửa thông tin văn bản (tách từ Upload.jsx)
import React, { useState } from 'react'
import {
  Clock,
  Calendar,
  FileText,
  Building2,
  Edit,
  Save,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROLES } from '../../../constants/roles'
import { toast } from 'sonner'

// FormField helper
const FormField = ({ label, value, onChange, icon: Icon, type = 'text' }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
      {label}
    </label>
    <div className="relative group">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
          <Icon size={14} strokeWidth={2.5} />
        </div>
      )}
      {type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all leading-relaxed resize-none"
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all',
            Icon ? 'pl-11 pr-4' : 'px-4'
          )}
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      )}
    </div>
  </div>
)

export function ReviewModal({
  isOpen,
  onClose,
  reviewItem,
  setReviewItem,
  pdfBlobUrl,
  isPdfLoading,
  pdfPage,
  setPdfPage,
  pdfPageCount,
  departments,
  users,
  onSave,
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="!max-w-[98vw] w-[98vw] h-[96vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white transition-all duration-500 rounded-3xl">
        {/* Header */}
        <div className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
              <Edit size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Chỉnh sửa thông tin văn bản
              </h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                Đối chiếu trực tiếp với bản gốc PDF
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: PDF Viewer */}
          <div className="flex-1 bg-slate-100 flex flex-col relative border-r border-slate-100">
            <div className="flex-1 relative overflow-hidden bg-slate-200 m-4 rounded-2xl shadow-inner border border-slate-200">
              {isPdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-bold text-slate-500">Đang tải PDF...</span>
                  </div>
                </div>
              )}
              <iframe
                key={`${reviewItem?.id}-${pdfPage}`}
                src={pdfBlobUrl ? `${pdfBlobUrl}#page=${pdfPage}&view=FitH` : ''}
                className="w-full h-full border-none"
                title="PDF Viewer"
              />
            </div>
            {/* PDF Toolbar */}
            <div className="h-16 bg-slate-900 mx-4 mb-4 rounded-2xl flex items-center justify-between px-8 shadow-xl">
              <div className="flex items-center gap-3 text-slate-400">
                <FileText size={18} className="text-blue-500" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                  Bản gốc PDF
                </span>
              </div>
              <div className="flex items-center gap-4 bg-slate-800/50 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                  disabled={pdfPage <= 1}
                  className="p-2 rounded-lg hover:bg-slate-700 text-white disabled:opacity-20 transition-all"
                >
                  <ChevronLeft size={18} strokeWidth={3} />
                </button>
                <div className="flex items-center gap-2 px-4 border-x border-white/5">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Trang
                  </span>
                  <span className="text-sm font-black text-white">{pdfPage}</span>
                  {pdfPageCount > 1 && (
                    <span className="text-[10px] font-bold text-slate-400">/ {pdfPageCount}</span>
                  )}
                </div>
                <button
                  onClick={() => setPdfPage(Math.min(pdfPageCount || 999, pdfPage + 1))}
                  disabled={pdfPageCount ? pdfPage >= pdfPageCount : false}
                  className="p-2 rounded-lg hover:bg-slate-700 text-white disabled:opacity-20 transition-all"
                >
                  <ChevronRight size={18} strokeWidth={3} />
                </button>
              </div>
              <button
                onClick={() => window.open(`/api/documents/${reviewItem?.id}/file`, '_blank')}
                className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-blue-600 transition-all"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>

          {/* Right: Edit Form */}
          <div className="w-[520px] bg-white flex flex-col">
            <div className="flex-1 overflow-auto p-10 space-y-8">
              <div className="space-y-6">
                <FormField
                  label="Số văn bản"
                  value={reviewItem?.soVanBan}
                  onChange={(val) => setReviewItem({ ...reviewItem, soVanBan: val })}
                  icon={FileText}
                />
                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    label="Ngày ban hành"
                    type="date"
                    value={reviewItem?.ngayBanHanh?.split('T')[0]}
                    onChange={(val) => setReviewItem({ ...reviewItem, ngayBanHanh: val })}
                    icon={Calendar}
                  />
                  <FormField
                    label="Thời hạn xử lý"
                    type="date"
                    value={reviewItem?.thoiHan}
                    onChange={(val) => setReviewItem({ ...reviewItem, thoiHan: val })}
                    icon={Clock}
                  />
                </div>
                <FormField
                  label="Cơ quan ban hành"
                  value={reviewItem?.coQuanBanHanh}
                  onChange={(val) => setReviewItem({ ...reviewItem, coQuanBanHanh: val })}
                  icon={Building2}
                />
                <FormField
                  label="Cơ quan chủ quản"
                  value={reviewItem?.coQuanChuQuan}
                  onChange={(val) => setReviewItem({ ...reviewItem, coQuanChuQuan: val })}
                  icon={Building2}
                />
                <FormField
                  label="Trích yếu nội dung"
                  type="textarea"
                  value={reviewItem?.trichYeu}
                  onChange={(val) => setReviewItem({ ...reviewItem, trichYeu: val })}
                />

                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      Thông tin nâng cao
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Đơn vị chủ trì
                    </label>
                    <select
                      value={reviewItem?.departmentIds?.[0] || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : ''
                        setReviewItem({
                          ...reviewItem,
                          departmentIds: val ? [val] : [],
                          assignedToIds: [],
                        })
                      }}
                      className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Chọn đơn vị...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      Cán bộ xử lý
                      {reviewItem?.departmentIds?.[0] && (
                        <span className="ml-2 text-blue-500 normal-case tracking-normal font-bold">
                          — {departments.find((d) => d.id === reviewItem.departmentIds[0])?.name}
                        </span>
                      )}
                    </label>
                    <select
                      value={reviewItem?.assignedToIds?.[0] || ''}
                      onChange={(e) =>
                        setReviewItem({
                          ...reviewItem,
                          assignedToIds: e.target.value ? [parseInt(e.target.value)] : [],
                        })
                      }
                      className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Chọn cán bộ...</option>
                      {(reviewItem?.departmentIds?.[0]
                        ? users.filter(
                          (u) =>
                            u.role === ROLES.ADMIN ||
                            u.departmentId === reviewItem.departmentIds[0]
                        )
                        : users
                      ).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                          {u.role === ROLES.ADMIN ? ' (Quản trị viên)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                className="px-8 h-12 rounded-2xl bg-slate-100 font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-all"
                onClick={onClose}
              >
                HỦY BỎ
              </Button>
              <Button
                className="px-10 h-12 rounded-2xl bg-[#1e293b] hover:bg-slate-800 text-white font-black uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center gap-3 transition-all active:scale-95"
                onClick={() => {
                  onSave(reviewItem)
                  toast.success('Đã cập nhật dữ liệu đối soát')
                }}
              >
                <Save size={18} />
                LƯU THAY ĐỔI
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
