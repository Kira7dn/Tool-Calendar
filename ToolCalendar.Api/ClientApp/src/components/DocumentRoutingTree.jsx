/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
import { ChevronRight, ChevronDown, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DocumentRoutingTree = ({ routings, onRefresh }) => {
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

  // Khởi tạo tất cả các node đều mở mặc định
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
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <div className="p-4 rounded-full bg-white shadow-sm mb-4">
          <Clock className="size-8 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-600">Chưa có luồng xử lý nào</p>
        <p className="text-xs text-slate-400 mt-1">Hệ thống chưa ghi nhận thông tin luân chuyển.</p>
      </div>
    )
  }

  // Flatten the tree for easy zebra-striping
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

  const HeaderCol = ({ className, children }) => (
    <div
      className={cn(
        'p-3 font-bold text-white uppercase tracking-wider border-r border-white/20 last:border-r-0 text-center flex items-center justify-center',
        className
      )}
    >
      {children}
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Legend */}
      <div className="flex justify-end p-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
          <div className="w-8 h-4 rounded-sm bg-[#db4437]"></div>
          <span>Đã xử lý quá hạn</span>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex text-xs bg-[#17627e]">
        <HeaderCol className="flex-1 min-w-[180px] !justify-start">Người xử lý</HeaderCol>
        <HeaderCol className="w-[90px] shrink-0">Vai trò</HeaderCol>
        <HeaderCol className="w-[100px] shrink-0">Ngày chuyển</HeaderCol>
        <HeaderCol className="w-[100px] shrink-0">Hạn xử lý</HeaderCol>
        <HeaderCol className="flex-1 min-w-[150px]">Bút phê</HeaderCol>
        <HeaderCol className="flex-1 min-w-[150px]">Nội dung xử lý</HeaderCol>
        <HeaderCol className="w-[120px] shrink-0">Trạng thái</HeaderCol>
      </div>

      {/* Table Body */}
      <div className="flex flex-col max-h-[500px] overflow-y-auto text-sm border-x border-b border-slate-200">
        {flatNodes.map((node, index) => {
          const isOverdue = node.status === 'Đã xử lý quá hạn'
          const hasChildren = node.children && node.children.length > 0
          const isExpanded = expandedNodes.has(node.id)

          return (
            <div
              key={node.id}
              className={cn(
                'flex items-stretch border-b border-slate-200 transition-colors',
                index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]',
                isOverdue ? '!bg-[#fde8e8]' : ''
              )}
            >
              {/* Người xử lý column */}
              <div
                className="flex-1 min-w-[180px] p-2 flex items-center gap-2 border-r border-slate-200"
                style={{ paddingLeft: `${Math.max(0.5, node.level * 1.5 + 0.5)}rem` }}
              >
                {hasChildren ? (
                  <button
                    onClick={() => toggleNode(node.id)}
                    className="p-0.5 rounded hover:bg-slate-300 text-slate-600 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="w-[18px]" />
                )}

                {node.level > 0 && <span className="text-slate-400">└─</span>}
                <User size={14} className="text-slate-500" />
                <span
                  className={cn(
                    'whitespace-normal break-words',
                    node.level === 0 ? 'font-bold' : 'font-medium'
                  )}
                >
                  {node.receiverName || 'Unknown User'}
                </span>
              </div>

              {/* Vai trò */}
              <div className="w-[90px] p-2 flex items-center justify-center border-r border-slate-200 shrink-0 text-center text-slate-700">
                {node.role}
              </div>

              {/* Ngày chuyển */}
              <div className="w-[100px] p-2 flex items-center justify-center border-r border-slate-200 shrink-0 text-center text-slate-600">
                {node.forwardDate ? new Date(node.forwardDate).toLocaleDateString('vi-VN') : '---'}
              </div>

              {/* Hạn xử lý */}
              <div className="w-[100px] p-2 flex items-center justify-center border-r border-slate-200 shrink-0 text-center font-semibold text-amber-700">
                {node.deadline ? new Date(node.deadline).toLocaleDateString('vi-VN') : '---'}
              </div>

              {/* Bút phê */}
              <div className="flex-1 min-w-[150px] p-2 flex items-center text-slate-700 border-r border-slate-200 truncate relative group">
                {node.comment || '---'}
                {node.comment && (
                  <div className="absolute hidden group-hover:block z-10 bg-slate-800 text-white p-2 rounded text-xs whitespace-normal min-w-[200px] top-full mt-1 left-0 shadow-lg">
                    {node.comment}
                  </div>
                )}
              </div>

              {/* Nội dung xử lý */}
              <div className="flex-1 min-w-[150px] p-2 flex items-center text-slate-700 border-r border-slate-200 truncate relative group">
                {node.processingContent || '---'}
                {node.processingContent && (
                  <div className="absolute hidden group-hover:block z-10 bg-slate-800 text-white p-2 rounded text-xs whitespace-normal min-w-[200px] top-full mt-1 left-0 shadow-lg">
                    {node.processingContent}
                  </div>
                )}
              </div>

              {/* Trạng thái */}
              <div
                className={cn(
                  'w-[120px] p-2 flex items-center justify-center shrink-0 text-center font-medium',
                  isOverdue ? 'bg-[#db4437] text-white border-l border-[#db4437]' : 'text-slate-800'
                )}
              >
                {node.status}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
