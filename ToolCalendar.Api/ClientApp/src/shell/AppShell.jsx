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
  Settings,
  UserRound,
  Users,
  Upload,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Sidebar } from './Sidebar.jsx';
import { cn } from '@/lib/utils';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { tab: 'dashboard', labelKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: true },
  { tab: 'documents', labelKey: 'documents', label: 'Văn bản', icon: FileText },
  { tab: 'upload', labelKey: 'upload', label: 'Tải hồ sơ mới', icon: Upload },
  { tab: 'users', id: 'nav-users', labelKey: 'users', label: 'Nhân sự', icon: Users, hidden: true },
  { tab: 'my-tasks', id: 'nav-my-tasks', labelKey: 'my_tasks', label: 'Công việc của tôi', icon: CheckSquare, hidden: true },
  { tab: 'settings', labelKey: 'settings', label: 'Cấu hình', icon: Settings }
];

const userMenuItems = [
  { tab: 'settings', labelKey: 'settings', label: 'Cài đặt tài khoản', icon: Settings },
  { action: 'open-change-password-modal', labelKey: 'change_password', label: 'Đổi mật khẩu', icon: KeyRound },
  { action: 'logout', labelKey: 'logout', label: 'Đăng xuất', icon: LogOut, className: 'text-[#e41e3f]' }
];

function NavItem({ item }) {
  const Icon = item.icon;

  return (
    <li
      id={item.id}
      className={`nav-item ${item.active ? 'active' : ''}`}
      data-tab={item.tab}
      style={item.hidden ? { display: 'none' } : undefined}
    >
      <div className="nav-icon">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <span className="nav-label" data-i18n={item.labelKey}>
        {item.label}
      </span>
    </li>
  );
}

function UserMenuItem({ item }) {
  const Icon = item.icon;

  return (
    <div
      className={`user-menu-item ${item.className || ''}`}
      data-tab={item.tab}
      data-action={item.action}
    >
      <span className="menu-icon">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span data-i18n={item.labelKey}>{item.label}</span>
    </div>
  );
}

function PasswordToggle({ inputId }) {
  function togglePassword(event) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const nextType = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', nextType);
    event.currentTarget.title = nextType === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu';
    event.currentTarget.dataset.visible = nextType === 'text' ? '1' : '0';
  }

  return (
    <button
      type="button"
      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-slate-500"
      title="Hiện mật khẩu"
      data-visible="0"
      onClick={togglePassword}
    >
      <Eye className="size-4 [[data-visible='1']_&]:hidden" />
      <EyeOff className="hidden size-4 [[data-visible='1']_&]:block" />
    </button>
  );
}


export function AppShell() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    // Bridge to legacy
    document.getElementById('main-sidebar')?.classList.toggle('collapsed');
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
    document.getElementById('main-sidebar')?.classList.toggle('open');
  };

  return (
    <>
      <div className="bg-blobs">
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
          <header>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mobile-menu-btn"
              onClick={toggleMobileSidebar}
              aria-label="Mở/Đóng menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="header-title">
              <h1 id="page-title">Hệ Thống Điều Phối Công Văn</h1>
              <p id="page-subtitle">Giám sát và đôn đốc thực thi công việc thời gian thực</p>
            </div>
            <div className="header-actions">
              <div className="header-controls-group">
                <div className="lang-switcher-minimal">
                  <span className="lang-link" data-lang="en">
                    English
                  </span>
                  <span className="lang-separator">|</span>
                  <span className="lang-link" data-lang="vi">
                    Tiếng Việt
                  </span>
                </div>

                <div className="header-notif-container desktop-only">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="notif-icon-circle"
                    id="notif-bell"
                    data-action="toggle-notif-dropdown"
                  >
                    <Bell className="bell-icon size-5" />
                    <Badge className="notif-badge" id="notif-badge">
                      0
                    </Badge>
                  </Button>

                  <Card className="notif-dropdown-box py-0" id="notif-dropdown">
                    <CardContent className="px-0">
                      <div className="notif-dropdown-header">
                        <h3>Thông báo</h3>
                        <Button
                          type="button"
                          variant="link"
                          className="btn-text h-auto p-0 text-[0.9rem] font-normal text-[#1877f2]"
                          data-action="mark-all-read"
                        >
                          Đánh dấu tất cả đã đọc
                        </Button>
                      </div>
                      <div className="notif-tabs">
                        <div className="notif-tab active" data-filter="all">
                          Tất cả
                        </div>
                        <div className="notif-tab" data-filter="unread">
                          Chưa đọc
                        </div>
                      </div>
                      <div className="notif-dropdown-list" id="notif-list">
                        <div className="notif-empty-state">
                          <div className="empty-icon">🔔</div>
                          <p>Bạn không có thông báo nào mới</p>
                        </div>
                      </div>
                      <div className="notif-dropdown-footer">
                        <a href="#" data-tab="documents">
                          Xem tất cả văn bản
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="user-profile-container">
                  <Button
                    type="button"
                    variant="ghost"
                    className="user-avatar-circle"
                    id="user-profile-toggle"
                    data-action="toggle-user-dropdown"
                  >
                    <Avatar className="size-full">
                      <AvatarImage src="/assets/logo.png" alt="User Avatar" id="header-user-avatar" />
                    </Avatar>
                    <ChevronDown className="avatar-chevron desktop-only size-3" />
                  </Button>

                  <Card className="user-dropdown-box py-0" id="user-dropdown">
                    <CardContent className="px-0">
                      <div className="user-dropdown-info">
                        <Avatar className="large-avatar">
                          <AvatarImage src="/assets/logo.png" alt="User Avatar" />
                        </Avatar>
                        <div className="user-details">
                          <div className="user-full-name" id="dropdown-user-name">
                            Admin
                          </div>
                          <div className="user-role" data-i18n="admin_system">
                            Quản trị viên hệ thống
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="user-dropdown-menu">
                        {userMenuItems.map((item) => (
                          <UserMenuItem key={item.labelKey} item={item} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </header>

          <div id="tab-host" className="tab-host" />
        </main>
      </div>

      <div id="modal-host" />

      <div id="mobile-notif-panel" className="mobile-notif-panel">
        <div className="mobile-notif-panel-header">
          <Button type="button" variant="ghost" size="icon" className="mobile-notif-back" id="mobile-notif-back">
            <ArrowLeft className="size-5" />
          </Button>
          <h2 data-i18n="notifications">Thông báo</h2>
          <Button
            type="button"
            variant="link"
            className="btn-text mobile-notif-markall h-auto p-0"
            data-action="mark-all-read"
            data-i18n="mark_all_read"
          >
            Đánh dấu đã đọc
          </Button>
        </div>
        <div className="mobile-notif-tabs">
          <div className="mobile-notif-tab active" data-filter="all" data-i18n="all">
            Tất cả
          </div>
          <div className="mobile-notif-tab" data-filter="unread" data-i18n="unread">
            Chưa đọc
          </div>
        </div>
        <div className="mobile-notif-list" id="mobile-notif-list" />
      </div>
      <div id="mobile-notif-overlay" className="mobile-notif-overlay" />

      <nav className="mobile-bottom-nav">
        <div className="bottom-nav-item active" data-tab="dashboard">
          <LayoutDashboard className="bottom-nav-icon" />
          <span className="bottom-nav-label" data-i18n="home">
            Trang chủ
          </span>
        </div>
        <div className="bottom-nav-item" data-tab="documents">
          <FileText className="bottom-nav-icon" />
          <span className="bottom-nav-label" data-i18n="documents">
            Văn bản
          </span>
        </div>
        <div className="bottom-nav-item" id="mobile-notif-btn" data-action="open-mobile-notif">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell className="bottom-nav-icon" />
            <Badge className="mobile-badge" id="notif-badge-mobile" style={{ display: 'none' }}>
              0
            </Badge>
          </div>
          <span className="bottom-nav-label" data-i18n="notifications">
            Thông báo
          </span>
        </div>
        <div className="bottom-nav-item" data-tab="my-tasks">
          <CheckSquare className="bottom-nav-icon" />
          <span className="bottom-nav-label" data-i18n="tasks">
            Công việc
          </span>
        </div>
      </nav>

      <div
        id="change-password-modal"
        className="modal"
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Card className="data-section w-[400px] p-[30px]">
          <h3 className="mb-5" data-i18n="change_password">
            Đổi mật khẩu
          </h3>
          <div className="form-group">
            <Label
              className="mb-1.5 block text-[0.8rem] text-[var(--text-secondary)]"
              htmlFor="current-user-new-password"
              data-i18n="new_password"
            >
              Mật khẩu mới
            </Label>
            <div className="relative">
              <Input
                type="password"
                id="current-user-new-password"
                data-i18n-placeholder="placeholder_new_password"
                placeholder="Nhập mật khẩu mới..."
                className="bg-white pr-10 text-slate-800"
              />
              <PasswordToggle inputId="current-user-new-password" />
            </div>
          </div>
          <div className="form-group mt-[15px]">
            <Label
              className="mb-1.5 block text-[0.8rem] text-[var(--text-secondary)]"
              htmlFor="current-user-confirm-password"
              data-i18n="confirm_password"
            >
              Xác nhận mật khẩu mới
            </Label>
            <div className="relative">
              <Input
                type="password"
                id="current-user-confirm-password"
                data-i18n-placeholder="placeholder_confirm_password"
                placeholder="Xác nhận mật khẩu mới..."
                className="bg-white pr-10 text-slate-800"
              />
              <PasswordToggle inputId="current-user-confirm-password" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              className="btn bg-slate-200 text-slate-800 hover:bg-slate-300"
              data-action="close-change-password-modal"
              data-i18n="cancel"
            >
              Hủy
            </Button>
            <Button type="button" className="btn btn-primary" data-action="confirm-change-password" data-i18n="confirm">
              Xác nhận
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
