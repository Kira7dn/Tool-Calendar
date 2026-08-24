// features/tasks/components/EvidenceModal.jsx
// Modal nộp bằng chứng hoàn thành nhiệm vụ (tách từ MyTasks.jsx)
/* eslint-disable react/prop-types, no-unused-vars, react/no-array-index-key */
import React, { useState } from 'react'
import { Upload, FileText, CheckCircle2, Loader2, Paperclip } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function EvidenceModal({ isOpen, onClose, docId, onSuccess }) {
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!evidenceNotes.trim()) return
    if (selectedFiles.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 file bằng chứng!')
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('notes', evidenceNotes)
      selectedFiles.forEach((file) => formData.append('files', file))
      const response = await fetch(`/api/documents/${docId}/submit-evidence`, {
        method: 'POST',
        body: formData,
      })
      if (response.ok) {
        setEvidenceNotes('')
        setSelectedFiles([])
        onClose()
        if (onSuccess) onSuccess()
      }
    } catch (error) {
      console.error('Failed to submit evidence:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setEvidenceNotes('')
    setSelectedFiles([])
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl glass-card">
        <DialogHeader className="p-8 bg-primary text-white">
          <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
            <div className="p-2 rounded-xl bg-white/10">
              <Upload className="size-5 text-white" />
            </div>
            Nộp kết quả xử lý
          </DialogTitle>
          <DialogDescription className="text-white/80 font-medium">
            Hệ thống sẽ ghi nhận và cập nhật trạng thái văn bản sau khi bạn nộp bằng chứng.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Ghi chú kết quả
            </Label>
            <Textarea
              placeholder="Nhập ghi chú hoặc tóm tắt kết quả xử lý..."
              className="min-h-[100px] rounded-2xl border-border bg-muted/50 focus:bg-background transition-all font-medium p-4"
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Tệp minh chứng ({selectedFiles.length})
            </Label>
            <div
              className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer group relative"
              onClick={() => document.getElementById('evidence-file-input').click()}
            >
              <input
                id="evidence-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])
                }
              />
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/10 transition-colors">
                <FileText className="size-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                Nhấn để chọn hoặc kéo thả tệp tại đây
              </p>
              {selectedFiles.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {selectedFiles.map((file, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm"
                    >
                      <Paperclip size={10} className="text-slate-400" />
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-muted/50 gap-3 border-t border-border">
          <Button variant="ghost" className="rounded-xl font-bold h-11" onClick={handleClose}>
            Hủy bỏ
          </Button>
          <Button
            className="rounded-xl bg-success hover:bg-success/90 font-bold px-8 h-11 shadow-lg shadow-success/20 flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting || !evidenceNotes.trim() || selectedFiles.length === 0}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Nộp & Đã xử lý
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
