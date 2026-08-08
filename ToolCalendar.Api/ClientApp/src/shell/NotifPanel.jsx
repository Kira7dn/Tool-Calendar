// shell/NotifPanel.jsx
// Popover thông báo Desktop + Full-screen Mobile (tách từ AppShell)
import React from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NotificationList } from '../features/notifications/components/NotificationList'

function EmptyNotif({ size = 'md' }) {
  const iconSize = size === 'lg' ? 'size-20' : 'size-16'
  const bellSize = size === 'lg' ? 'size-9' : 'size-7'
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
      <div className={`${iconSize} rounded-full bg-muted/60 flex items-center justify-center mb-4`}>
        <Bell className={`${bellSize} text-muted-foreground/30`} />
      </div>
      <p className="text-sm font-bold">Không có thông báo nào</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Mọi hoạt động trong hệ thống sẽ hiển thị ở đây
      </p>
    </div>
  )
}

// Desktop Popover
export function NotifPopover({
  isOpen,
  setIsOpen,
  notifications,
  notifCount,
  markAllRead,
  markRead,
  onOpenDoc,
  onViewAll,
}) {
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-all size-10 p-2"
        >
          <Bell className="size-5" />
          {notifCount > 0 && (
            <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[10px] font-bold">
              {notifCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-card"
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-xl font-black text-foreground">Thông báo</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary hover:bg-primary/10 font-bold rounded-lg"
            onClick={markAllRead}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
        <Tabs defaultValue="all" className="w-full">
          <div className="px-5">
            <TabsList className="h-9 bg-muted/60 rounded-xl p-1 w-full grid grid-cols-2">
              <TabsTrigger
                value="all"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Tất cả
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Chưa đọc{' '}
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span className="ml-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-black rounded-full">
                    {notifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="m-0 mt-1">
            <ScrollArea className="h-[420px]">
              {notifications.length > 0 ? (
                <NotificationList
                  notifications={notifications}
                  onClickItem={(n) => {
                    if (n.docId) onOpenDoc(n.docId)
                    if (!n.isRead) markRead(n.id)
                    setIsOpen(false)
                  }}
                />
              ) : (
                <EmptyNotif />
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="unread" className="m-0 mt-1">
            <ScrollArea className="h-[420px]">
              {notifications.filter((n) => !n.isRead).length > 0 ? (
                <NotificationList
                  notifications={notifications.filter((n) => !n.isRead)}
                  onClickItem={(n) => {
                    if (n.docId) onOpenDoc(n.docId)
                    markRead(n.id)
                    setIsOpen(false)
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                  <div className="size-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                    <Bell className="size-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-bold">Tất cả đã được đọc!</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        <div className="border-t border-border/50 bg-muted/20 text-center flex justify-center py-1">
          <Button
            variant="link"
            className="text-xs font-bold text-primary w-full"
            onClick={() => {
              onViewAll()
              setIsOpen(false)
            }}
          >
            Xem tất cả văn bản
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Mobile Full-screen Panel
export function NotifMobilePanel({
  isOpen,
  setIsOpen,
  notifications,
  markAllRead,
  markRead,
  onOpenDoc,
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[600] bg-background flex flex-col animate-in slide-in-from-bottom-4 duration-300 md:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background">
        <h2 className="text-xl font-black text-foreground">Thông báo</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary hover:bg-primary/10 font-bold rounded-lg"
            onClick={markAllRead}
          >
            Đánh dấu đã đọc
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full hover:bg-muted"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>
      <Tabs defaultValue="all" className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 pt-3 shrink-0">
          <TabsList className="h-10 bg-muted/60 rounded-xl p-1 w-full grid grid-cols-2">
            <TabsTrigger
              value="all"
              className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Tất cả
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Chưa đọc{' '}
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-black rounded-full">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="all" className="flex-1 overflow-y-auto m-0 mt-2 pb-20">
          {notifications.length > 0 ? (
            <NotificationList
              notifications={notifications}
              onClickItem={(n) => {
                if (n.docId) onOpenDoc(n.docId)
                if (!n.isRead) markRead(n.id)
                setIsOpen(false)
              }}
            />
          ) : (
            <EmptyNotif size="lg" />
          )}
        </TabsContent>
        <TabsContent value="unread" className="flex-1 overflow-y-auto m-0 mt-2 pb-20">
          {notifications.filter((n) => !n.isRead).length > 0 ? (
            <NotificationList
              notifications={notifications.filter((n) => !n.isRead)}
              onClickItem={(n) => {
                if (n.docId) onOpenDoc(n.docId)
                markRead(n.id)
                setIsOpen(false)
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <div className="size-20 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                <Bell className="size-9 text-muted-foreground/30" />
              </div>
              <p className="text-base font-bold">Tất cả đã được đọc!</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
