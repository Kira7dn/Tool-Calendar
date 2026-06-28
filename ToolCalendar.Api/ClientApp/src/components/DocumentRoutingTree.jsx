/* eslint-disable */
import React, { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const RoutingNode = ({ node, level = 0 }) => {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0

  return (
    <>
      <div
        className={cn(
          'flex items-center hover:bg-slate-50 border-b border-slate-100 transition-colors',
          level === 0 ? 'bg-white font-medium' : 'bg-white'
        )}
      >
        {/* Người xử lý column */}
        <div
          className="flex-1 min-w-[200px] p-3 flex items-center gap-2 border-r border-slate-100"
          style={{ paddingLeft: `${Math.max(0.75, level * 1.5 + 0.75)}rem` }}
        >
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[18px]" /> // placeholder for alignment
          )}

          {level > 0 && <span className="text-slate-300">└─</span>}

          <User size={14} className={level === 0 ? 'text-blue-500' : 'text-slate-400'} />
          <span
            className={cn(
              'text-xs truncate',
              level === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'
            )}
          >
            {node.receiverName || 'Unknown User'}
          </span>
        </div>

        {/* Vai trò */}
        <div className="w-[100px] p-3 text-xs text-center border-r border-slate-100 shrink-0 font-medium text-slate-600">
          {node.role}
        </div>

        {/* Ngày chuyển */}
        <div className="w-[110px] p-3 text-[11px] text-center border-r border-slate-100 shrink-0 text-slate-500">
          {node.forwardDate ? new Date(node.forwardDate).toLocaleDateString('vi-VN') : '---'}
        </div>

        {/* Hạn xử lý */}
        <div className="w-[110px] p-3 text-[11px] text-center border-r border-slate-100 shrink-0 font-semibold text-amber-600">
          {node.deadline ? new Date(node.deadline).toLocaleDateString('vi-VN') : '---'}
        </div>

        {/* Bút phê */}
        <div className="flex-1 min-w-[150px] p-3 text-xs italic text-slate-600 border-r border-slate-100 truncate relative group">
          {node.comment || '---'}
          {node.comment && (
            <div className="absolute hidden group-hover:block z-10 bg-slate-800 text-white p-2 rounded text-[10px] whitespace-normal min-w-[200px] top-full mt-1 left-0 shadow-lg">
              {node.comment}
            </div>
          )}
        </div>

        {/* Nội dung xử lý */}
        <div className="flex-1 min-w-[150px] p-3 text-xs text-slate-600 border-r border-slate-100 truncate relative group">
          {node.processingContent || '---'}
          {node.processingContent && (
            <div className="absolute hidden group-hover:block z-10 bg-slate-800 text-white p-2 rounded text-[10px] whitespace-normal min-w-[200px] top-full mt-1 left-0 shadow-lg">
              {node.processingContent}
            </div>
          )}
        </div>

        {/* Trạng thái */}
        <div className="w-[120px] p-3 text-xs text-center shrink-0">
          <span
            className={cn(
              'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
              node.status === 'Đã hoàn thành' || node.status === 'Đã xử lý'
                ? 'bg-green-50 text-green-700'
                : node.status === 'Đang giải quyết' || node.status === 'Đang xử lý'
                  ? 'bg-blue-50 text-blue-700'
                  : node.status === 'Đã xử lý quá hạn'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-slate-100 text-slate-500'
            )}
          >
            {node.status}
          </span>
        </div>
      </div>

      {/* Render children recursively */}
      {expanded &&
        hasChildren &&
        node.children.map((child, idx) => (
          <RoutingNode key={child.id || idx} node={child} level={level + 1} />
        ))}
    </>
  )
}

export const DocumentRoutingTree = ({ routings, onRefresh }) => {
  if (!routings || routings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <div className="p-4 rounded-full bg-white shadow-sm mb-4">
          <Clock className="size-8 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-600">Chưa có luồng xử lý nào</p>
        <p className="text-xs text-slate-400 mt-1">Hệ thống chưa ghi nhận thông tin luân chuyển.</p>
      </div>
    )
  }

  // Header helpers
  const HeaderCol = ({ className, children }) => (
    <div
      className={cn(
        'p-3 font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200 border-r last:border-r-0',
        className
      )}
    >
      {children}
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header */}
      <div className="flex text-[10px]">
        <HeaderCol className="flex-1 min-w-[200px]">Người xử lý</HeaderCol>
        <HeaderCol className="w-[100px] text-center shrink-0">Vai trò</HeaderCol>
        <HeaderCol className="w-[110px] text-center shrink-0">Ngày chuyển</HeaderCol>
        <HeaderCol className="w-[110px] text-center shrink-0">Hạn xử lý</HeaderCol>
        <HeaderCol className="flex-1 min-w-[150px]">Bút phê</HeaderCol>
        <HeaderCol className="flex-1 min-w-[150px]">Nội dung xử lý</HeaderCol>
        <HeaderCol className="w-[120px] text-center shrink-0">Trạng thái</HeaderCol>
      </div>

      {/* Table Body */}
      <div className="flex flex-col max-h-[500px] overflow-y-auto">
        {routings.map((rootNode, idx) => (
          <RoutingNode key={rootNode.id || idx} node={rootNode} level={0} />
        ))}
      </div>
    </div>
  )
}
