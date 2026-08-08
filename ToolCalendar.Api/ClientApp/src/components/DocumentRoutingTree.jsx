/* eslint-disable */
import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Clock, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  'Hoàn thành': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'Đã xử lý': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'Đang xử lý': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Chưa xử lý': 'bg-slate-100 text-slate-600 border border-slate-200',
  'Từ chối': 'bg-red-100 text-red-700 border border-red-200',
  'Đã xử lý quá hạn': 'bg-red-500 text-white border border-red-600',
}

const Tooltip = ({ text, children }) => (
  <div className="relative group inline-flex max-w-full">
    {children}
    {text && text !== '---' && (
      <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-[9999] hidden -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-xl group-hover:block whitespace-pre-wrap max-w-[280px]">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800" />
      </div>
    )}
  </div>
)

export const DocumentRoutingTree = ({ routings }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set())

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  React.useEffect(() => {
    if (routings && routings.length > 0) {
      const allIds = new Set()
      const extractIds = (nodes) => {
        nodes.forEach((n) => {
          allIds.add(n.id)
          if (n.children) extractIds(n.children)
        })
      }
      extractIds(routings)
      setExpandedNodes(allIds)
    }
  }, [routings])

  if (!routings || !Array.isArray(routings) || routings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <div className="p-5 rounded-full bg-white shadow-md mb-4 ring-4 ring-slate-100">
          <Clock className="size-9 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-500">Chưa có luồng xử lý nào</p>
        <p className="text-xs text-slate-400 mt-1">Hệ thống chưa ghi nhận thông tin luân chuyển.</p>
      </div>
    )
  }

  const flatNodes = []
  const flatten = (nodes, level = 0) => {
    nodes.forEach((node) => {
      flatNodes.push({ ...node, level })
      if (expandedNodes.has(node.id) && node.children && node.children.length > 0) {
        flatten(node.children, level + 1)
      }
    })
  }
  flatten(routings)

  const COLS = [
    { key: 'person', label: 'Người xử lý', className: 'w-[200px] text-left' },
    { key: 'role', label: 'Vai trò', className: 'w-[100px] text-center' },
    { key: 'fwd', label: 'Ngày chuyển', className: 'w-[110px] text-center' },
    { key: 'deadline', label: 'Hạn xử lý', className: 'w-[110px] text-center' },
    { key: 'comment', label: 'Bút phê', className: 'w-[160px] text-left' },
    { key: 'content', label: 'Nội dung xử lý', className: 'w-[180px] text-left' },
    { key: 'status', label: 'Trạng thái', className: 'w-[130px] text-center' },
  ]

  return (
    <div
      className="rounded-xl border border-slate-200 shadow-sm bg-white"
      style={{ overflow: 'visible' }}
    >
      {/* Legend */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
          <AlertCircle size={13} className="text-slate-400" />
          <span>Luồng luân chuyển công văn</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500"></span>
          Đã xử lý quá hạn
        </div>
      </div>

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '990px' }}>
          {/* Header */}
          <div className="flex bg-gradient-to-r from-[#17627e] to-[#1a7a9e] text-[11px] font-bold text-white uppercase tracking-widest">
            {COLS.map((col, i) => (
              <div
                key={col.key}
                className={cn(
                  'px-3 py-3 border-r border-white/10 last:border-r-0 flex items-center shrink-0',
                  col.className,
                  col.key === 'person' ? 'flex-1 min-w-[200px]' : '',
                  col.key === 'comment' || col.key === 'content' ? 'flex-1 min-w-[160px]' : ''
                )}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex flex-col divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {flatNodes.map((node, index) => {
              const isOverdue = node.status === 'Đã xử lý quá hạn'
              const hasChildren = node.children && node.children.length > 0
              const isExpanded = expandedNodes.has(node.id)
              const statusStyle =
                STATUS_STYLES[node.status] || 'bg-slate-100 text-slate-600 border border-slate-200'

              return (
                <div
                  key={node.id}
                  className={cn(
                    'flex items-center text-xs transition-colors hover:bg-blue-50/40',
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60',
                    isOverdue ? '!bg-red-50' : ''
                  )}
                >
                  {/* Người xử lý */}
                  <div
                    className="flex-1 min-w-[200px] px-3 py-2.5 flex items-center gap-1.5 border-r border-slate-100 shrink-0"
                    style={{ paddingLeft: `${Math.max(0.75, node.level * 1.5 + 0.75)}rem` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => toggleNode(node.id)}
                        className="p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                      >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    ) : (
                      <span className="w-[17px] shrink-0" />
                    )}
                    {node.level > 0 && (
                      <span className="text-slate-300 shrink-0 text-[10px]">└</span>
                    )}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#17627e] to-[#1a9ac7] flex items-center justify-center text-white text-[9px] font-black shrink-0">
                      {(node.receiverName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <Tooltip text={node.receiverName}>
                      <span
                        className={cn(
                          'truncate max-w-[120px]',
                          node.level === 0
                            ? 'font-bold text-slate-800'
                            : 'font-medium text-slate-600'
                        )}
                      >
                        {node.receiverName || 'Unknown'}
                      </span>
                    </Tooltip>
                  </div>

                  {/* Vai trò */}
                  <div className="w-[100px] px-3 py-2.5 flex items-center justify-center border-r border-slate-100 shrink-0 text-slate-600">
                    {node.role || '---'}
                  </div>

                  {/* Ngày chuyển */}
                  <div className="w-[110px] px-3 py-2.5 flex items-center justify-center border-r border-slate-100 shrink-0 text-slate-500">
                    {node.forwardDate
                      ? new Date(node.forwardDate).toLocaleDateString('vi-VN')
                      : '---'}
                  </div>

                  {/* Hạn xử lý */}
                  <div
                    className={cn(
                      'w-[110px] px-3 py-2.5 flex items-center justify-center border-r border-slate-100 shrink-0 font-semibold',
                      isOverdue ? 'text-red-600' : 'text-amber-600'
                    )}
                  >
                    {node.deadline ? new Date(node.deadline).toLocaleDateString('vi-VN') : '---'}
                  </div>

                  {/* Bút phê */}
                  <Tooltip text={node.comment}>
                    <div className="flex-1 min-w-[160px] px-3 py-2.5 border-r border-slate-100 shrink-0 text-slate-600 truncate">
                      {node.comment || <span className="text-slate-300">---</span>}
                    </div>
                  </Tooltip>

                  {/* Nội dung xử lý */}
                  <Tooltip text={node.processingContent}>
                    <div className="flex-1 min-w-[180px] px-3 py-2.5 border-r border-slate-100 shrink-0 text-slate-600 truncate">
                      {node.processingContent || <span className="text-slate-300">---</span>}
                    </div>
                  </Tooltip>

                  {/* Trạng thái */}
                  <div className="w-[130px] px-3 py-2.5 flex items-center justify-center shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap',
                        statusStyle
                      )}
                    >
                      {node.status || '---'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
