/* eslint-disable */
/* eslint-disable eqeqeq */
import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Clock,
  Calendar,
  FileText,
  User,
  Building2,
  AlertCircle,
  Edit,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Send,
  Loader2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle2,
  Play,
  Image,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { DocumentRoutingTree } from '@/components/DocumentRoutingTree'
import { ForwardDocumentModal } from '@/components/ForwardDocumentModal'

// --- Helper Components ---

const InfoRow = ({ icon: Icon, label, value, highlight }) => (
  <div className="flex flex-col gap-0.5 group">
    <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase group-hover:text-red-500 transition-colors">
      {label}
    </span>
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg border transition-all',
          highlight
            ? 'bg-amber-50 text-amber-500 border-amber-200 shadow-sm'
            : 'bg-slate-50 text-slate-400 border-slate-100'
        )}
      >
        <Icon size={12} strokeWidth={2.5} />
      </div>
      <span
        className={cn(
          'text-sm font-bold transition-colors leading-tight',
          highlight ? 'text-amber-700' : 'text-slate-900'
        )}
      >
        {value || '---'}
      </span>
    </div>
  </div>
)

// Đệ quy kiểm tra xem user có trong luồng luân chuyển không
const isUserInRoutings = (routingList, userId) => {
  if (!routingList || !Array.isArray(routingList)) return false
  for (const r of routingList) {
    if (r.receiverId == userId) return true
    if (r.children && isUserInRoutings(r.children, userId)) return true
  }
  return false
}

export function DocDetail({ docId, onBack }) {
  const [doc, setDoc] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [commentFiles, setCommentFiles] = useState([])
  const fileInputRef = React.useRef(null)

  // Modal & PDF states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pdfPage, setPdfPage] = useState(1)
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false)

  const [routings, setRoutings] = useState([])

  useEffect(() => {
    if (docId) {
      fetchData()

      const handleCommentEvent = (e) => {
        if (e.detail?.documentId === parseInt(docId)) {
          fetchComments()
        }
      }

      document.addEventListener('realtime:new_comment', handleCommentEvent)
      document.addEventListener('realtime:delete_comment', handleCommentEvent)
      document.addEventListener('realtime:comment_reaction', handleCommentEvent)

      return () => {
        document.removeEventListener('realtime:new_comment', handleCommentEvent)
        document.removeEventListener('realtime:delete_comment', handleCommentEvent)
        document.removeEventListener('realtime:comment_reaction', handleCommentEvent)
      }
    }
  }, [docId])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      const [docRes, deptRes, userRes] = await Promise.all([
        fetch(`/api/documents/${docId}`, { headers }),
        fetch('/api/admin/departments', { headers }),
        fetch('/api/users', { headers }),
      ])

      if (docRes.ok) {
        const data = await docRes.json()
        setDoc(data)
        setEditForm(data)
      }
      if (deptRes.ok) setDepartments(await deptRes.json())
      if (userRes.ok) setUsers(await userRes.json())

      await Promise.all([fetchComments(), fetchRoutings()])
    } catch (error) {
      console.error('Failed to fetch document details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRoutings = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}/routings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
      if (response.ok) {
        setRoutings(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch routings:', error)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}/comments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
      if (response.ok) {
        setComments(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    }
  }

  const handleUpdateStatus = async (newStatus) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ ...doc, status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Đã chuyển trạng thái sang: ${newStatus}`)
        fetchData() // Tải lại toàn bộ dữ liệu văn bản
      } else {
        toast.error('Không thể cập nhật trạng thái.')
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ.')
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    setIsSubmittingComment(true)
    try {
      const formData = new FormData()
      formData.append('content', newComment)

      if (commentFiles.length > 0) {
        commentFiles.forEach((file) => {
          formData.append('files', file)
        })
      }

      const response = await fetch(`/api/documents/${docId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })
      if (response.ok) {
        setNewComment('')
        setCommentFiles([])
        await fetchComments()
      }
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setIsSubmittingComment(false)
    }
  }

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
      console.error('Failed to save document:', error)
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
      evidenceFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/documents/${docId}/submit-evidence`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })

      if (response.ok) {
        toast.success('Đã nộp kết quả thành công')
        setIsEvidenceModalOpen(false)
        setEvidenceNote('')
        setEvidenceFiles([])
        fetchData()
      } else {
        toast.error('Lỗi khi nộp kết quả')
      }
    } catch (error) {
      console.error('Submit evidence failed:', error)
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDoc = () => {
    setIsDeleteModalOpen(true)
  }

  const executeDelete = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })

      if (response.ok) {
        toast.success('Xóa văn bản thành công')
        onBack()
      } else {
        toast.error('Có lỗi xảy ra khi xóa văn bản')
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsDeleteModalOpen(false)
    }
  }

  const handleViewEvidence = async (path) => {
    try {
      const response = await fetch(
        `/api/documents/evidence-file?path=${encodeURIComponent(path)}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        }
      )
      if (response.ok) {
        const url = `/api/documents/evidence-file?path=${encodeURIComponent(path)}`

        const token = localStorage.getItem('auth_token')
        document.cookie = `jwt_cookie=${token}; path=/; max-age=86400; Secure; SameSite=Lax`

        // Nếu là ảnh thì hiện modal trong app, nếu là PDF thì vẫn mở tab mới
        const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
        if (isImg) {
          setPreviewImage(url)
        } else {
          window.open(url, '_blank')
        }
      } else {
        toast.error('Không có quyền xem file này hoặc file không tồn tại.')
      }
    } catch (error) {
      toast.error('Lỗi khi tải file bằng chứng.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="size-8 animate-spin text-red-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
          Đang tải chi tiết...
        </p>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-5 rounded-3xl bg-slate-100">
          <FileText className="size-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Không tìm thấy văn bản</h3>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 transition-all"
        >
          Quay lại
        </button>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'TỔNG QUAN' },
    { key: 'content', label: 'NỘI DUNG' },
    { key: 'routing', label: 'QUÁ TRÌNH XỬ LÝ' },
    { key: 'history', label: 'LỊCH SỬ' },
  ]

  const steps = [
    { label: 'Tiếp nhận', done: true },
    { label: 'Phân công', done: doc.departmentId != null },
    { label: 'Xử lý', done: doc.status === 'Đang xử lý' || doc.status === 'Đã hoàn thành' },
    { label: 'Hoàn thành', done: doc.status === 'Đã hoàn thành' },
  ]

  const pdfUrl = `/api/documents/${docId}/file#page=${pdfPage}&toolbar=0&navpanes=0`

  return (
    <div
      className="h-full font-sans flex flex-col gap-4 overflow-hidden px-2 pb-2"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 py-1">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500 transition-all flex-shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter leading-none">
                {doc.soVanBan}
              </h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  doc.soNgayConLai === 9999
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : doc.soNgayConLai <= 3
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full animate-pulse',
                    doc.soNgayConLai === 9999
                      ? 'bg-green-500'
                      : doc.soNgayConLai <= 3
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                  )}
                />
                {doc.soNgayConLai === 9999 ? 'ĐÃ HOÀN THÀNH' : `${doc.soNgayConLai} NGÀY CÒN LẠI`}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-1 truncate max-w-[600px] uppercase tracking-wide">
              {doc.trichYeu}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-shrink-0">
          {/* Nút Tiếp nhận xử lý */}
          {doc.status === 'Chưa xử lý' &&
            (doc.assignedTo == localStorage.getItem('user_id') ||
              isUserInRoutings(routings, localStorage.getItem('user_id'))) && (
              <button
                onClick={() => handleUpdateStatus('Đang xử lý')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Play size={14} strokeWidth={2.5} />
                TIẾP NHẬN XỬ LÝ
              </button>
            )}

          {/* Nút Nộp kết quả (Hiện sau khi đã tiếp nhận) */}
          {doc.status === 'Đang xử lý' &&
            (doc.assignedTo == localStorage.getItem('user_id') ||
              isUserInRoutings(routings, localStorage.getItem('user_id')) ||
              localStorage.getItem('user_role') === 'Admin') && (
              <button
                onClick={() => setIsEvidenceModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                <ExternalLink size={14} strokeWidth={2.5} />
                NỘP KẾT QUẢ
              </button>
            )}

          {(localStorage.getItem('user_role') === 'Admin' ||
            localStorage.getItem('user_role') === 'VanThu') && (
            <button
              onClick={() => {
                setEditForm({ ...doc })
                setIsEditModalOpen(true)
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
            >
              <Edit size={14} strokeWidth={2.5} />
              SỬA
            </button>
          )}
          {localStorage.getItem('user_role') === 'Admin' && (
            <button
              onClick={handleDeleteDoc}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all shadow-sm"
            >
              <Trash2 size={14} strokeWidth={2.5} />
              XÓA
            </button>
          )}
          <button
            onClick={() => {
              const token = localStorage.getItem('auth_token')
              // ✅ Bảo mật: Dùng cookie thay vì token trên URL
              document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
              window.open(`/api/documents/${docId}/file`, '_blank')
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100"
          >
            <ExternalLink size={14} strokeWidth={2.5} />
            XEM PDF
          </button>
        </div>
      </div>

      {/* 2. Navigation & Progress Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 gap-2 bg-white/50 rounded-t-2xl px-2 shrink-0">
        <div className="flex items-center gap-1 w-full md:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-[10px] font-black tracking-[0.1em] transition-all ${
                activeTab === tab.key ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-t-full shadow-[0_-2px_10px_rgba(220,38,38,0.4)]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 pb-4 md:pb-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 hidden xl:block self-end mb-2">
            TIẾN ĐỘ:
          </span>
          <div className="relative flex items-end justify-between min-w-[300px] sm:min-w-[400px] flex-1 pb-2">
            <div className="absolute bottom-[18px] left-0 right-0 h-[2px] bg-slate-100 z-0 mx-3">
              <div
                className="h-full bg-green-400 transition-all duration-500 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                style={{
                  width: `${Math.max(0, ((steps.filter((s) => s.done).length - 1) / (steps.length - 1)) * 100)}%`,
                }}
              />
            </div>
            {steps.map((step, i) => (
              <div
                key={step.label}
                className="flex flex-col-reverse items-center group/step relative z-10 w-0 flex-1"
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black transition-all shadow-sm z-20 relative border',
                    step.done
                      ? 'bg-green-500 text-white border-green-400'
                      : 'bg-white text-slate-400 border-slate-100'
                  )}
                >
                  {step.done ? '✓' : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[8px] font-black uppercase tracking-tighter mb-1.5 transition-colors whitespace-nowrap',
                    step.done ? 'text-slate-700' : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Content Container */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0">
        {/* Left Panel */}
        <div className="flex-none lg:flex-1 flex flex-col min-h-0">
          {activeTab === 'overview' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-auto lg:h-full animate-in fade-in slide-in-from-left-4 duration-400">
              <div className="px-6 py-3 border-b border-slate-50 bg-slate-50/30 shrink-0">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  THÔNG TIN CHI TIẾT VĂN BẢN
                </h2>
              </div>
              <div className="flex-1 lg:overflow-auto p-4 md:p-6 lg:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <InfoRow icon={FileText} label="Số văn bản" value={doc.soVanBan} />
                  <InfoRow
                    icon={Calendar}
                    label="Ngày ban hành"
                    value={new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')}
                  />
                  <InfoRow icon={Building2} label="Cơ quan ban hành" value={doc.coQuanBanHanh} />
                  <InfoRow icon={Building2} label="Cơ quan chủ quản" value={doc.coQuanChuQuan} />
                  <InfoRow
                    icon={Clock}
                    label="Thời hạn xử lý"
                    value={new Date(doc.thoiHan).toLocaleDateString('vi-VN')}
                    highlight
                  />
                  <InfoRow
                    icon={AlertCircle}
                    label="Mức độ ưu tiên"
                    value={doc.priority || 'THƯỜNG'}
                  />
                  <InfoRow
                    icon={Building2}
                    label="Đơn vị chủ trì"
                    value={
                      departments.find((d) => d.id === doc.departmentId)?.name || 'CHƯA PHÂN CÔNG'
                    }
                  />
                  <InfoRow
                    icon={User}
                    label="Cán bộ xử lý"
                    value={users.find((u) => u.id === doc.assignedTo)?.fullName || 'CHƯA PHÂN CÔNG'}
                  />
                </div>
                <div className="mt-8 pt-8 border-t border-slate-50">
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">
                    TRÍCH YẾU NỘI DUNG
                  </p>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-100 p-6 rounded-2xl shadow-inner min-h-[140px]">
                    {doc.trichYeu}
                  </p>
                </div>

                {/* Phần kết quả xử lý dành cho Admin/Lãnh đạo kiểm tra */}
                {(doc.status === 'Đã hoàn thành' || doc.evidenceNotes || doc.evidencePaths) && (
                  <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-xl bg-green-50 text-green-600 shadow-sm border border-green-100">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                      </div>
                      <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">
                        KẾT QUẢ XỬ LÝ & BẰNG CHỨNG
                      </h2>
                    </div>

                    <div className="bg-white border-2 border-green-100 rounded-2xl p-4 md:p-6 shadow-xl shadow-green-50/50 relative overflow-hidden">
                      {/* Badge hoàn thành */}
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl">
                        CONFIRMED
                      </div>

                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <MessageSquare size={12} /> NỘI DUNG GIẢI TRÌNH
                          </p>
                          <div className="text-sm font-bold text-slate-700 leading-relaxed pl-4 border-l-4 border-green-200">
                            {doc.evidenceNotes || 'Không có ghi chú bổ sung.'}
                          </div>
                        </div>

                        {doc.evidencePaths && (
                          <div className="pt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Paperclip size={12} /> DANH SÁCH FILE BẰNG CHỨNG (
                              {JSON.parse(doc.evidencePaths || '[]').length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(() => {
                                try {
                                  const paths = JSON.parse(doc.evidencePaths || '[]')
                                  return paths.map((path, idx) => {
                                    const fileName =
                                      path.split('/').pop().split('_').slice(1).join('_') ||
                                      'Attachment'
                                    const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleViewEvidence(path)}
                                        className="group flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-green-400 hover:shadow-lg transition-all duration-300 w-full text-left"
                                      >
                                        <div className="size-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-green-500 transition-colors shadow-sm">
                                          {isImg ? <Image size={18} /> : <FileText size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                                            {fileName}
                                          </p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Click để xem chi tiết
                                          </p>
                                        </div>
                                        <ExternalLink
                                          size={14}
                                          className="text-slate-300 group-hover:text-green-500"
                                        />
                                      </button>
                                    )
                                  })
                                } catch (e) {
                                  return null
                                }
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] lg:h-full animate-in fade-in zoom-in-95 duration-400">
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  FILE & OCR RESULT
                </h2>
                <button
                  className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-widest"
                  onClick={() => {
                    const token = localStorage.getItem('auth_token')
                    // ✅ Bảo mật: Dùng cookie thay vì token trên URL
                    document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
                    window.open(`/api/documents/${docId}/file`, '_blank')
                  }}
                >
                  XEM TOÀN MÀN HÌNH
                </button>
              </div>
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="flex-1 bg-slate-100/50 border-r border-slate-100 relative">
                  <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
                </div>
                <div className="w-full md:w-80 bg-slate-900 p-6 overflow-auto">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">
                    OCR DATA STREAM
                  </p>
                  <div className="text-slate-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all">
                    {doc.fullText || 'HỆ THỐNG KHÔNG TÌM THẤY DỮ LIỆU OCR.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'routing' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 lg:p-8 flex flex-col h-auto lg:h-full overflow-hidden animate-in fade-in zoom-in-95 duration-400">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  QUÁ TRÌNH XỬ LÝ (LUÂN CHUYỂN)
                </h2>
                {doc.status !== 'Đã hoàn thành' && (
                  <button
                    onClick={() => setIsForwardModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Send size={14} /> Chuyển xử lý
                  </button>
                )}
              </div>
              <div className="flex-1 lg:overflow-auto h-[400px] lg:h-auto overflow-y-auto">
                <DocumentRoutingTree routings={routings} onRefresh={fetchRoutings} />
              </div>
            </div>
          )}

          {activeTab === 'history' &&
            (() => {
              const flattenRoutings = (list) => {
                let result = []
                if (!list || !Array.isArray(list)) return result
                for (const r of list) {
                  result.push(r)
                  if (r.children && Array.isArray(r.children)) {
                    result = result.concat(flattenRoutings(r.children))
                  }
                }
                return result
              }

              const historyEvents = []
              if (doc?.ngayThem) {
                historyEvents.push({
                  id: 'create',
                  title: 'TIẾP NHẬN VĂN BẢN',
                  time: new Date(doc.ngayThem),
                  user: 'HỆ THỐNG',
                  active: true,
                })
              }
              if (doc?.assignedTo && doc?.ngayThem) {
                historyEvents.push({
                  id: 'assign',
                  title: 'PHÂN CÔNG XỬ LÝ',
                  time: new Date(doc.ngayThem),
                  user: users.find((u) => u.id === doc.assignedTo)?.fullName || 'Không xác định',
                  active: false,
                })
              }

              const flatRoutings = flattenRoutings(routings)
              flatRoutings.forEach((r) => {
                const sender =
                  r.senderName || users.find((u) => u.id == r.senderId)?.fullName || 'Hệ thống'
                const receiver =
                  r.receiverName ||
                  users.find((u) => u.id == r.receiverId)?.fullName ||
                  'Không xác định'
                historyEvents.push({
                  id: `routing_${r.id}`,
                  title: `CHUYỂN XỬ LÝ - Vai trò: ${r.role}`,
                  time: new Date(r.createdAt),
                  user: `${sender} ➔ ${receiver}`,
                  active: false,
                })
              })

              if (doc?.status === 'Đã hoàn thành') {
                historyEvents.push({
                  id: 'complete',
                  title: 'HOÀN THÀNH VĂN BẢN',
                  time: doc?.completionDate ? new Date(doc.completionDate) : new Date(),
                  user: doc?.assignedTo
                    ? users.find((u) => u.id === doc.assignedTo)?.fullName
                    : 'Hệ thống',
                  active: true,
                })
              }

              historyEvents.sort((a, b) => a.time - b.time)

              return (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col h-auto lg:h-full overflow-hidden lg:overflow-auto animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-12 shrink-0">
                    QUY TRÌNH XỬ LÝ VĂN BẢN
                  </h2>
                  <div className="relative space-y-10 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100">
                    {historyEvents.map((evt, idx) => (
                      <HistoryPoint
                        key={evt.id || idx}
                        title={evt.title}
                        time={evt.time.toLocaleString('vi-VN')}
                        user={evt.user}
                        active={evt.active}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
        </div>

        {/* Right Panel (Discussion) */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col h-[500px] lg:h-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.7)] animate-pulse" />
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  THẢO LUẬN TRỰC TUYẾN
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                {comments.length}
              </span>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">
              {comments.length > 0 ? (
                comments.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2.5 group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-red-100">
                        {c.username.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="leading-tight">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                          {c.username}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          {new Date(c.createdAt).toLocaleTimeString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none group-hover:bg-white group-hover:shadow-xl group-hover:border-slate-200 transition-all duration-500">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                        "{c.content}"
                      </p>

                      {/* Hiển thị file đính kèm */}
                      {c.attachmentPaths && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                          {(() => {
                            try {
                              const paths = JSON.parse(c.attachmentPaths)
                              if (!Array.isArray(paths) || paths.length === 0) return null
                              return paths.map((path, pIdx) => {
                                const fileName = path.split('/').pop()
                                const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
                                return (
                                  <a
                                    key={pIdx}
                                    href={`/api/documents/comment-attachment?path=${encodeURIComponent(path)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-red-600 hover:border-red-500 hover:bg-red-50 transition-all uppercase"
                                  >
                                    {isImg ? <Image size={10} /> : <Paperclip size={10} />}
                                    <span className="max-w-[100px] truncate">{fileName}</span>
                                  </a>
                                )
                              })
                            } catch (e) {
                              return null
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-30">
                  <div className="p-6 rounded-full bg-slate-100 mb-5">
                    <MessageSquare size={40} strokeWidth={2} className="text-slate-400" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center leading-loose">
                    CHƯA CÓ Ý KIẾN CHỈ ĐẠO
                    <br />
                    NÀO ĐƯỢC GHI NHẬN
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-inner focus-within:border-red-300 focus-within:ring-8 focus-within:ring-red-50 transition-all duration-500">
                {commentFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2">
                    {commentFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600"
                      >
                        <Paperclip size={10} className="text-slate-400" />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          onClick={() =>
                            setCommentFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Nhập ý kiến chỉ đạo..."
                  rows={2}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder-slate-400 resize-none outline-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                  <input
                    type="file"
                    multiple
                    hidden
                    ref={fileInputRef}
                    onChange={(e) => {
                      const files = Array.from(e.target.files)
                      setCommentFiles((prev) => [...prev, ...files])
                      e.target.value = null // Reset to allow same file again
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Paperclip size={20} />
                  </button>
                  <button
                    onClick={handlePostComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                    className={cn(
                      'flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      newComment.trim()
                        ? 'bg-red-600 text-white shadow-2xl shadow-red-200 hover:bg-red-700 hover:-translate-y-1 active:translate-y-0'
                        : 'bg-slate-200 text-slate-400'
                    )}
                  >
                    {isSubmittingComment ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    GỬI Ý KIẾN
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                    src={`/api/documents/${docId}/file#page=${pdfPage}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
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
                                    u.role === 'Admin' || u.departmentId === editForm.departmentId
                                )
                              : users
                            ).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.fullName}
                                {u.role === 'Admin' ? ' (Quản trị viên)' : ''}
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
    </div>
  )
}

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

const HistoryPoint = ({ title, time, user, active }) => (
  <div className="relative pl-14 group">
    <div
      className={cn(
        'absolute left-0 mt-1 size-6 rounded-xl border-4 border-white shadow-xl z-10 transition-all group-hover:scale-125 duration-500',
        active ? 'bg-red-600 ring-8 ring-red-50' : 'bg-slate-200'
      )}
    />
    <div className="space-y-1.5">
      <p className="text-[13px] font-black tracking-tight text-slate-900 uppercase group-hover:text-red-600 transition-colors">
        {title}
      </p>
      <div className="flex items-center gap-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-2">
          <Clock size={14} strokeWidth={2.5} /> {time}
        </span>
        <span className="flex items-center gap-2">
          <User size={14} strokeWidth={2.5} /> {user}
        </span>
      </div>
    </div>
  </div>
)
