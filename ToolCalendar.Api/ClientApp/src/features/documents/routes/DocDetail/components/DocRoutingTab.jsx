/* eslint-disable */
import React, { useMemo } from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
import { Send } from 'lucide-react'
import { DocumentRoutingTree } from '@/components/DocumentRoutingTree'

export function DocRoutingTab({
  doc,
  displayRoutings,
  fetchRoutings,
  setIsForwardModalOpen,
  canForward,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 lg:p-8 flex flex-col h-auto lg:h-full overflow-hidden animate-in fade-in zoom-in-95 duration-400">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
          QUÁ TRÌNH XỬ LÝ (LUÂN CHUYỂN)
        </h2>
        {doc.status !== DOCUMENT_STATUS.DA_XU_LY && canForward && (
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
