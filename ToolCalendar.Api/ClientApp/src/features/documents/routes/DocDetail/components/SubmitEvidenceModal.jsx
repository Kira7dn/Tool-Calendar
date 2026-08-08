/* eslint-disable */
import React, { useState } from 'react'
import { X, Paperclip, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function SubmitEvidenceModal({
  docId,
  isEvidenceModalOpen,
  setIsEvidenceModalOpen,
  fetchData,
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])

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

  if (!isEvidenceModalOpen) return null

  return (
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
  )
}
