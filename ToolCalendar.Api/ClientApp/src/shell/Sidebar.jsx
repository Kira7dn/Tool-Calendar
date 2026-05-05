import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  CheckSquare,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar";

const navItems = [
  { tab: 'dashboard', labelKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'documents', labelKey: 'documents', label: 'Văn bản', icon: FileText },
  { tab: 'upload', labelKey: 'upload', label: 'Tải hồ sơ mới', icon: Upload },
  { tab: 'users', id: 'nav-users', labelKey: 'users', label: 'Nhân sự', icon: Users },
  { tab: 'my-tasks', id: 'nav-my-tasks', labelKey: 'my_tasks', label: 'Công việc của tôi', icon: CheckSquare },
  { tab: 'settings', labelKey: 'settings', label: 'Cấu hình', icon: Settings }
];

export function AppSidebar({
  activeTab,
  setActiveTab
}) {
  const { setOpenMobile } = useSidebar();

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="bg-sidebar">
      <SidebarHeader className="h-[var(--header-height)] border-b border-white/15 flex-row items-center px-0 py-0 bg-sidebar-gradient text-sidebar-primary-foreground">
        <div className="flex gap-2 h-full w-full items-center overflow-hidden">
          <div className="flex w-12 shrink-0 items-center justify-center">
            <img
              src="/assets/logo.png"
              alt="Logo"
              className="size-9 rounded-lg border-[1.5px] border-white/25 shadow-lg object-contain bg-white"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center text-white font-extrabold tracking-tight leading-[1.1] whitespace-nowrap group-data-[collapsible=icon]:hidden">
            <span className='text-md'>UBND phường</span>
            <span className='text-base'>Cẩm Phả</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
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
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      onClick={() => handleTabClick(item.tab)}
                      className={cn(
                        "h-12 rounded-lg transition-all duration-200",
                        isActive
                          ? "relative overflow-hidden bg-transparent text-primary border-l-4 border-primary font-bold shadow-sm before:absolute before:inset-0 before:bg-primary before:opacity-10 before:content-[''] hover:text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary font-semibold"
                      )}
                    >
                      <Icon className={cn("relative z-10 size-5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground")} />
                      <span className={cn("relative z-10 text-[0.93rem] ml-2", isActive && "font-bold")}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
