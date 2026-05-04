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
import { Sidebar } from './Sidebar.jsx';
import { cn } from '@/lib/utils';
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
import { Separator } from '@/components/ui/separator';

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [currentDocId, setCurrentDocId] = React.useState(null);
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [isUserOpen, setIsUserOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [user, setUser] = React.useState({ name: 'User', role: 'CanBo' });
  const [notifCount, setNotifCount] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  React.useEffect(() => {
    // Load user info from localStorage
    const name = localStorage.getItem('user_name') || 'User';
    const role = localStorage.getItem('user_role') || 'CanBo';
    setUser({ name, role });

    // Listen for notification updates
    const handleNotifUpdate = (e) => {
      if (e.detail?.count !== undefined) setNotifCount(e.detail.count);
    };
    document.addEventListener('realtime:notifications_updated', handleNotifUpdate);

    // Bridge for legacy calls
    window.app = window.app || {};
    window.app.services = window.app.services || {};
    window.app.services.openDocDetail = (id) => {
      setCurrentDocId(id);
    };
    window.app.services.openReview = () => {
      setIsReviewOpen(true);
    };

    return () => {
      document.removeEventListener('realtime:notifications_updated', handleNotifUpdate);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = () => {
    // Logic for logout here (e.g. clearing tokens)
    localStorage.clear();
    window.location.href = '/login.html';
  };

  return (
    <>
      <div className="bg-blobs fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <div
        className={cn("sidebar-overlay", isMobileOpen && "active")}
        onClick={toggleMobileSidebar}
      />

      <div className="app-container">
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className="main-content">
          <header className="px-6 py-3 border-b border-white/10 flex items-center justify-between sticky top-0 z-[100] bg-white/80 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="mobile-menu-btn md:hidden"
                onClick={toggleMobileSidebar}
              >
                <Menu className="size-5" />
              </Button>
              <div className="header-title">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Hệ Thống Điều Phối Công Văn</h1>
                <p className="text-[0.7rem] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Giám sát và đôn đốc thực thi công việc</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 max-md:hidden">
                <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-400 hover:text-[#1a3a6e] px-2">EN</Button>
                <div className="w-px h-3 bg-slate-200" />
                <Button variant="ghost" size="sm" className="text-xs font-bold text-[#1a3a6e] bg-[#1a3a6e]/5 px-2">VI</Button>
              </div>

              <div className="flex items-center gap-2">
                {/* Notifications */}
                <DropdownMenu open={isNotifOpen} onOpenChange={setIsNotifOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative size-10 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all">
                      <Bell className="size-5" />
                      <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-red-500 border-2 border-white text-[10px] font-bold">
                        {notifCount}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[380px] p-0 overflow-hidden border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-2xl">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h3 className="font-bold text-slate-800">Thông báo</h3>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-[#1a3a6e] hover:bg-[#1a3a6e]/10 font-bold">
                        Đánh dấu đã đọc
                      </Button>
                    </div>
                    <Tabs defaultValue="all" className="w-full">
                      <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-slate-100 h-10 px-4">
                        <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#1a3a6e] data-[state=active]:bg-transparent text-xs font-bold px-4">Tất cả</TabsTrigger>
                        <TabsTrigger value="unread" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#1a3a6e] data-[state=active]:bg-transparent text-xs font-bold px-4">Chưa đọc</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="flex flex-col py-2">
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-slate-400">
                              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                <Bell className="size-6 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium">Không có thông báo mới</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="unread" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="flex flex-col py-2">
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-slate-400">
                              <p className="text-sm font-medium">Tất cả thông báo đã được đọc</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                      <Button variant="link" className="text-xs font-bold text-[#1a3a6e]" onClick={() => setActiveTab('documents')}>Xem tất cả văn bản</Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User Profile */}
                <DropdownMenu open={isUserOpen} onOpenChange={setIsUserOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="group px-2 hover:bg-[#1a3a6e]/5 rounded-full h-10">
                      <Avatar className="size-8 border-2 border-white shadow-sm ring-2 ring-[#1a3a6e]/10">
                        <AvatarFallback className="bg-[#1a3a6e] text-white text-xs font-bold">
                          {user.name.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start ml-2 max-md:hidden">
                        <span className="text-xs font-bold text-slate-800 leading-tight">{user.name}</span>
                        <span className="text-[0.65rem] text-slate-400 uppercase tracking-tighter font-black">
                          {user.role === 'Admin' ? 'Quản trị' : 'Cán bộ'}
                        </span>
                      </div>
                      <ChevronDown className="size-3.5 ml-1 text-slate-400 group-data-[state=open]:rotate-180 transition-transform max-md:hidden" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-2xl">
                    <DropdownMenuLabel className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border-2 border-[#1a3a6e]/20">
                          <AvatarFallback className="bg-[#1a3a6e] text-white font-bold">
                            {user.name.substring(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{user.name}</span>
                          <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                            {user.role === 'Admin' ? 'Quản trị viên hệ thống' : 'Cán bộ xử lý'}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100" />
                    <div className="py-1">
                      <DropdownMenuItem
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:text-[#1a3a6e] hover:bg-[#1a3a6e]/5 cursor-pointer font-bold text-sm"
                        onSelect={() => setActiveTab('settings')}
                      >
                        <SettingsIcon className="size-4" />
                        <span>Cấu hình hệ thống</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:text-[#1a3a6e] hover:bg-[#1a3a6e]/5 cursor-pointer font-bold text-sm transition-colors"
                        onSelect={() => setIsPasswordModalOpen(true)}
                      >
                        <KeyRound className="size-4" />
                        <span>Đổi mật khẩu</span>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-slate-100" />
                    <DropdownMenuItem
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer font-bold text-sm"
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

          <div className="p-6 max-md:px-4 flex-1 flex flex-col min-h-0">
            {isReviewOpen ? (
              <Review onBack={() => setIsReviewOpen(false)} />
            ) : currentDocId ? (
              <DocDetail docId={currentDocId} onBack={() => setCurrentDocId(null)} />
            ) : (
              <>
                {activeTab === 'dashboard' && <Dashboard onTabChange={setActiveTab} />}
                {activeTab === 'documents' && <Documents onTabChange={setActiveTab} />}
                {activeTab === 'upload' && <Upload />}
                {activeTab === 'users' && <Users />}
                {activeTab === 'my-tasks' && <MyTasks onTabChange={setActiveTab} />}
                {activeTab === 'settings' && <SettingsPage />}
                {!['dashboard', 'documents', 'upload', 'users', 'my-tasks', 'settings'].includes(activeTab) && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <LayoutDashboard className="size-16 mb-4 opacity-20" />
                    <h3 className="text-xl font-bold">Tính năng đang được phát triển</h3>
                    <p className="text-sm">Trang {activeTab} sẽ sớm được cập nhật giao diện mới.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around z-[500] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'dashboard' && "text-[#1a3a6e] border-[#1a3a6e] bg-[#1a3a6e]/5")} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard className="size-5" />
          <span className="text-[10px] font-bold">Trang chủ</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'documents' && "text-[#1a3a6e] border-[#1a3a6e] bg-[#1a3a6e]/5")} onClick={() => setActiveTab('documents')}>
          <FileText className="size-5" />
          <span className="text-[10px] font-bold">Văn bản</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent relative")} onClick={() => setIsNotifOpen(true)}>
          <Bell className="size-5" />
          <Badge className="absolute top-2 right-4 size-4 p-0 flex items-center justify-center bg-red-500 border-2 border-white text-[8px] font-bold">{notifCount}</Badge>
          <span className="text-[10px] font-bold">Thông báo</span>
        </Button>
        <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full px-4 rounded-none border-t-2 border-transparent", activeTab === 'my-tasks' && "text-[#1a3a6e] border-[#1a3a6e] bg-[#1a3a6e]/5")} onClick={() => setActiveTab('my-tasks')}>
          <CheckSquare className="size-5" />
          <span className="text-[10px] font-bold">Công việc</span>
        </Button>
      </nav>

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader className="p-6 bg-gradient-to-r from-[#1a3a6e] to-[#132a54] text-white">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <KeyRound className="size-5" />
              </div>
              <span>Thay đổi mật khẩu</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 group">
                <Label
                  htmlFor="current-user-new-password"
                  className="text-xs font-black uppercase tracking-widest text-slate-400 group-focus-within:text-[#1a3a6e] transition-colors"
                >
                  Mật khẩu mới
                </Label>
                <div className="relative">
                  <Input
                    id="current-user-new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu mới..."
                    className="h-12 bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#1a3a6e]/20 transition-all rounded-xl pl-4 pr-10 font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:text-[#1a3a6e] hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 group">
                <Label
                  htmlFor="current-user-confirm-password"
                  className="text-xs font-black uppercase tracking-widest text-slate-400 group-focus-within:text-[#1a3a6e] transition-colors"
                >
                  Xác nhận mật khẩu
                </Label>
                <div className="relative">
                  <Input
                    id="current-user-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu..."
                    className="h-12 bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#1a3a6e]/20 transition-all rounded-xl pl-4 pr-10 font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:text-[#1a3a6e] hover:bg-transparent"
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
                className="flex-1 h-12 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-[#1a3a6e] hover:bg-[#132a54] text-white font-bold shadow-lg shadow-[#1a3a6e]/20 transition-all"
                data-action="confirm-change-password"
                onClick={async (e) => {
                  const newPass = document.getElementById('current-user-new-password').value;
                  const confirmPass = document.getElementById('current-user-confirm-password').value;
                  
                  if (newPass.length < 4) {
                    alert('Mật khẩu mới phải có ít nhất 4 ký tự!');
                    return;
                  }
                  
                  if (newPass !== confirmPass) {
                    alert('Mật khẩu xác nhận không khớp!');
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
                      alert('Đổi mật khẩu thành công!');
                      setIsPasswordModalOpen(false);
                      document.getElementById('current-user-new-password').value = '';
                      document.getElementById('current-user-confirm-password').value = '';
                    } else {
                      const err = await response.json();
                      alert(err.message || 'Có lỗi xảy ra khi đổi mật khẩu!');
                    }
                  } catch (error) {
                    alert('Không thể kết nối đến máy chủ!');
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
