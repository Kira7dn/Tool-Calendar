import React from 'react';
import {
  Menu,
  ChevronRight,
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  CheckSquare,
  Settings,
  KeyRound,
  LogOut,
  UserRound
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { tab: 'dashboard', labelKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'documents', labelKey: 'documents', label: 'Văn bản', icon: FileText },
  { tab: 'upload', labelKey: 'upload', label: 'Tải hồ sơ mới', icon: Upload },
  { tab: 'users', id: 'nav-users', labelKey: 'users', label: 'Nhân sự', icon: Users, hidden: true },
  { tab: 'my-tasks', id: 'nav-my-tasks', labelKey: 'my_tasks', label: 'Công việc của tôi', icon: CheckSquare, hidden: true },
  { tab: 'settings', labelKey: 'settings', label: 'Cấu hình', icon: Settings }
];

export function Sidebar({ 
  isCollapsed, 
  setIsCollapsed, 
  isMobileOpen, 
  setIsMobileOpen,
  activeTab,
  setActiveTab
}) {
  
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', newState.toString());
    
    // Bridge to legacy
    const sidebarEl = document.getElementById('main-sidebar');
    if (sidebarEl) {
      if (newState) sidebarEl.classList.add('collapsed');
      else sidebarEl.classList.remove('collapsed');
    }
  };

  const labelClasses = cn(
    "font-semibold whitespace-nowrap transition-all duration-400 ease-in-out overflow-hidden shrink-0",
    isCollapsed 
      ? "max-md:opacity-100 max-md:translate-x-0 opacity-0 -translate-x-4 pointer-events-none w-0 ml-0" 
      : "opacity-100 translate-x-0 w-auto ml-[-10px] max-md:ml-3"
  );

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (window.innerWidth <= 768) {
      setIsMobileOpen(false);
      document.getElementById('main-sidebar')?.classList.remove('open');
    }
  };

  return (
    <aside
      id="main-sidebar"
      className={cn(
        "relative flex flex-col shrink-0 transition-all duration-300 ease-in-out z-[200] border-r border-white/10",
        "bg-gradient-to-b from-[#1a3a6e] via-[#132a54] to-[#0d1b4b] shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
        isCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
        "max-md:fixed max-md:h-full max-md:w-[280px]",
        isMobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute top-4 -right-3.5 size-7 rounded-full bg-[#132a54] border border-white/10 text-white/60 hover:bg-[#22d3ee] hover:text-[#0d1b4b] transition-all z-[300] shadow-md group max-md:hidden"
      >
        {isCollapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <Menu className="size-4" />
        )}
      </Button>

      {/* Logo Area */}
      <div className="flex items-center h-20 border-b border-white/10 mb-3 overflow-hidden shrink-0">
        <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
          <img 
            src="/assets/logo.png" 
            alt="Logo" 
            className="size-10 rounded-lg border-[1.5px] border-white/15 shadow-lg object-contain"
          />
        </div>
        <h2 
          className={cn(
            "text-[#ffffff] font-extrabold tracking-tight leading-[1.2] transition-all duration-400 overflow-hidden whitespace-normal w-[115px] shrink-0",
            isCollapsed 
              ? "max-md:opacity-100 max-md:translate-x-0 opacity-0 -translate-x-4 pointer-events-none ml-0" 
              : "opacity-100 translate-x-0 ml-[-10px] text-[1.05rem]"
          )}
        >
          UBND phường Cẩm Phả
        </h2>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-2">
        <ul className="flex flex-col gap-1 px-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            if (item.hidden) return null;
            
            return (
              <li
                key={item.tab}
                id={item.id}
                data-tab={item.tab}
                onClick={() => handleTabClick(item.tab)}
                className={cn(
                  "group relative flex items-center h-[52px] cursor-pointer transition-all duration-200",
                  "hover:bg-white/10 text-white/70 hover:text-white",
                  isActive && "bg-white/10 text-white border-l-4 border-[#22d3ee] active"
                )}
              >
                <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
                  <Icon className={cn("size-5 transition-transform group-hover:scale-110", isActive && "text-[#22d3ee]")} />
                </div>
                <span className={cn(labelClasses, "text-[0.93rem]", isActive && "text-white")}>
                  {item.label}
                </span>
              </li>
            );
          })}
          
          <Separator className="my-2 bg-white/5 mx-4 w-auto" />
          
          <li className="group flex items-center h-[52px] cursor-pointer hover:bg-white/10 text-white/70 hover:text-white transition-all" data-action="open-change-password-modal">
            <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
              <KeyRound className="size-5" />
            </div>
            <span className={cn(labelClasses, "text-[0.93rem]")}>Đổi mật khẩu</span>
          </li>

          <li className="group flex items-center h-[52px] cursor-pointer hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all mt-auto" data-action="logout">
            <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
              <LogOut className="size-5" />
            </div>
            <span className={cn(labelClasses, "text-[0.93rem]")}>Đăng xuất</span>
          </li>
        </ul>
      </nav>

      {/* User Pill */}
      <div className="mt-auto h-16 flex flex-col justify-center bg-black/10 border-t border-white/5 overflow-hidden transition-all duration-300 shrink-0">
        <div className="flex items-center h-full">
          <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex justify-center items-center">
            <div className="size-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <UserRound className="size-5 text-white/70" />
            </div>
          </div>
          <div 
            className={cn(
              "flex flex-col transition-all duration-400 whitespace-nowrap overflow-hidden shrink-0",
              isCollapsed 
                ? "max-md:opacity-100 max-md:translate-x-0 opacity-0 translate-x-4 pointer-events-none w-0" 
                : "opacity-100 translate-x-0 w-auto"
            )}
          >
            <p className="text-[0.65rem] text-white/40 uppercase tracking-wider font-bold">Đang truy cập:</p>
            <p className="text-sm text-white font-semibold">Admin User</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
