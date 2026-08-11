/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// features/documents/routes/UploadPage.jsx
// Trang Số hóa tài liệu — ghép tất cả components và hooks lại (~150 dòng)
/* eslint-disable */
import { ROLES } from '../../../constants/roles'
import { DOCUMENT_STATUS } from '@/constants/document'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { UploadDropzone } from '../components/UploadDropzone'
import { ReviewModal } from '../components/ReviewModal'
import { useBulkSelect } from '../hooks/useBulkSelect'
import { useSaveAll } from '../hooks/useSaveAll'

// ── Tiny inline icons ──────────────────────────────────────────────────────
const Svg = ({ children, size = 20, cls = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cls}
  >
    {children}
  </svg>
)
const ChipIcon = () => (
  <Svg size={16}>
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Svg>
)
const TrashIcon = () => (
  <Svg size={13}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </Svg>
)
const EyeIcon = () => (
  <Svg size={13}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
const CheckCircleIcon = () => (
  <Svg size={14} cls="text-emerald-500">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </Svg>
)
const ClockIcon = () => (
  <Svg size={14} cls="text-blue-500">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Svg>
)
const XCircleIcon = () => (
  <Svg size={14} cls="text-slate-400">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </Svg>
)

function StatusBadge({ status }) {
  const map = {
    processing: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
        <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
        Đang OCR
      </span>
    ),
    success: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="w-1 h-1 rounded-full bg-emerald-500" />
        Đã lưu
      </span>
    ),
    ready: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        Sẵn sàng
      </span>
    ),
    error: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
        Lỗi
      </span>
    ),
  }
  return (
    map[status] || (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
        Chờ rà soát
      </span>
    )
  )
}

function Ring({ pct }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={4}
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x={28} y={32} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1e293b">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

export function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [batchItems, setBatchItems] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentFileName, setCurrentFileName] = useState('')
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewItem, setReviewItem] = useState(null)
  const [pdfPage, setPdfPage] = useState(1)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deleteItemConfirm, setDeleteItemConfirm] = useState({ open: false, item: null })
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const tableScrollRef = useRef(null)
  const [tableScrollTop, setTableScrollTop] = useState(0)
  const [tableHeight, setTableHeight] = useState(600)

  const {
    selectedIds,
    setSelectedIds,
    isAllSelected,
    isIndeterminate,
    toggleSelectAll,
    toggleSelectOne,
  } = useBulkSelect(batchItems)
  const { isSaving, handleSaveAll, handleBulkDelete, executeClearBatch } = useSaveAll({
    batchItems,
    setBatchItems,
  })

  const hasProcessingItems = batchItems.some((i) => i.status === 'processing')
  const isGlobalProcessing = isProcessing || hasProcessingItems

  useEffect(() => {
    fetch('/api/admin/departments')
      .then((r) => r.ok && r.json())
      .then((d) => d && setDepartments(d))
      .catch(() => {})
    fetch('/api/users')
      .then((r) => r.ok && r.json())
      .then(
        (d) => d && setUsers(d.filter((u) => u.role === ROLES.CAN_BO || u.role === ROLES.ADMIN))
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setTableHeight(entry.contentRect.height)
    })
    ro.observe(el)
    setTableHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const fetchPdfBlob = async (docId) => {
    setIsPdfLoading(true)
    setPdfBlobUrl(null)
    try {
      const res = await fetch(`/api/documents/${docId}/file`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setPdfBlobUrl(URL.createObjectURL(blob))
    } catch {
      toast.error('Không thể tải file PDF')
    } finally {
      setIsPdfLoading(false)
    }
  }

  const handleFileUpload = async (fileList) => {
    if (!fileList.length) return
    setIsProcessing(true)
    setOverallProgress(0)
    const MAX_CONCURRENT = 8
    let completedCount = 0
    const total = fileList.length
    const newItems = Array.from(fileList).map((file, i) => ({
      id: `temp-${Date.now()}-${i}`,
      fileName: file.name,
      soVanBan: '',
      trichYeu: '',
      coQuanBanHanh: '',
      coQuanChuQuan: '',
      ngayBanHanh: '',
      thoiHan: '',
      departmentIds: [],
      assignedToIds: [],
      status: 'processing',
      _tempFile: file,
    }))
    setBatchItems((prev) => [...newItems, ...prev])
    setCurrentFileName(`Đang xử lý ${total} file...`)

    const uploadOne = async (item) => {
      const formData = new FormData()
      formData.append('file', item._tempFile)
      try {
        const response = await fetch('/api/documents/upload', { method: 'POST', body: formData })
        if (response.ok) {
          const doc = await response.json()
          const mapped = {
            ...item,
            _tempFile: undefined,
            id: doc.id,
            soVanBan: doc.soVanBan || '',
            trichYeu: doc.trichYeu || '',
            coQuanBanHanh: doc.coQuanBanHanh || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            ngayBanHanh: doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            departmentIds: doc.departmentId ? [doc.departmentId] : [],
            assignedToIds: doc.assignedTo ? [doc.assignedTo] : [],
            filePath: doc.filePath || '',
            status:
              doc.status === DOCUMENT_STATUS.DANG_XU_LY
                ? 'processing'
                : doc.status === DOCUMENT_STATUS.LOI_OCR
                  ? 'error'
                  : 'ready',
          }
          setBatchItems((prev) => prev.map((b) => (b.id === item.id ? mapped : b)))
          if (doc.status === DOCUMENT_STATUS.DANG_XU_LY) {
            ;(async () => {
              let attempts = 0
              while (attempts < 150) {
                await new Promise((r) => setTimeout(r, 2000))
                try {
                  const res = await fetch(`/api/documents/${doc.id}`)
                  if (res.ok) {
                    const u = await res.json()
                    if (u.status !== DOCUMENT_STATUS.DANG_XU_LY) {
                      setBatchItems((prev) =>
                        prev.map((b) =>
                          b.id === doc.id
                            ? {
                                ...b,
                                soVanBan: u.soVanBan || '',
                                trichYeu: u.trichYeu || '',
                                coQuanBanHanh: u.coQuanBanHanh || '',
                                coQuanChuQuan: u.coQuanChuQuan || '',
                                ngayBanHanh: u.ngayBanHanh ? u.ngayBanHanh.split('T')[0] : '',
                                thoiHan: u.thoiHan ? u.thoiHan.split('T')[0] : '',
                                departmentIds: u.departmentId ? [u.departmentId] : [],
                                assignedToIds: u.assignedTo ? [u.assignedTo] : [],
                                status: u.status === DOCUMENT_STATUS.LOI_OCR ? 'error' : 'ready',
                              }
                            : b
                        )
                      )
                      break
                    }
                  }
                } catch {}
                attempts++
              }
            })()
          }
        } else {
          setBatchItems((prev) =>
            prev.map((b) =>
              b.id === item.id ? { ...b, status: 'error', _tempFile: undefined } : b
            )
          )
        }
      } catch {
        setBatchItems((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, status: 'error', _tempFile: undefined } : b))
        )
      } finally {
        completedCount++
        setOverallProgress(Math.round((completedCount / total) * 100))
        setCurrentFileName(
          total - completedCount > 0 ? `Còn ${total - completedCount} file đang xử lý...` : ''
        )
      }
    }

    const uploadQueue = [...newItems]
    await Promise.all(
      Array.from({ length: MAX_CONCURRENT }, async () => {
        while (uploadQueue.length > 0) {
          const item = uploadQueue.shift()
          if (item) await uploadOne(item)
        }
      })
    )
    setOverallProgress(100)
    setTimeout(() => {
      setIsProcessing(false)
      setCurrentFileName('')
    }, 800)
  }

  const updateItem = (id, field, value) =>
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )

  const statCounts = {
    ocr: batchItems.filter((f) => f.status === 'processing').length,
    saved: batchItems.filter((f) => f.status === 'success').length,
    pending: batchItems.filter((f) => f.status === 'ready').length,
  }
  const ROW_HEIGHT = 44
  const BUFFER = 8
  const visibleStart = Math.max(0, Math.floor(tableScrollTop / ROW_HEIGHT) - BUFFER)
  const visibleEnd = Math.min(
    batchItems.length,
    Math.ceil((tableScrollTop + tableHeight) / ROW_HEIGHT) + BUFFER
  )
  const visibleItems = batchItems.slice(visibleStart, visibleEnd)
  const topSpacer = visibleStart * ROW_HEIGHT
  const bottomSpacer = Math.max(0, (batchItems.length - visibleEnd) * ROW_HEIGHT)

  return (
    <div
      className="h-full bg-slate-100 flex flex-col overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Page title */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
            <ChipIcon />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Số hóa tài liệu</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              PDF OCR Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={isGlobalProcessing}
            className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HỦY ĐỢT TẢI
          </button>
          <button
            onClick={() => handleSaveAll()}
            disabled={isSaving || batchItems.length === 0 || isGlobalProcessing}
            className="px-6 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            LƯU & PHÂN CÔNG TẤT CẢ
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-y-auto lg:overflow-hidden min-h-0">
        {/* Left panel */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3">
          <UploadDropzone
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            handleFileUpload={handleFileUpload}
          />

          {isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Đang xử lý OCR
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Ring pct={overallProgress} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentFileName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Đang nhận diện văn bản...</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Trạng thái đợt tải
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: 'Đang OCR', count: statCounts.ocr, color: 'blue', icon: <ClockIcon /> },
                {
                  label: 'Đã lưu',
                  count: statCounts.saved,
                  color: 'emerald',
                  icon: <CheckCircleIcon />,
                },
                {
                  label: 'Chờ rà soát',
                  count: statCounts.pending,
                  color: 'slate',
                  icon: <XCircleIcon />,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.icon}
                    <span className="text-xs font-medium text-slate-600">{row.label}</span>
                  </div>
                  <span
                    className={`min-w-[24px] h-6 px-2 flex items-center justify-center rounded-full text-xs font-bold ${row.color === 'blue' ? 'bg-blue-50 text-blue-700' : row.color === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Table */}
        <div className="flex-1 min-h-[500px] lg:min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-w-0">
          <div
            ref={tableScrollRef}
            className="flex-1 overflow-auto"
            onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
          >
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <th className="pl-4 pr-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate
                      }}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                    />
                  </th>
                  {['Tên tệp', 'Số hiệu', 'Thời hạn', 'Đơn vị', 'Cán bộ', 'Trạng thái', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSpacer > 0 && (
                  <tr style={{ height: topSpacer }}>
                    <td colSpan={8} />
                  </tr>
                )}
                {visibleItems.map((row) => {
                  const isRowSelected = selectedIds.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'transition-colors group',
                        isRowSelected ? 'bg-blue-50 hover:bg-blue-50/80' : 'hover:bg-slate-50/60'
                      )}
                    >
                      <td className="pl-4 pr-2 py-2">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectOne(row.id)}
                          disabled={typeof row.id !== 'number' || row.status === 'processing'}
                          className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border',
                              isRowSelected
                                ? 'bg-blue-100 border-blue-200'
                                : 'bg-red-50 border-red-100'
                            )}
                          >
                            <span
                              className={cn(
                                'text-[8px] font-black uppercase',
                                isRowSelected ? 'text-blue-600' : 'text-red-500'
                              )}
                            >
                              PDF
                            </span>
                          </div>
                          <span className="font-semibold text-slate-800 truncate max-w-[120px]">
                            {row.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.soVanBan}
                          onChange={(e) => updateItem(row.id, 'soVanBan', e.target.value)}
                          disabled={row.status === 'processing'}
                          placeholder="Số hiệu..."
                          className="w-24 text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white placeholder-slate-300 transition-all font-bold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.thoiHan}
                          onChange={(e) => updateItem(row.id, 'thoiHan', e.target.value)}
                          disabled={row.status === 'processing'}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.departmentIds[0] || ''}
                          disabled={row.status === 'processing'}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : ''
                            setBatchItems((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, departmentIds: val ? [val] : [], assignedToIds: [] }
                                  : item
                              )
                            )
                          }}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Chọn đơn vị</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.assignedToIds[0] || ''}
                          disabled={row.status === 'processing'}
                          onChange={(e) =>
                            updateItem(
                              row.id,
                              'assignedToIds',
                              e.target.value ? [parseInt(e.target.value)] : []
                            )
                          }
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Chọn cán bộ</option>
                          {(row.departmentIds[0]
                            ? users.filter(
                                (u) =>
                                  u.role === ROLES.ADMIN || u.departmentId === row.departmentIds[0]
                              )
                            : users
                          ).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName}
                              {u.role === ROLES.ADMIN ? ' (Quản trị viên)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <button
                                    onClick={() => {
                                      if (typeof row.id !== 'number') return
                                      setReviewItem({ ...row })
                                      setPdfPage(1)
                                      fetchPdfBlob(row.id)
                                      setIsReviewModalOpen(true)
                                    }}
                                    disabled={
                                      typeof row.id !== 'number' || row.status === 'processing'
                                    }
                                    className={cn(
                                      'p-1 rounded transition-colors',
                                      typeof row.id === 'number' && row.status !== 'processing'
                                        ? 'text-blue-500 hover:bg-blue-50'
                                        : 'text-slate-300 cursor-not-allowed'
                                    )}
                                  >
                                    <EyeIcon />
                                  </button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-slate-900 text-white border-none font-bold text-[10px]"
                              >
                                Đối soát PDF
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleteItemConfirm({ open: true, item: row })}
                                  disabled={row.status === 'processing'}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                >
                                  <TrashIcon />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-red-600 text-white border-none font-bold text-[10px]"
                              >
                                Xóa khỏi danh sách
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {bottomSpacer > 0 && (
                  <tr style={{ height: bottomSpacer }}>
                    <td colSpan={8} />
                  </tr>
                )}
              </tbody>
            </table>
            {batchItems.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <svg
                    width={40}
                    height={40}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-600">Chưa có tệp nào</p>
                <p className="text-xs text-slate-400 mt-1.5">
                  Tải tệp PDF lên từ panel bên trái để bắt đầu bóc tách
                </p>
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
            <p className="text-[10px] text-slate-400 font-medium">
              Hiển thị {batchItems.length} tệp
              {selectedIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-bold">· Đã chọn {selectedIds.size}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false)
          if (pdfBlobUrl) {
            URL.revokeObjectURL(pdfBlobUrl)
            setPdfBlobUrl(null)
          }
        }}
        reviewItem={reviewItem}
        setReviewItem={setReviewItem}
        pdfBlobUrl={pdfBlobUrl}
        isPdfLoading={isPdfLoading}
        pdfPage={pdfPage}
        setPdfPage={setPdfPage}
        departments={departments}
        users={users}
        onSave={(updated) => {
          setBatchItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
          setIsReviewModalOpen(false)
        }}
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3.5 rounded-2xl bg-slate-900 shadow-2xl shadow-slate-900/40 border border-white/10 animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-bold text-white">
            Đã chọn <span className="text-blue-400">{selectedIds.size}</span> văn bản
          </span>
          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-wider"
          >
            Bỏ chọn
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={isBulkDeleting || isGlobalProcessing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon />
            {isBulkDeleting ? 'Đang xóa...' : `Xóa ${selectedIds.size} văn bản`}
          </button>
        </div>
      )}

      <ConfirmationModal
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Hủy đợt tải?"
        description="Bạn có chắc chắn muốn hủy đợt bóc tách này? Tất cả dữ liệu chưa lưu sẽ bị xóa vĩnh viễn."
        confirmLabel="XÁC NHẬN HỦY"
        cancelLabel="QUAY LẠI"
        onConfirm={() => executeClearBatch(() => setShowClearConfirm(false))}
        variant="warning"
      />
      <ConfirmationModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={`Xóa ${selectedIds.size} văn bản?`}
        description={`Bạn sắp xóa vĩnh viễn ${selectedIds.size} văn bản đã chọn cùng toàn bộ file đính kèm. Hành động này không thể hoàn tác.`}
        confirmLabel={`XÓA ${selectedIds.size} VĂN BẢN`}
        cancelLabel="QUAY LẠI"
        onConfirm={() => {
          setIsBulkDeleting(true)
          handleBulkDelete(selectedIds, setSelectedIds, () => {
            setIsBulkDeleting(false)
            setShowBulkDeleteConfirm(false)
          })
        }}
        variant="destructive"
      />
      <ConfirmationModal
        open={deleteItemConfirm.open}
        onOpenChange={(open) => setDeleteItemConfirm((prev) => ({ ...prev, open }))}
        title="Xóa khỏi đợt tải?"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deleteItemConfirm.item?.fileName}"?`}
        confirmLabel="XÓA NGAY"
        onConfirm={async () => {
          const item = deleteItemConfirm.item
          if (item && typeof item.id === 'number') {
            try {
              await fetch(`/api/documents/${item.id}`, { method: 'DELETE' })
            } catch {}
          }
          setBatchItems((prev) => prev.filter((i) => i.id !== item.id))
          setDeleteItemConfirm({ open: false, item: null })
          toast.success('Đã gỡ bỏ văn bản')
        }}
        variant="destructive"
      />
    </div>
  )
}
