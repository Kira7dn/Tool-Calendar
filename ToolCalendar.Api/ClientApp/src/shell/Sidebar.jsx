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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { tab: 'dashboard', labelKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'documents', labelKey: 'documents', label: 'Văn bản', icon: FileText },
  { tab: 'upload', labelKey: 'upload', label: 'Tải hồ sơ mới', icon: Upload },
  { tab: 'users', id: 'nav-users', labelKey: 'users', label: 'Nhân sự', icon: Users },
  { tab: 'my-tasks', id: 'nav-my-tasks', labelKey: 'my_tasks', label: 'Công việc của tôi', icon: CheckSquare },
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
        "relative flex flex-col shrink-0 transition-all duration-300 ease-in-out z-[200] border-r border-sidebar-border",
        "bg-sidebar-gradient shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
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
        className="absolute top-4 -right-3.5 size-7 rounded-full bg-sidebar-mid border border-sidebar-border text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-all z-[300] shadow-md group max-md:hidden"
      >
        {isCollapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <Menu className="size-4" />
        )}
      </Button>

      {/* Logo Area */}
      <div className="flex items-center h-20 border-b border-sidebar-border mb-3 overflow-hidden shrink-0">
        <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
          <img
            src="/assets/logo.png"
            alt="Logo"
            className="size-10 rounded-lg border-[1.5px] border-sidebar-border shadow-lg object-contain"
          />
        </div>
        <h2
          className={cn(
            "text-sidebar-primary font-extrabold tracking-tight leading-[1.2] transition-all duration-400 overflow-hidden whitespace-normal w-[115px] shrink-0",
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

            // Role-based filtering
            const role = localStorage.getItem('user_role') || 'CanBo';
            if (item.tab === 'users' && role !== 'Admin') return null;
            if (item.tab === 'my-tasks' && role !== 'CanBo' && role !== 'VanThu') return null;
            if (item.tab === 'upload' && role !== 'Admin' && role !== 'VanThu') return null;

            if (item.hidden) return null;

            return (
              <li key={item.tab} id={item.id}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => handleTabClick(item.tab)}
                      className={cn(
                        "group relative flex items-center h-[52px] cursor-pointer transition-all duration-200",
                        "hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-primary",
                        isActive && "bg-sidebar-accent text-sidebar-primary border-l-4 border-sidebar-ring active"
                      )}
                    >
                      <div className="w-[var(--sidebar-icon-zone)] shrink-0 flex items-center justify-center">
                        <Icon className={cn("size-5 transition-transform group-hover:scale-110", isActive && "text-sidebar-ring")} />
                      </div>
                      <span className={cn(labelClasses, "text-[0.93rem]", isActive && "text-sidebar-primary")}>
                        {item.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" className="bg-sidebar-mid border-sidebar-border text-sidebar-primary font-bold">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              </li>
            );
          })}

        </ul>
      </nav>
    </aside>
  );
}
