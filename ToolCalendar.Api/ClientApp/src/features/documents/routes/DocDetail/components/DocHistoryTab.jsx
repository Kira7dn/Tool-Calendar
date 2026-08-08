/* eslint-disable */
import React from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
import { cn } from '@/lib/utils'

const HistoryPoint = ({ title, time, user, active }) => (
  <div className="relative pl-8">
    <div
      className={cn(
        'absolute left-[-24px] top-1.5 w-3 h-3 rounded-full border-2 bg-white',
        active ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-slate-300'
      )}
    />
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          'text-[10px] font-black uppercase tracking-widest',
          active ? 'text-red-600' : 'text-slate-500'
        )}
      >
        {title}
      </span>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{time}</span>
      <span className="text-sm font-bold text-slate-800 mt-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block w-fit">
        {user}
      </span>
    </div>
  </div>
)

export function DocHistoryTab({ doc, users, routings }) {
  const flattenRoutings = (list) => {
    let result = []
    if (!list || !Array.isArray(list)) return result
    for (const r of list) {
      result.push(r)
      if (r.children && Array.isArray(r.children)) {
        result = result.concat(flattenRoutings(r.children))
      }
    }
    return result
  }

  const historyEvents = []
  if (doc?.ngayThem) {
    historyEvents.push({
      id: 'create',
      title: 'TIẾP NHẬN VĂN BẢN',
      time: new Date(doc.ngayThem),
      user: doc?.uploadedByUserId
        ? users.find((u) => u.id === doc.uploadedByUserId)?.fullName || 'HỆ THỐNG'
        : 'HỆ THỐNG',
      active: true,
    })
  }

  const flatRoutings = flattenRoutings(routings)

  // Chỉ hiển thị "PHÂN CÔNG XỬ LÝ" nếu văn bản chưa từng được luân chuyển (routings trống).
  // Vì nếu đã luân chuyển, người đang xử lý hiện tại (doc.assignedTo) không phải là người được phân công ban đầu.
  if (
    doc?.assignedTo &&
    doc?.ngayThem &&
    flatRoutings.length === 0 &&
    doc.assignedTo !== doc.uploadedByUserId
  ) {
    historyEvents.push({
      id: 'assign',
      title: 'PHÂN CÔNG XỬ LÝ',
      time: new Date(doc.ngayThem),
      user: users.find((u) => u.id === doc.assignedTo)?.fullName || 'Không xác định',
      active: false,
    })
  }

  flatRoutings.forEach((r) => {
    const sender = r.senderName || users.find((u) => u.id === r.senderId)?.fullName || 'Hệ thống'
    const receiver =
      r.receiverName || users.find((u) => u.id === r.receiverId)?.fullName || 'Không xác định'
    historyEvents.push({
      id: `routing_${r.id}`,
      title: `CHUYỂN XỬ LÝ - Vai trò: ${r.role}`,
      time: new Date(r.createdAt),
      user: `${sender} ➔ ${receiver}`,
      active: false,
    })
  })

  if (doc?.status === DOCUMENT_STATUS.HOAN_THANH) {
    historyEvents.push({
      id: 'complete',
      title: 'HOÀN THÀNH VĂN BẢN',
      time: doc?.completionDate ? new Date(doc.completionDate) : new Date(),
      user: doc?.assignedTo ? users.find((u) => u.id === doc.assignedTo)?.fullName : 'Hệ thống',
      active: true,
    })
  }

  historyEvents.sort((a, b) => a.time - b.time)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col h-auto lg:h-full overflow-hidden lg:overflow-auto animate-in fade-in slide-in-from-bottom-4 duration-400">
      <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-12 shrink-0">
        QUY TRÌNH XỬ LÝ VĂN BẢN
      </h2>
      <div className="relative space-y-10 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100">
        {historyEvents.map((evt, idx) => (
          <HistoryPoint
            key={evt.id || idx}
            title={evt.title}
            time={evt.time.toLocaleString('vi-VN')}
            user={evt.user}
            active={evt.active}
          />
        ))}
      </div>
    </div>
  )
}
