/* eslint-disable */
import React from 'react'
import { FileText } from 'lucide-react'
import { MeetingList } from './MeetingList'

export function CabinetMeetings({ activeTab }) {
  if (activeTab === 0) {
    return <MeetingList />
  }

  // Placeholder for other tabs
  const tabNames = [
    'Danh sách phiên họp',
    'Kỷ yếu phiên họp',
    'Tra cứu kết luận phiên họp',
    'Quản lý sổ tay',
  ]
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <FileText size={28} className="opacity-25" />
      </div>
      <h3 className="text-base font-bold text-gray-600 mb-1">Đang phát triển</h3>
      <p className="text-sm">
        Tính năng &quot;{tabNames[activeTab] || 'Quản lý họp'}&quot; sẽ sớm được cập nhật.
      </p>
    </div>
  )
}
