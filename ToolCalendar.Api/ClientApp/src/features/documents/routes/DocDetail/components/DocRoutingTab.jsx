/* eslint-disable */
import React, { useMemo } from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
import { Send } from 'lucide-react'
import { DocumentRoutingTree } from '@/components/DocumentRoutingTree'

export function DocRoutingTab({
  doc,
  routings,
  fetchRoutings,
  setIsForwardModalOpen,
  canForward,
  users,
}) {
  const displayRoutings = useMemo(() => {
    if (doc?.assignedTo && doc.assignedTo !== doc?.uploadedByUserId) {
      const assignedUser = users?.find((u) => u.id === doc.assignedTo)
      return [
        {
          id: 'synthetic-root',
          receiverName: assignedUser?.fullName || 'Người được phân công',
          receiverId: doc.assignedTo,
          role: 'Xử lý chính',
          forwardDate: doc.ngayThem,
          deadline: doc.thoiHan,
          comment: 'Nhận nhiệm vụ xử lý chính',
          processingContent: '',
          status: routings && routings.length > 0 ? 'Đã chuyển tiếp' : doc.status,
          children: routings || [],
        },
      ]
    }
    return routings || []
  }, [routings, doc, users])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 lg:p-8 flex flex-col h-auto lg:h-full overflow-hidden animate-in fade-in zoom-in-95 duration-400">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
          QUÁ TRÌNH XỬ LÝ (LUÂN CHUYỂN)
        </h2>
        {doc.status !== DOCUMENT_STATUS.DA_HOAN_THANH && canForward && (
          <button
            onClick={() => setIsForwardModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
          >
            <Send size={14} /> Chuyển xử lý
          </button>
        )}
      </div>
      <div className="flex-1 lg:overflow-auto h-[400px] lg:h-auto overflow-y-auto">
        <DocumentRoutingTree routings={displayRoutings} onRefresh={fetchRoutings} />
      </div>
    </div>
  )
}
