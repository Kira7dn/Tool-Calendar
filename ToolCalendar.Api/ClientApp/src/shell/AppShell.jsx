import React from 'react';
import {
  ArrowLeft,
  Bell,
  CheckSquare,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  UserRound,
  Users as UsersIcon,
  Upload as UploadIcon,
  ChevronDown,
  ChevronRight
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

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from '@/components/ui/separator';
import { Toaster, toast } from 'sonner';

export function AppShell() {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [tabFilters, setTabFilters] = React.useState({});
  const [currentDocId, setCurrentDocId] = React.useState(null);
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [pushPermission, setPushPermission] = React.useState('default');
  const [isUserOpen, setIsUserOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [user, setUser] = React.useState({ name: 'User', role: 'CanBo' });
  const [notifCount, setNotifCount] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);

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
      window.open(`/api/documents/${id}/file`, '_blank');
    };

    // Listen for unauthorized event
    const handleUnauthorized = () => handleLogout();
    document.addEventListener('auth:unauthorized', handleUnauthorized);

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
      document.removeEventListener('realtime:notifications_updated', handleNotifUpdate);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      signalRService.stop();
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
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
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 overflow-hidden">
        <div className="max-w-md w-full glass-card p-10 rounded-[2.5rem] border-2 border-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)] animate-in zoom-in-95 fade-in duration-500 text-center">
          <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 ring-8 ring-primary/5">
            <Bell className="size-10 text-primary animate-bounce" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-foreground mb-3">Yêu cầu bật thông báo</h2>
          <p className="text-muted-foreground font-medium text-sm leading-relaxed mb-8">
            Để đảm bảo tính tức thời trong việc điều phối công văn, hệ thống yêu cầu bạn phải chấp nhận nhận thông báo từ trình duyệt để tiếp tục sử dụng.
          </p>

          {pushPermission === 'default' ? (
            <Button
              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
              onClick={handleRequestPermission}
            >
              KÍCH HOẠT THÔNG BÁO NGAY
            </Button>
          ) : (
            <div className="space-y-6">
              <div className="p-5 rounded-[2rem] bg-destructive/5 border border-destructive/20 text-destructive text-sm font-medium leading-relaxed text-left flex gap-4">
                <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <EyeOff className="size-5" />
                </div>
                <div>
                  <p className="font-black mb-1">BẠN ĐÃ CHẶN THÔNG BÁO</p>
                  <p className="opacity-80">Trình duyệt đã ghi nhớ lựa chọn chặn và không cho phép hệ thống yêu cầu lại. Bạn cần mở thủ công theo các bước sau:</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-left">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 text-xs font-bold">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">1</div>
                  <p>Nhấn vào biểu tượng <span className="px-1.5 py-0.5 bg-muted rounded border border-border shadow-sm">🔒 Khóa</span> hoặc <span className="px-1.5 py-0.5 bg-muted rounded border border-border shadow-sm">⚙️ Cài đặt</span> ở góc trái thanh địa chỉ trình duyệt.</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 text-xs font-bold">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">2</div>
                  <p>Tìm mục <span className="text-primary underline underline-offset-4">Thông báo (Notifications)</span> và chuyển trạng thái sang <span className="text-success">Cho phép (Allow)</span>.</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 text-xs font-bold">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">3</div>
                  <p>Nhấn nút bên dưới để bắt đầu làm việc.</p>
                </div>
              </div>

              <Button
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base shadow-xl shadow-primary/20 transition-all"
                onClick={() => window.location.reload()}
              >
                TẢI LẠI TRANG NGAY
              </Button>
            </div>
          )}

          <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">
            Hệ thống điều phối công văn trực tuyến
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
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
            <div className="flex items-center gap-4">
              <SidebarTrigger className="size-10 shrink-0 text-muted-foreground hover:bg-muted" />
              <div className="header-title">
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">Hệ Thống Điều Phối Công Văn</h1>
                <p className="text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest leading-none mt-0.5">Giám sát và đôn đốc thực thi công việc</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {/* Notifications */}
                <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative size-10 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-all">
                      <Bell className="size-5" />
                      <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[10px] font-bold">
                        {notifCount}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden border-none shadow-2xl glass-card rounded-2xl">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-bold text-foreground">Thông báo</h3>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/10 font-bold" onClick={markAllRead}>
                        Đánh dấu đã đọc
                      </Button>
                    </div>
                    <Tabs defaultValue="all" className="w-full">
                      <div className="px-4 pt-3">
                        <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                          <TabsTrigger value="all" className="text-xs font-bold">Tất cả ({notifications.length})</TabsTrigger>
                          <TabsTrigger value="unread" className="text-xs font-bold">Chưa đọc ({notifications.filter(n => !n.isRead).length})</TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="all" className="m-0 mt-2">
                        <ScrollArea className="h-[350px]">
                          <div className="flex flex-col">
                            {notifications.length > 0 ? (
                              notifications.map((n) => (
                                <div
                                  key={n.id}
                                  className={cn(
                                    "p-4 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors relative group",
                                    !n.isRead && "bg-primary/5"
                                  )}
                                  onClick={() => {
                                    if (n.docId) setCurrentDocId(n.docId);
                                    if (!n.isRead) markRead(n.id);
                                    setIsNotifOpen(false);
                                  }}
                                >
                                  {!n.isRead && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />}
                                  <div className="flex flex-col gap-1">
                                    <p className={cn("text-xs leading-tight", n.isRead ? "font-medium text-muted-foreground" : "font-black text-foreground")}>{n.title}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                                    <p className="text-[9px] text-muted-foreground/60 font-bold uppercase mt-1">
                                      {new Date(n.createdAt).toLocaleString('vi-VN')}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
                                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                  <Bell className="size-6 text-muted-foreground/30" />
                                </div>
                                <p className="text-sm font-medium">Không có thông báo mới</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="unread" className="m-0 mt-2">
                        <ScrollArea className="h-[350px]">
                          <div className="flex flex-col">
                            {notifications.filter(n => !n.isRead).length > 0 ? (
                              notifications.filter(n => !n.isRead).map((n) => (
                                <div
                                  key={n.id}
                                  className="p-4 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors relative bg-primary/5"
                                  onClick={() => {
                                    if (n.docId) setCurrentDocId(n.docId);
                                    markRead(n.id);
                                    setIsNotifOpen(false);
                                  }}
                                >
                                  <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                                  <div className="flex flex-col gap-1">
                                    <p className="text-xs leading-tight font-black text-foreground">{n.title}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                                    <p className="text-[9px] text-muted-foreground/60 font-bold uppercase mt-1">
                                      {new Date(n.createdAt).toLocaleString('vi-VN')}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
                                <p className="text-sm font-medium">Tất cả thông báo đã được đọc</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                    <div className="p-0 bg-muted/30 border-t border-border text-center">
                      <Button variant="link" className="text-xs font-bold text-primary" onClick={() => { setActiveTab('documents'); setIsNotifOpen(false); }}>Xem tất cả văn bản</Button>
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
            className={cn(
              "p-[var(--space-page)] max-md:px-4 flex-1 flex flex-col min-h-0 density-comfortable",
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
                {!['dashboard', 'documents', 'upload', 'users', 'my-tasks', 'settings'].includes(activeTab) && (
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
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent relative")} onClick={() => setIsNotifOpen(true)}>
          <Bell className="size-5" />
          <Badge className="absolute top-2 right-4 size-4 p-0 flex items-center justify-center bg-destructive border-2 border-background text-[8px] font-bold">{notifCount}</Badge>
          <span className="text-[10px] font-bold">Thông báo</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'my-tasks' && "text-primary border-primary bg-primary/5")} onClick={() => setActiveTab('my-tasks')}>
          <CheckSquare className="size-5" />
          <span className="text-[10px] font-bold">Công việc</span>
        </Button>
      </nav>

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl glass-card rounded-2xl">
          <DialogHeader className="p-6 bg-gradient-to-r from-red-600 to-red-700 relative">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
              <div className="p-2 rounded-lg bg-white/10 backdrop-blur-md">
                <KeyRound className="size-5 text-white" />
              </div>
              <span className="drop-shadow-sm">Thay đổi mật khẩu</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
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
