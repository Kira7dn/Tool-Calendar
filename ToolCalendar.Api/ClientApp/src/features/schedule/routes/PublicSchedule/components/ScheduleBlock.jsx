/* eslint-disable */
import React from 'react'

export function ScheduleBlock({ day, onViewDoc }) {
  return (
    <div className="mb-6">
      <p className="text-[#0a3d8f] font-black text-sm mb-2 uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-[#cc0000] rounded-full" />
        {day.dayLabel}, {day.date}
      </p>
      <div className="space-y-3">
        {day.items.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onViewDoc(item.docToken)}
            className="bg-white/60 p-3 rounded-lg border-l-4 border-gray-300 hover:border-[#cc0000] hover:bg-white cursor-pointer transition-all group shadow-sm"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[#cc0000] font-bold text-[11px] px-2 py-0.5 bg-red-50 rounded">
                {item.docNumber}
              </span>
              <svg
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#cc0000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-gray-700 text-xs leading-relaxed font-medium line-clamp-2 italic mb-3">
              "{item.content}"
            </p>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[9px] text-[#0a3d8f] font-black uppercase flex items-center gap-1 group-hover:text-[#cc0000] transition-colors">
                Xem chi tiết PDF
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
