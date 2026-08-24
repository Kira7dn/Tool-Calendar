import { ROLES } from '../constants/roles'
/* eslint-disable */
import React from 'react'
import {
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  CheckSquare,
  Settings,
  Search,
  BarChart3,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar'

const navItems = [
  { tab: 'dashboard', labelKey: 'dashboard', label: 'Trang chủ', icon: LayoutDashboard },
  { tab: 'documents', labelKey: 'documents', label: 'Văn bản', icon: FileText },
  { tab: 'search', labelKey: 'search', label: 'Tìm kiếm', icon: Search },
  { tab: 'reports', labelKey: 'reports', label: 'Báo cáo thống kê', icon: BarChart3 },
  { tab: 'upload', labelKey: 'upload', label: 'Tải văn bản mới', icon: Upload },
  { tab: 'users', id: 'nav-users', labelKey: 'users', label: 'Nhân sự', icon: Users },
  {
    tab: 'my-tasks',
    id: 'nav-my-tasks',
    labelKey: 'my_tasks',
    label: 'Công việc của tôi',
    icon: CheckSquare,
  },
  { tab: 'settings', labelKey: 'settings', label: 'Cấu hình', icon: Settings },
  {
    isLink: true,
    url: '/campha',
    label: 'Văn bản đến hạn',
    icon: CalendarDays,
  },
]

export function AppSidebar({ activeTab, setActiveTab, setCurrentDocId, setIsReviewOpen }) {
  const { setOpenMobile } = useSidebar()

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    if (setCurrentDocId) setCurrentDocId(null)
    if (setIsReviewOpen) setIsReviewOpen(false)
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="bg-sidebar">
      <SidebarHeader className="h-[var(--header-height)] border-b border-white/15 flex-row items-center px-0 py-0 bg-sidebar-gradient text-sidebar-primary-foreground">
        <div className="flex gap-2 h-full w-full items-center overflow-hidden">
          <div className="flex w-12 shrink-0 items-center justify-center">
            <img
              src="/assets/logo_campha.jpg"
              alt="Logo"
              className="size-10 rounded-full object-contain shadow-md"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center text-white font-extrabold tracking-tight leading-[1.1] whitespace-nowrap group-data-[collapsible=icon]:hidden">
            <span className="text-md">UBND phường</span>
            <span className="text-base">Cẩm Phả</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.tab

                // Role-based filtering
                const role = localStorage.getItem('user_role') || ROLES.CAN_BO
                if (item.tab === 'users' && role !== ROLES.ADMIN) return null

                if (item.tab === 'upload' && role !== ROLES.ADMIN && role !== ROLES.VAN_THU)
                  return null
                if (item.tab === 'settings' && role !== ROLES.ADMIN) return null

                if (item.hidden) return null

                if (item.isLink) {
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary font-semibold h-12 transition-all duration-200"
                      >
                        <a href={item.url} className="flex items-center">
                          <Icon className="relative z-10 size-5 shrink-0" />
                          <span className="relative z-10 text-[0.93rem] ml-2">{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      onClick={() => handleTabClick(item.tab)}
                      className={cn(
                        'h-12 rounded-lg transition-all duration-200',
                        isActive
                          ? "relative overflow-hidden bg-transparent text-primary border-l-4 border-primary font-bold shadow-sm before:absolute before:inset-0 before:bg-primary before:opacity-10 before:content-[''] hover:text-primary"
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary font-semibold'
                      )}
                    >
                      <Icon
                        className={cn(
                          'relative z-10 size-5 shrink-0',
                          isActive ? 'text-primary' : 'text-sidebar-foreground'
                        )}
                      />
                      <span
                        className={cn('relative z-10 text-[0.93rem] ml-2', isActive && 'font-bold')}
                      >
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
