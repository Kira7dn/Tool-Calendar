import React from 'react';
import {
  Bell,
  CheckSquare,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  X
} from 'lucide-react';
import { AppSidebar } from './Sidebar.jsx';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from '@/lib/utils';
import { registerServiceWorker, subscribeUserToPush } from '@/lib/push-notifications';
import { signalRService } from '@/lib/signalr';
import { Dashboard } from '../pages/Dashboard.jsx';
import { Documents } from '../pages/Documents.jsx';
import { Upload } from '../pages/Upload.jsx';
import { Users } from '../pages/Users.jsx';
import { DocDetail } from '../pages/DocDetail.jsx';
import { MyTasks } from '../pages/MyTasks.jsx';
import { Review } from '../pages/Review.jsx';
import { Settings as SettingsPage } from '../pages/Settings.jsx';
import { Search as SearchPage } from '../pages/Search.jsx';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toaster, toast } from 'sonner';

// ─── Helper: Relative Time ───────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

// ─── Notification Icon Avatar ────────────────────────────────────────────────
function NotifAvatar({ title, isRead }) {
  // Pick icon/color based on keyword in title
  const isOverdue = /quá hạn/i.test(title);
  const isNew = /mới|tiếp nhận|tải lên/i.test(title);
  const isAssign = /phân công|giao/i.test(title);
  const isComplete = /hoàn thành|xử lý xong/i.test(title);

  let bg = 'bg-info/15';
  let icon = '📄';
  if (isOverdue) { bg = 'bg-destructive/15'; icon = '⚠️'; }
  else if (isNew) { bg = 'bg-success/15'; icon = '📥'; }
  else if (isAssign) { bg = 'bg-warning/15'; icon = '📋'; }
  else if (isComplete) { bg = 'bg-success/15'; icon = '✅'; }

  return (
    <div className={`relative shrink-0 size-12 rounded-full ${bg} flex items-center justify-center text-xl`}>
      {icon}
      {!isRead && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-primary border-2 border-background" />
      )}
    </div>
  );
}

// ─── Notification List (Facebook-style) ─────────────────────────────────────
function NotificationList({ notifications, onClickItem }) {
  // Group into "Mới" (< 24h) and "Trước đó"
  const now = new Date();
  const newNotifs = notifications.filter(n => (now - new Date(n.createdAt)) < 86400000);
  const oldNotifs = notifications.filter(n => (now - new Date(n.createdAt)) >= 86400000);

  const renderItem = (n) => (
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
        <p className={cn(
          'text-[13px] leading-snug line-clamp-2 mb-0.5',
          n.isRead ? 'text-muted-foreground font-medium' : 'text-foreground font-bold'
        )}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-[12px] text-muted-foreground line-clamp-2 leading-snug mb-1">
            {n.body}
          </p>
        )}
        <p className={cn(
          'text-[11px] font-bold',
          n.isRead ? 'text-muted-foreground/60' : 'text-primary'
        )}>
          {formatRelativeTime(n.createdAt)}
        </p>
      </div>

      {/* Unread blue dot (right side) */}
      {!n.isRead && (
        <div className="shrink-0 size-2.5 rounded-full bg-primary mt-2" />
      )}
    </button>
  );

  return (
    <div className="py-2 px-1">
      {newNotifs.length > 0 && (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-4 py-1.5">Mới</p>
          {newNotifs.map(renderItem)}
        </>
      )}
      {oldNotifs.length > 0 && (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-4 py-1.5 mt-1">Trước đó</p>
          {oldNotifs.map(renderItem)}
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const [activeTab, setActiveTab] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  });
  const [tabFilters, setTabFilters] = React.useState({});
  const [currentDocId, setCurrentDocId] = React.useState(null);
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [isNotifMobileOpen, setIsNotifMobileOpen] = React.useState(false);
  const [pushPermission, setPushPermission] = React.useState('default');
  const [isUserOpen, setIsUserOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [user, setUser] = React.useState(() => {
    return {
      name: localStorage.getItem('user_full_name') || localStorage.getItem('user_name') || 'Cán bộ',
      role: localStorage.getItem('user_role') || 'CanBo'
    };
  });
  const [notifCount, setNotifCount] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notification', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        const unreadCount = data.filter(n => !n.isRead).length;
        setNotifCount(unreadCount);

        // Show toast for latest unread if it's new
        if (data.length > 0 && !data[0].isRead) {
          const lastSeenId = localStorage.getItem('last_notif_id');
          if (lastSeenId !== data[0].id.toString()) {
            toast.info(data[0].title, {
              description: data[0].body,
              action: {
                label: 'Xem',
                onClick: () => {
                  if (data[0].docId) setCurrentDocId(data[0].docId);
                  markRead(data[0].id);
                }
              }
            });
            localStorage.setItem('last_notif_id', data[0].id.toString());
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  const markRead = async (id) => {
    try {
      await fetch(`/api/notification/mark-read/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      fetchNotifications();
    } catch (e) { }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notification/mark-all-read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      fetchNotifications();
    } catch (e) { }
  };
  React.useEffect(() => {
    // Auth Guard: Redirect if not authenticated (main.jsx handles this usually)
    if (!localStorage.getItem('auth_token')) {
      window.location.href = '/';
      return;
    }

    // Load user info from localStorage
    const name = localStorage.getItem('user_name') || 'User';
    const role = localStorage.getItem('user_role') || 'CanBo';
    setUser({ name, role });

    // Listen for notification updates
    const handleNotifUpdate = (e) => {
      fetchNotifications();
    };
    document.addEventListener('realtime:notifications_updated', handleNotifUpdate);
    fetchNotifications();

    // Register Service Worker and listen for push messages
    registerServiceWorker().then(async (registration) => {
      if (registration) {
        registration.update();
      }
      const currentPermission = Notification.permission;
      setPushPermission(currentPermission);

      if (currentPermission === 'granted') {
        // Luôn tự động đăng ký lại khi đã có quyền (Chế độ bắt buộc)
        await subscribeUserToPush();
      } else if (currentPermission === 'default') {
        // Thử gọi tự động (có thể bị trình duyệt chặn nếu không có user gesture)
        try {
          const result = await Notification.requestPermission();
          setPushPermission(result);
          if (result === 'granted') await subscribeUserToPush();
        } catch (e) {
          console.warn('[Push] Tự động yêu cầu quyền bị chặn, chờ người dùng click.');
        }
      }
    });
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        // Trigger notification count refresh or show local toast
        document.dispatchEvent(new CustomEvent('realtime:notifications_updated'));
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // Bridge for legacy calls
    window.app = window.app || {};
    window.app.services = window.app.services || {};
    window.app.services.openDocDetail = (id) => {
      setCurrentDocId(id);
    };
    window.app.services.openReview = () => {
      setIsReviewOpen(true);
    };
    window.app.services.openPdfPreview = (id) => {
      const token = localStorage.getItem('auth_token');
      window.open(`/api/documents/${id}/file?access_token=${token}`, '_blank');
    };

    // Listen for unauthorized event
    const handleUnauthorized = () => handleLogout();
    document.addEventListener('auth:unauthorized', handleUnauthorized);

    // 🔴 Listen for kicked event (ai đó login cùng tài khoản)
    const handleKicked = () => {
      signalRService.stop(); // Ngắt kết nối SignalR ngay lập tức
      // main.jsx sẽ xử lý UI - AppShell chỉ cần cleanup
    };
    document.addEventListener('auth:kicked', handleKicked);

    // Global 401 Interceptor
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
          // Ignore 401s from specific endpoints that might be 403s in disguise due to .NET Core default challenge
          const isRoleIssue = url.includes('/api/admin/') || url.includes('/api/users');

          if (!isRoleIssue) {
            document.dispatchEvent(new CustomEvent('auth:unauthorized'));
          } else {
            console.warn(`[Auth] Ignored 401 from ${url} (Likely a role/permission issue)`);
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
    };

    // SignalR Connection
    signalRService.start();

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener('auth:unauthorized', handleUnauthorized);
      document.removeEventListener('auth:kicked', handleKicked);
      document.removeEventListener('realtime:notifications_updated', handleNotifUpdate);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      signalRService.stop();
    };
  }, []);

  const handleLogout = () => {
    setIsLoggingOut(true);
    signalRService.stop();
    // Chờ animation chạy xong mới redirect
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '/';
    }, 1500);
  };

  const handleRequestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);
      if (result === 'granted') {
        await subscribeUserToPush();
      }
    } catch (error) {
      console.error('Lỗi khi yêu cầu quyền thông báo:', error);
    }
  };

  // Notification Guard: Block access if permission is not granted
  if (pushPermission !== 'granted') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-md overflow-y-auto p-4 sm:p-6">
        <div className="my-auto mx-auto w-full max-w-md py-8">
          <div className="glass-card p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border-2 border-primary/20 shadow-2xl animate-in zoom-in-95 fade-in duration-500 text-center">
            <div className="size-14 md:size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 md:mb-6 ring-8 ring-primary/5">
              <Bell className="size-7 md:size-10 text-primary animate-bounce" />
            </div>

            <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground mb-2 md:mb-3">Yêu cầu bật thông báo</h2>
            <p className="text-muted-foreground font-medium text-xs md:text-sm leading-relaxed mb-6 md:mb-8">
              Để đảm bảo tính tức thời trong việc điều phối công văn, hệ thống yêu cầu bạn phải chấp nhận nhận thông báo từ trình duyệt để tiếp tục sử dụng.
            </p>

            {pushPermission === 'default' ? (
              <Button
                className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm md:text-base shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                onClick={handleRequestPermission}
              >
                KÍCH HOẠT THÔNG BÁO NGAY
              </Button>
            ) : (
              <div className="space-y-4 md:space-y-6">
                <div className="p-4 md:p-5 rounded-xl md:rounded-[2rem] bg-destructive/5 border border-destructive/20 text-destructive text-xs md:text-sm font-medium leading-relaxed text-left flex gap-3 md:gap-4">
                  <div className="size-8 md:size-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <EyeOff className="size-4 md:size-5" />
                  </div>
                  <div>
                    <p className="font-black mb-0.5 md:mb-1">BẠN ĐÃ CHẶN THÔNG BÁO</p>
                    <p className="opacity-80">Trình duyệt đã ghi nhớ lựa chọn chặn. Bạn cần mở thủ công theo các bước sau:</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:gap-3 text-left">
                  <div className="flex items-center gap-2 md:gap-3 p-3 rounded-xl md:rounded-2xl bg-muted/50 border border-border/50 text-[10px] md:text-xs font-bold">
                    <div className="size-5 md:size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px]">1</div>
                    <p>Nhấn vào biểu tượng <span className="px-1.5 py-0.5 bg-muted rounded border border-border shadow-sm">🔒 Khóa</span> ở thanh địa chỉ.</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 p-3 rounded-xl md:rounded-2xl bg-muted/50 border border-border/50 text-[10px] md:text-xs font-bold">
                    <div className="size-5 md:size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px]">2</div>
                    <p>Tìm mục <span className="text-primary underline underline-offset-4">Thông báo</span> và chuyển sang <span className="text-success">Cho phép</span>.</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 p-3 rounded-xl md:rounded-2xl bg-muted/50 border border-border/50 text-[10px] md:text-xs font-bold">
                    <div className="size-5 md:size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px]">3</div>
                    <p>Nhấn nút bên dưới để tải lại trang.</p>
                  </div>
                </div>

                <Button
                  className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm md:text-base shadow-xl shadow-primary/20 transition-all"
                  onClick={() => window.location.reload()}
                >
                  TẢI LẠI TRANG NGAY
                </Button>
              </div>
            )}

            <p className="mt-8 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">
              Hệ thống điều phối công văn trực tuyến
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Logout Animation Overlay ─────────────────────────── */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 animate-in fade-in duration-300">
          {/* Logo ring */}
          <div className="relative mb-8">
            <div className="size-24 rounded-3xl bg-white/10 border-2 border-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg viewBox="0 0 100 100" className="w-12 h-12">
                <polygon points="50,10 61,35 88,35 66,53 74,78 50,62 26,78 34,53 12,35 39,35" fill="#f5c518" />
              </svg>
            </div>
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-red-400 animate-spin" />
          </div>

          {/* Text */}
          <p className="text-white font-black text-xl uppercase tracking-[0.3em] mb-2">Đang đăng xuất</p>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Hệ thống điều phối công văn</p>

          {/* Dots loading */}
          <div className="flex gap-2 mt-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-2 rounded-full bg-red-400"
                style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
          <style>{`
            @keyframes bounce {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
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
                <h1 className="font-extrabold text-foreground tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(0.8rem, 3.5vw, 1.2rem)' }}
                >
                  <span className="md:hidden">Hệ Thống</span>
                  <span className="md:hidden block text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest">Điều Phối Công Văn</span>
                  <span className="hidden md:inline">Hệ Thống Điều Phối Công Văn</span>
                </h1>
                <p className="hidden md:block text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest leading-none mt-0.5">Giám sát và đôn đốc thực thi công việc</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2">
                {/* Notifications - hidden visually on mobile but kept for popover anchor */}
                <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-all flex size-0 p-0 overflow-hidden border-none md:size-10 md:p-2">
                      <Bell className="size-5" />
                      {notifCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[10px] font-bold">
                          {notifCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={8} className="w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-card">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                      <h3 className="text-xl font-black text-foreground">Thông báo</h3>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/10 font-bold rounded-lg" onClick={markAllRead}>
                        Đánh dấu tất cả đã đọc
                      </Button>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="all" className="w-full">
                      <div className="px-5">
                        <TabsList className="h-9 bg-muted/60 rounded-xl p-1 w-full grid grid-cols-2">
                          <TabsTrigger value="all" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            Tất cả
                          </TabsTrigger>
                          <TabsTrigger value="unread" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            Chưa đọc {notifications.filter(n => !n.isRead).length > 0 && (
                              <span className="ml-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-black rounded-full">
                                {notifications.filter(n => !n.isRead).length}
                              </span>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* All notifications */}
                      <TabsContent value="all" className="m-0 mt-1">
                        <ScrollArea className="h-[420px]">
                          {notifications.length > 0 ? (
                            <NotificationList
                              notifications={notifications}
                              onClickItem={(n) => {
                                if (n.docId) setCurrentDocId(n.docId);
                                if (!n.isRead) markRead(n.id);
                                setIsNotifOpen(false);
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                              <div className="size-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                                <Bell className="size-7 text-muted-foreground/30" />
                              </div>
                              <p className="text-sm font-bold">Không có thông báo nào</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">Mọi hoạt động trong hệ thống sẽ hiển thị ở đây</p>
                            </div>
                          )}
                        </ScrollArea>
                      </TabsContent>

                      {/* Unread notifications */}
                      <TabsContent value="unread" className="m-0 mt-1">
                        <ScrollArea className="h-[420px]">
                          {notifications.filter(n => !n.isRead).length > 0 ? (
                            <NotificationList
                              notifications={notifications.filter(n => !n.isRead)}
                              onClickItem={(n) => {
                                if (n.docId) setCurrentDocId(n.docId);
                                markRead(n.id);
                                setIsNotifOpen(false);
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

                    {/* Footer */}
                    <div className="border-t border-border/50 bg-muted/20 text-center flex justify-center py-1">
                      <Button variant="link" className="text-xs font-bold text-primary w-full" onClick={() => { setActiveTab('documents'); setIsNotifOpen(false); }}>Xem tất cả văn bản</Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* User Profile */}
                <DropdownMenu open={isUserOpen} onOpenChange={setIsUserOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="group px-2 hover:bg-primary/5 rounded-full h-10">
                      <Avatar className="size-8 border-2 border-background shadow-sm ring-2 ring-primary/10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {user.name.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start ml-2 max-md:hidden">
                        <span className="text-xs font-bold text-foreground leading-tight">{user.name}</span>
                        <span className="text-[0.65rem] text-muted-foreground uppercase tracking-tighter font-black">
                          {user.role === 'Admin' ? 'Quản trị' : 'Cán bộ'}
                        </span>
                      </div>
                      <ChevronDown className="size-3.5 ml-1 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform max-md:hidden" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 border-none shadow-2xl glass-card rounded-2xl">
                    <DropdownMenuLabel className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border-2 border-primary/20">
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                            {user.name.substring(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{user.name}</span>
                          <span className="text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest leading-none mt-1">
                            {user.role === 'Admin' ? 'Quản trị viên hệ thống' : 'Cán bộ xử lý'}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    <div className="py-1">
                      <DropdownMenuItem
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer font-bold text-sm"
                        onSelect={() => setActiveTab('settings')}
                      >
                        <SettingsIcon className="size-4" />
                        <span>Cấu hình hệ thống</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer font-bold text-sm transition-colors"
                        onSelect={() => setIsPasswordModalOpen(true)}
                      >
                        <KeyRound className="size-4" />
                        <span>Đổi mật khẩu</span>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-destructive hover:text-destructive/90 hover:bg-destructive/10 cursor-pointer font-bold text-sm"
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4" />
                      <span>Đăng xuất</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div
            key={isReviewOpen ? 'review' : currentDocId ? 'detail' : activeTab}
            style={{ padding: 'var(--space-page)' }}
            className={cn(
              "max-md:px-4 flex-1 flex flex-col min-h-0 density-compact xl:density-comfortable",
              "animate-in fade-in duration-500 fill-mode-both"
            )}
          >
            {isReviewOpen ? (
              <Review onBack={() => setIsReviewOpen(false)} />
            ) : currentDocId ? (
              <DocDetail docId={currentDocId} onBack={() => setCurrentDocId(null)} />
            ) : (
              <>
                {activeTab === 'dashboard' && <Dashboard onTabChange={(tab, filters) => { setActiveTab(tab); if (filters) setTabFilters(prev => ({ ...prev, [tab]: filters })); }} />}
                {activeTab === 'documents' && <Documents filters={tabFilters['documents']} onTabChange={(tab, filters) => { setActiveTab(tab); if (filters) setTabFilters(prev => ({ ...prev, [tab]: filters })); }} />}
                {activeTab === 'upload' && <Upload />}
                {activeTab === 'users' && <Users />}
                {activeTab === 'my-tasks' && <MyTasks filters={tabFilters['my-tasks']} onTabChange={(tab, filters) => { setActiveTab(tab); if (filters) setTabFilters(prev => ({ ...prev, [tab]: filters })); }} />}
                {activeTab === 'settings' && <SettingsPage />}
                {activeTab === 'search' && <SearchPage />}
                {!['dashboard', 'documents', 'upload', 'users', 'my-tasks', 'settings', 'search'].includes(activeTab) && (
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
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'dashboard' && "text-primary border-primary bg-primary/5")} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard className="size-5" />
          <span className="text-[10px] font-bold">Trang chủ</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'documents' && "text-primary border-primary bg-primary/5")} onClick={() => setActiveTab('documents')}>
          <FileText className="size-5" />
          <span className="text-[10px] font-bold">Văn bản</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent relative")} onClick={() => setIsNotifMobileOpen(true)}>
          <Bell className="size-5" />
          <Badge className="absolute top-2 right-4 size-4 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[8px] font-bold">{notifCount}</Badge>
          <span className="text-[10px] font-bold">Thông báo</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'my-tasks' && "text-primary border-primary bg-primary/5")} onClick={() => setActiveTab('my-tasks')}>
          <CheckSquare className="size-5" />
          <span className="text-[10px] font-bold">Công việc</span>
        </Button>
      </nav>

      {/* Mobile Full-Screen Notification Panel (Facebook style) */}
      {isNotifMobileOpen && (
        <div className="fixed inset-0 z-[600] bg-background flex flex-col animate-in slide-in-from-bottom-4 duration-300 md:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background">
            <h2 className="text-xl font-black text-foreground">Thông báo</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/10 font-bold rounded-lg" onClick={markAllRead}>
                Đánh dấu đã đọc
              </Button>
              <Button variant="ghost" size="icon" className="size-9 rounded-full hover:bg-muted" onClick={() => setIsNotifMobileOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 pt-3 shrink-0">
              <TabsList className="h-10 bg-muted/60 rounded-xl p-1 w-full grid grid-cols-2">
                <TabsTrigger value="all" className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Tất cả
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Chưa đọc {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="ml-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-black rounded-full">
                      {notifications.filter(n => !n.isRead).length}
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
                    if (n.docId) setCurrentDocId(n.docId);
                    if (!n.isRead) markRead(n.id);
                    setIsNotifMobileOpen(false);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                  <div className="size-20 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                    <Bell className="size-9 text-muted-foreground/30" />
                  </div>
                  <p className="text-base font-bold">Không có thông báo nào</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Mọi hoạt động sẽ hiển thị ở đây</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="unread" className="flex-1 overflow-y-auto m-0 mt-2 pb-20">
              {notifications.filter(n => !n.isRead).length > 0 ? (
                <NotificationList
                  notifications={notifications.filter(n => !n.isRead)}
                  onClickItem={(n) => {
                    if (n.docId) setCurrentDocId(n.docId);
                    markRead(n.id);
                    setIsNotifMobileOpen(false);
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
      )}

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl glass-card rounded-2xl flex flex-col max-h-[95vh]">
          <DialogHeader className="p-5 md:p-6 bg-gradient-to-r from-red-600 to-red-700 relative shrink-0">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
              <div className="p-2 rounded-lg bg-white/10 backdrop-blur-md">
                <KeyRound className="size-5 text-white" />
              </div>
              <span className="drop-shadow-sm">Thay đổi mật khẩu</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 md:p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="space-y-2 group">
                <Label
                  htmlFor="current-user-new-password"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-primary transition-colors"
                >
                  Mật khẩu mới
                </Label>
                <div className="relative">
                  <Input
                    id="current-user-new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu mới..."
                    className="h-12 bg-muted/30 focus:bg-background transition-all pl-4 pr-10 font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 group">
                <Label
                  htmlFor="current-user-confirm-password"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-primary transition-colors"
                >
                  Xác nhận mật khẩu
                </Label>
                <div className="relative">
                  <Input
                    id="current-user-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu..."
                    className="h-12 bg-muted/30 focus:bg-background transition-all pl-4 pr-10 font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl border-border text-muted-foreground font-bold hover:bg-muted/50 transition-all"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-lg shadow-red-100 transition-all"
                data-action="confirm-change-password"
                onClick={async (e) => {
                  const newPass = document.getElementById('current-user-new-password').value;
                  const confirmPass = document.getElementById('current-user-confirm-password').value;

                  if (newPass.length < 4) {
                    toast.error('Mật khẩu mới phải có ít nhất 4 ký tự!');
                    return;
                  }

                  if (newPass !== confirmPass) {
                    toast.error('Mật khẩu xác nhận không khớp!');
                    return;
                  }

                  try {
                    const response = await fetch('/api/auth/change-password', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ newPassword: newPass })
                    });

                    if (response.ok) {
                      toast.success('Đổi mật khẩu thành công!');
                      setIsPasswordModalOpen(false);
                      document.getElementById('current-user-new-password').value = '';
                      document.getElementById('current-user-confirm-password').value = '';
                    } else {
                      const err = await response.json();
                      toast.error(err.message || 'Có lỗi xảy ra khi đổi mật khẩu!');
                    }
                  } catch (error) {
                    toast.error('Không thể kết nối đến máy chủ!');
                  }
                }}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
