/* eslint-disable */
import React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ROLES } from '@/constants/roles'

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
const EyeIcon = () => (
  <Svg size={13}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
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

export function UploadTable({
  batchItems,
  tableScrollRef,
  setTableScrollTop,
  isAllSelected,
  isIndeterminate,
  toggleSelectAll,
  topSpacer,
  visibleItems,
  selectedIds,
  toggleSelectOne,
  updateItem,
  setBatchItems,
  departments,
  users,
  setReviewItem,
  setPdfPage,
  fetchPdfBlob,
  setIsReviewModalOpen,
  setDeleteItemConfirm,
  bottomSpacer,
}) {
  return (
    <div className="flex-1 min-h-[500px] lg:min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-w-0">
      <div
        ref={tableScrollRef}
        className="flex-1 overflow-auto"
        onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
      >
        <table className="w-full text-xs border-collapse min-w-[900px] table-fixed">
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
              {[
                { label: 'Tên tệp', width: 'w-[220px]' },
                { label: 'Số hiệu', width: 'w-[100px]' },
                { label: 'Thời hạn', width: 'w-[110px]' },
                { label: 'Đơn vị', width: 'w-[140px]' },
                { label: 'Cán bộ', width: 'w-[140px]' },
                { label: 'Trạng thái', width: 'w-[100px]' },
                { label: '', width: 'w-[90px]' },
              ].map((h) => (
                <th
                  key={h.label}
                  className={cn(
                    'px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap',
                    h.width
                  )}
                >
                  {h.label}
                </th>
              ))}
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
                          isRowSelected ? 'bg-blue-100 border-blue-200' : 'bg-red-50 border-red-100'
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
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white placeholder-slate-300 transition-all font-bold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={row.thoiHan}
                      onChange={(e) => updateItem(row.id, 'thoiHan', e.target.value)}
                      disabled={row.status === 'processing'}
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Chọn đơn vị</option>
                      {departments
                        .filter((d) => d.isActive !== false || d.id === item?.departmentIds?.[0])
                        .map((d) => (
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
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Chọn cán bộ</option>
                      {(row.departmentIds[0]
                        ? users.filter(
                            (u) => u.role === ROLES.ADMIN || u.departmentId === row.departmentIds[0]
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
                                disabled={typeof row.id !== 'number' || row.status === 'processing'}
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
  )
}
