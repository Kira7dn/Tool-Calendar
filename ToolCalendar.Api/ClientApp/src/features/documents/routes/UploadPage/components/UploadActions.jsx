/* eslint-disable */
import React from 'react'

export function UploadActions({
  isGlobalProcessing,
  isSaving,
  batchItemsLength,
  setShowClearConfirm,
  handleSaveAll,
}) {
  return (
    <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
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
          className={`px-4 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
            isGlobalProcessing
              ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          HỦY ĐỢT TẢI
        </button>
        <button
          onClick={() => handleSaveAll()}
          disabled={isSaving || batchItemsLength === 0 || isGlobalProcessing}
          className={`px-6 py-1.5 rounded-lg text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg ${
            isGlobalProcessing || isSaving || batchItemsLength === 0
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
          }`}
        >
          {isGlobalProcessing
            ? 'ĐANG XỬ LÝ OCR...'
            : isSaving
              ? 'ĐANG LƯU...'
              : 'LƯU & PHÂN CÔNG TẤT CẢ'}
        </button>
      </div>
    </div>
  )
}
