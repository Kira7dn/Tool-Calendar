// features/notifications/components/NotifAvatar.jsx
// Icon avatar cho từng loại thông báo
import React from 'react'
import { cn } from '../../../lib/utils'

export function NotifAvatar({ title, isRead }) {
  const isOverdue = /quá hạn/i.test(title)
  const isNew = /mới|tiếp nhận|tải lên/i.test(title)
  const isAssign = /phân công|giao/i.test(title)
  const isComplete = /hoàn thành|xử lý xong/i.test(title)

  let bg = 'bg-info/15'
  let icon = '📄'
  if (isOverdue) {
    bg = 'bg-destructive/15'
    icon = '⚠️'
  } else if (isNew) {
    bg = 'bg-success/15'
    icon = '📥'
  } else if (isAssign) {
    bg = 'bg-warning/15'
    icon = '📋'
  } else if (isComplete) {
    bg = 'bg-success/15'
    icon = '✅'
  }

  return (
    <div
      className={`relative shrink-0 size-12 rounded-full ${bg} flex items-center justify-center text-xl`}
    >
      {icon}
      {!isRead && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-primary border-2 border-background" />
      )}
    </div>
  )
}
