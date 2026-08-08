// shell/AppShell.jsx — Layout khung chính (Sidebar + Header + Page content)
// Sau khi refactor: ~200 dòng thay vì 1183 dòng
/* eslint-disable */
/* global CustomEvent */
import React from 'react'
import { Bell, CheckSquare, FileText, LayoutDashboard } from 'lucide-react'
import { ROLES } from '../constants/roles'
import { AppSidebar } from './Sidebar.jsx'
import { NotifPopover, NotifMobilePanel } from './NotifPanel.jsx'
import { UserMenu } from './UserMenu.jsx'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toaster, toast } from 'sonner'
import { cn } from '@/lib/utils'
import { registerServiceWorker, subscribeUserToPush } from '@/lib/push-notifications'
import { signalRService } from '@/lib/signalr'
import { useNotifications } from '../features/notifications/hooks/useNotifications'

import { Dashboard } from '../documents/pages/Dashboard.jsx'
import { Documents } from '../documents/pages/Documents.jsx'
import { Upload } from '../documents/pages/Upload.jsx'
import { Users } from '../pages/Users.jsx'
import DocDetail from '../documents/pages/DocDetail.jsx'
import { MyTasks } from '../documents/pages/MyTasks.jsx'
import { Review } from '../documents/pages/Review.jsx'
import { Settings as SettingsPage } from '../pages/Settings.jsx'
import { Search as SearchPage } from '../documents/pages/Search.jsx'
import { MonthlyReport } from '../documents/pages/MonthlyReport.jsx'

export function AppShell() {
  const [activeTab, setActiveTab] = React.useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || 'dashboard'
  })
  const [tabFilters, setTabFilters] = React.useState({})
  const [currentDocId, setCurrentDocId] = React.useState(null)
  const [isReviewOpen, setIsReviewOpen] = React.useState(false)
  const [isNotifOpen, setIsNotifOpen] = React.useState(false)
  const [isNotifMobileOpen, setIsNotifMobileOpen] = React.useState(false)
  const [pushPermission, setPushPermission] = React.useState('default')
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [user, setUser] = React.useState(() => ({
    name: localStorage.getItem('user_full_name') || localStorage.getItem('user_name') || 'Cán bộ',
    role: localStorage.getItem('user_role') || ROLES.CAN_BO,
  }))

  const { notifications, notifCount, fetchNotifications, markRead, markAllRead } = useNotifications(
    {
      onOpenDoc: (id) => setCurrentDocId(id),
    }
  )

  React.useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      window.location.href = '/'
      return
    }

    const name = localStorage.getItem('user_name') || 'User'
    const role = localStorage.getItem('user_role') || ROLES.CAN_BO
    setUser({ name, role })

    const handleNotifUpdate = () => fetchNotifications()
    document.addEventListener('realtime:notifications_updated', handleNotifUpdate)
    fetchNotifications()

    const isSecure = typeof window !== 'undefined' && window.isSecureContext
    if (!isSecure) {
      toast.warning(
        'Kết nối HTTP không bảo mật: Trình duyệt không hỗ trợ gửi thông báo đẩy trên các liên kết HTTP.',
        {
          description:
            'Vui lòng truy cập qua đường dẫn HTTPS hoặc dùng link Ngrok để có thể nhận được thông báo đẩy tức thời!',
          duration: 10000,
        }
      )
    }

    if ('Notification' in window) {
      registerServiceWorker().then(async (registration) => {
        if (registration) registration.update()
        try {
          const currentPermission = Notification.permission
          setPushPermission(currentPermission)
          if (currentPermission === 'granted') {
            await subscribeUserToPush()
          } else if (currentPermission === 'default') {
            try {
              const result = await Notification.requestPermission()
              setPushPermission(result)
              if (result === 'granted') await subscribeUserToPush()
            } catch (e) {
              console.warn('[Push] Tự động yêu cầu quyền bị chặn, chờ người dùng click.')
            }
          }
        } catch (err) {
          console.warn('[Push] Error checking notifications:', err)
        }
      })
    }

    const handleSWMessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        document.dispatchEvent(new CustomEvent('realtime:notifications_updated'))
      }
    }
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.addEventListener('message', handleSWMessage)

    window.app = window.app || {}
    window.app.services = window.app.services || {}
    window.app.services.openDocDetail = (id) => setCurrentDocId(id)
    window.app.services.openReview = () => setIsReviewOpen(true)
    window.app.services.openPdfPreview = (id) => {
      const token = localStorage.getItem('auth_token')
      document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
      window.open(`/api/documents/${id}/file`, '_blank')
    }

    const handleUnauthorized = () => handleLogout()
    document.addEventListener('auth:unauthorized', handleUnauthorized)

    const handleKicked = () => signalRService.stop()
    document.addEventListener('auth:kicked', handleKicked)

    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        if (response.status === 401) {
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
          const isRoleIssue = url.includes('/api/admin/') || url.includes('/api/users')
          if (!isRoleIssue) document.dispatchEvent(new CustomEvent('auth:unauthorized'))
        }
        return response
      } catch (error) {
        console.error('Fetch error:', error)
        throw error
      }
    }

    signalRService.start()

    const handleNewTask = (e) => {
      const data = e.detail
      fetchNotifications()
      toast.info('📄 Bạn có công văn mới cần xử lý!', {
        description: data?.message || 'Lãnh đạo vừa chuyển cho bạn một công văn.',
        duration: 8000,
        action: data?.documentId
          ? {
              label: 'Xem ngay',
              onClick: () => {
                setCurrentDocId(data.documentId)
                setActiveTab('my-tasks')
              },
            }
          : undefined,
      })
    }
    document.addEventListener('realtime:new_task', handleNewTask)

    return () => {
      window.fetch = originalFetch
      document.removeEventListener('auth:unauthorized', handleUnauthorized)
      document.removeEventListener('auth:kicked', handleKicked)
      document.removeEventListener('realtime:notifications_updated', handleNotifUpdate)
      document.removeEventListener('realtime:new_task', handleNewTask)
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      signalRService.stop()
    }
  }, [])

  const handleLogout = () => {
    setIsLoggingOut(true)
    signalRService.stop()
    setTimeout(() => {
      localStorage.clear()
      window.location.href = '/'
    }, 1500)
  }

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return
    try {
      const result = await Notification.requestPermission()
      setPushPermission(result)
      if (result === 'granted') await subscribeUserToPush()
    } catch (error) {
      console.error('Lỗi khi yêu cầu quyền thông báo:', error)
    }
  }

  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext
  const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window
  if (isSecureContext && isNotificationSupported && pushPermission !== 'granted') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-md overflow-y-auto p-4 sm:p-6">
        <div className="my-auto mx-auto w-full max-w-md py-8">
          <div className="glass-card p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border-2 border-primary/20 shadow-2xl animate-in zoom-in-95 fade-in duration-500 text-center">
            <div className="size-14 md:size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 md:mb-6 ring-8 ring-primary/5">
              <Bell className="size-7 md:size-10 text-primary animate-bounce" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground mb-2 md:mb-3">
              Yêu cầu bật thông báo
            </h2>
            <p className="text-muted-foreground font-medium text-xs md:text-sm leading-relaxed mb-6 md:mb-8">
              Để đảm bảo tính tức thời trong việc điều phối công văn, hệ thống yêu cầu bạn phải chấp
              nhận nhận thông báo từ trình duyệt để tiếp tục sử dụng.
            </p>
            {pushPermission === 'default' ? (
              <Button
                className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm md:text-base shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                onClick={handleRequestPermission}
              >
                KÍCH HOẠT THÔNG BÁO NGAY
              </Button>
            ) : (
              <Button
                className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm md:text-base shadow-xl shadow-primary/20 transition-all"
                onClick={() => window.location.reload()}
              >
                TẢI LẠI TRANG NGAY
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleTabChange = (tab, filters) => {
    setActiveTab(tab)
    if (filters) setTabFilters((prev) => ({ ...prev, [tab]: { ...filters, _ts: Date.now() } }))
  }

  return (
    <>
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="size-24 rounded-full bg-white flex items-center justify-center overflow-hidden border border-white/20 shadow-xl backdrop-blur-sm">
              <img
                src="/assets/logo_campha.jpg"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-red-400 animate-spin" />
          </div>
          <p className="text-white font-black text-xl uppercase tracking-[0.3em] mb-2">
            Đang đăng xuất
          </p>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
            Hệ thống điều phối công văn
          </p>
          <div className="flex gap-2 mt-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-2 rounded-full bg-red-400"
                style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
          <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}

      <Toaster position="top-right" expand={true} richColors closeButton />
      <div className="bg-blobs fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <SidebarProvider className="app-container">
        <AppSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setCurrentDocId={setCurrentDocId}
          setIsReviewOpen={setIsReviewOpen}
        />
        <main className="main-content">
          <header className="px-6 h-[var(--header-height)] glass-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="size-10 shrink-0 text-muted-foreground hover:bg-muted" />
              <div className="header-title min-w-0">
                <h1
                  className="font-extrabold text-foreground tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(0.8rem, 3.5vw, 1.2rem)' }}
                >
                  <span className="md:hidden">Hệ Thống</span>
                  <span className="md:hidden block text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest">
                    Điều Phối Công Văn
                  </span>
                  <span className="hidden md:inline">Hệ Thống Điều Phối Công Văn</span>
                </h1>
                <p className="hidden md:block text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest leading-none mt-0.5">
                  Giám sát và đôn đốc thực thi công việc
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2">
                <NotifPopover
                  isOpen={isNotifOpen}
                  setIsOpen={setIsNotifOpen}
                  notifications={notifications}
                  notifCount={notifCount}
                  markAllRead={markAllRead}
                  markRead={markRead}
                  onOpenDoc={(id) => setCurrentDocId(id)}
                  onViewAll={() => setActiveTab('documents')}
                />
                <UserMenu
                  user={user}
                  onLogout={handleLogout}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              </div>
            </div>
          </header>

          <div
            key={isReviewOpen ? 'review' : currentDocId ? 'detail' : activeTab}
            style={{ padding: 'var(--space-page)' }}
            className={cn(
              'max-md:px-4 flex-1 flex flex-col min-h-0 min-w-0 density-compact xl:density-comfortable',
              'animate-in fade-in duration-500 fill-mode-both'
            )}
          >
            {isReviewOpen ? (
              <Review onBack={() => setIsReviewOpen(false)} />
            ) : currentDocId ? (
              <DocDetail docId={currentDocId} onBack={() => setCurrentDocId(null)} />
            ) : (
              <>
                {activeTab === 'dashboard' && <Dashboard onTabChange={handleTabChange} />}
                {activeTab === 'documents' && (
                  <Documents filters={tabFilters['documents']} onTabChange={handleTabChange} />
                )}
                {activeTab === 'upload' && <Upload />}
                {activeTab === 'users' && <Users />}
                {activeTab === 'my-tasks' && (
                  <MyTasks filters={tabFilters['my-tasks']} onTabChange={handleTabChange} />
                )}
                {activeTab === 'settings' && <SettingsPage />}
                {activeTab === 'search' && (
                  <SearchPage filters={tabFilters['search']} onTabChange={handleTabChange} />
                )}
                {activeTab === 'reports' && <MonthlyReport onTabChange={handleTabChange} />}
                {![
                  'dashboard',
                  'documents',
                  'upload',
                  'users',
                  'my-tasks',
                  'settings',
                  'search',
                  'reports',
                ].includes(activeTab) && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <LayoutDashboard className="size-16 mb-4 opacity-20" />
                    <h3 className="text-xl font-bold">Tính năng đang được phát triển</h3>
                    <p className="text-sm">Trang {activeTab} sẽ sớm được cập nhật giao diện mới.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </SidebarProvider>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around z-[500] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[
          { tab: 'dashboard', icon: <LayoutDashboard className="size-5" />, label: 'Trang chủ' },
          { tab: 'documents', icon: <FileText className="size-5" />, label: 'Văn bản' },
          { tab: 'my-tasks', icon: <CheckSquare className="size-5" />, label: 'Công việc' },
        ].map(({ tab, icon, label }) => (
          <Button
            key={tab}
            variant="ghost"
            className={cn(
              'flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent',
              activeTab === tab && 'text-primary border-primary bg-primary/5'
            )}
            onClick={() => {
              setActiveTab(tab)
              setCurrentDocId(null)
              setIsReviewOpen(false)
            }}
          >
            {icon}
            <span className="text-[10px] font-bold">{label}</span>
          </Button>
        ))}
        <Button
          variant="ghost"
          className="flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent relative"
          onClick={() => setIsNotifMobileOpen(true)}
        >
          <Bell className="size-5" />
          <Badge className="absolute top-2 right-4 size-4 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[8px] font-bold">
            {notifCount}
          </Badge>
          <span className="text-[10px] font-bold">Thông báo</span>
        </Button>
      </nav>

      <NotifMobilePanel
        isOpen={isNotifMobileOpen}
        setIsOpen={setIsNotifMobileOpen}
        notifications={notifications}
        markAllRead={markAllRead}
        markRead={markRead}
        onOpenDoc={(id) => {
          setCurrentDocId(id)
          setIsNotifMobileOpen(false)
        }}
      />
    </>
  )
}
