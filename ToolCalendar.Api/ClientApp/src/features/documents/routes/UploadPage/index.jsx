/* eslint-disable */
import React, { useRef, useState, useEffect } from 'react'
import { UploadDropzone } from '../../components/UploadDropzone'
import { useBulkSelect } from '../../hooks/useBulkSelect'
import { useSaveAll } from '../../hooks/useSaveAll'

import { useUploadPage } from './hooks/useUploadPage'
import { UploadActions } from './components/UploadActions'
import { UploadTable } from './components/UploadTable'
import { UploadModals } from './components/UploadModals'

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
const TrashIcon = () => (
  <Svg size={13}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
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

export function UploadPage() {
  const {
    isDragging,
    setIsDragging,
    batchItems,
    setBatchItems,
    isProcessing,
    overallProgress,
    currentFileName,
    handleFileUpload,
    departments,
    users,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewItem,
    setReviewItem,
    pdfPage,
    setPdfPage,
    pdfPageCount,
    pdfBlobUrl,
    setPdfBlobUrl,
    isPdfLoading,
    setIsPdfLoading,
    showClearConfirm,
    setShowClearConfirm,
    deleteItemConfirm,
    setDeleteItemConfirm,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isBulkDeleting,
    setIsBulkDeleting,
    fetchPdfBlob,
    updateItem,
    handleDeleteItem,
  } = useUploadPage()

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
    const el = tableScrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setTableHeight(entry.contentRect.height)
    })
    ro.observe(el)
    setTableHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

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
      <UploadActions
        isGlobalProcessing={isGlobalProcessing}
        isSaving={isSaving}
        batchItemsLength={batchItems.length}
        setShowClearConfirm={setShowClearConfirm}
        handleSaveAll={handleSaveAll}
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-y-auto lg:overflow-hidden min-h-0">
        {(batchItems.length === 0 || isGlobalProcessing) && (
          <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto lg:pb-2 min-h-0">
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
        )}

        <UploadTable
          batchItems={batchItems}
          tableScrollRef={tableScrollRef}
          setTableScrollTop={setTableScrollTop}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          toggleSelectAll={toggleSelectAll}
          topSpacer={topSpacer}
          visibleItems={visibleItems}
          selectedIds={selectedIds}
          toggleSelectOne={toggleSelectOne}
          updateItem={updateItem}
          setBatchItems={setBatchItems}
          departments={departments}
          users={users}
          setReviewItem={setReviewItem}
          setPdfPage={setPdfPage}
          fetchPdfBlob={fetchPdfBlob}
          setIsReviewModalOpen={setIsReviewModalOpen}
          setDeleteItemConfirm={setDeleteItemConfirm}
          bottomSpacer={bottomSpacer}
        />
      </div>

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

      <UploadModals
        showClearConfirm={showClearConfirm}
        setShowClearConfirm={setShowClearConfirm}
        executeClearBatch={executeClearBatch}
        showBulkDeleteConfirm={showBulkDeleteConfirm}
        setShowBulkDeleteConfirm={setShowBulkDeleteConfirm}
        selectedIds={selectedIds}
        setIsBulkDeleting={setIsBulkDeleting}
        handleBulkDelete={handleBulkDelete}
        setSelectedIds={setSelectedIds}
        deleteItemConfirm={deleteItemConfirm}
        setDeleteItemConfirm={setDeleteItemConfirm}
        handleDeleteItem={handleDeleteItem}
        isReviewModalOpen={isReviewModalOpen}
        setIsReviewModalOpen={setIsReviewModalOpen}
        pdfBlobUrl={pdfBlobUrl}
        setPdfBlobUrl={setPdfBlobUrl}
        reviewItem={reviewItem}
        setReviewItem={setReviewItem}
        isPdfLoading={isPdfLoading}
        pdfPage={pdfPage}
        setPdfPage={setPdfPage}
        pdfPageCount={pdfPageCount}
        departments={departments}
        users={users}
        setBatchItems={setBatchItems}
      />
    </div>
  )
}
