// features/notifications/components/NotificationList.jsx
// Danh sách thông báo theo nhóm Mới / Trước đó (Facebook-style)
import React from 'react'
import { cn } from '../../../lib/utils'
import { NotifAvatar } from './NotifAvatar'

function formatRelativeTime(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (diffHour < 24) return `${diffHour} giờ trước`
  if (diffDay === 1) return 'Hôm qua'
  if (diffDay < 7) return `${diffDay} ngày trước`
  return date.toLocaleDateString('vi-VN')
}

function NotifItem({ n, onClickItem }) {
  return (
    <button
      key={n.id}
      type="button"
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors rounded-xl mx-1 text-left group',
        !n.isRead && 'bg-primary/5 hover:bg-primary/10'
      )}
      onClick={() => onClickItem(n)}
    >
      <NotifAvatar title={n.title} isRead={n.isRead} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-[13px] leading-snug line-clamp-2 mb-0.5',
            n.isRead ? 'text-muted-foreground font-medium' : 'text-foreground font-bold'
          )}
        >
          {n.title}
        </p>
        {n.body && (
          <p className="text-[12px] text-muted-foreground line-clamp-2 leading-snug mb-1">
            {n.body}
          </p>
        )}
        <p
          className={cn(
            'text-[11px] font-bold',
            n.isRead ? 'text-muted-foreground/60' : 'text-primary'
          )}
        >
          {formatRelativeTime(n.createdAt)}
        </p>
      </div>
      {!n.isRead && <div className="shrink-0 size-2.5 rounded-full bg-primary mt-2" />}
    </button>
  )
}

export function NotificationList({ notifications, onClickItem }) {
  const now = new Date()
  const newNotifs = notifications.filter((n) => now - new Date(n.createdAt) < 86400000)
  const oldNotifs = notifications.filter((n) => now - new Date(n.createdAt) >= 86400000)

  return (
    <div className="py-2 px-1">
      {newNotifs.length > 0 && (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-4 py-1.5">
            Mới
          </p>
          {newNotifs.map((n) => (
            <NotifItem key={n.id} n={n} onClickItem={onClickItem} />
          ))}
        </>
      )}
      {oldNotifs.length > 0 && (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-4 py-1.5 mt-1">
            Trước đó
          </p>
          {oldNotifs.map((n) => (
            <NotifItem key={n.id} n={n} onClickItem={onClickItem} />
          ))}
        </>
      )}
    </div>
  )
}
