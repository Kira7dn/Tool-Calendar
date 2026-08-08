/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// features/notifications/hooks/useNotifications.js
// Toàn bộ logic fetch, mark-read, SignalR listener cho thông báo
import { toast } from 'sonner'

export function useNotifications({ onOpenDoc }) {
  const [notifications, setNotifications] = useState([])
  const [notifCount, setNotifCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notification')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
        const unreadCount = data.filter((n) => !n.isRead).length
        setNotifCount(unreadCount)

        if (data.length > 0 && !data[0].isRead) {
          const lastSeenId = localStorage.getItem('last_notif_id')
          if (lastSeenId !== data[0].id.toString()) {
            toast.info(data[0].title, {
              description: data[0].body,
              action: {
                label: 'Xem',
                onClick: () => {
                  if (data[0].docId && onOpenDoc) onOpenDoc(data[0].docId)
                  markRead(data[0].id)
                },
              },
            })
            localStorage.setItem('last_notif_id', data[0].id.toString())
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e)
    }
  }, [onOpenDoc])

  const markRead = useCallback(
    async (id) => {
      try {
        await fetch(`/api/notification/mark-read/${id}`, { method: 'POST' })
        fetchNotifications()
      } catch (e) {
        console.error(e)
      }
    },
    [fetchNotifications]
  )

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notification/mark-all-read', { method: 'POST' })
      fetchNotifications()
    } catch (e) {
      console.error(e)
    }
  }, [fetchNotifications])

  return { notifications, notifCount, fetchNotifications, markRead, markAllRead }
}
