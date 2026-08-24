// shell/UserMenu.jsx
// Avatar + Dropdown menu user + Modal đổi mật khẩu (tách từ AppShell)
/* eslint-disable */
import React, { useState } from 'react'
import {
  KeyRound,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'
import { ROLES } from '../constants/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function UserMenu({ user, onLogout, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleChangePassword = async () => {
    const newPass = document.getElementById('current-user-new-password').value
    const confirmPass = document.getElementById('current-user-confirm-password').value

    if (newPass.length < 4) {
      toast.error('Mật khẩu mới phải có ít nhất 4 ký tự!')
      return
    }
    if (newPass !== confirmPass) {
      toast.error('Mật khẩu xác nhận không khớp!')
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPass }),
      })
      if (response.ok) {
        toast.success('Đổi mật khẩu thành công!')
        setIsPasswordModalOpen(false)
        document.getElementById('current-user-new-password').value = ''
        document.getElementById('current-user-confirm-password').value = ''
      } else {
        const err = await response.json()
        toast.error(err.message || 'Có lỗi xảy ra khi đổi mật khẩu!')
      }
    } catch {
      toast.error('Không thể kết nối đến máy chủ!')
    }
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
                {user.role === ROLES.ADMIN ? 'Quản trị' : 'Cán bộ'}
              </span>
            </div>
            <ChevronDown className="size-3.5 ml-1 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform max-md:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 p-2 border-none shadow-2xl glass-card rounded-2xl"
        >
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
                  {user.role === ROLES.ADMIN ? 'Quản trị viên hệ thống' : 'Cán bộ xử lý'}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <div className="py-1">
            {user.role === ROLES.ADMIN && (
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer font-bold text-sm"
                onSelect={() => onNavigate('settings')}
              >
                <SettingsIcon className="size-4" />
                <span>Cấu hình hệ thống</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer font-bold text-sm"
              onSelect={() => setIsPasswordModalOpen(true)}
            >
              <KeyRound className="size-4" />
              <span>Đổi mật khẩu</span>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <div className="py-1">
            <DropdownMenuItem
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer font-bold text-sm"
              onClick={() => window.location.reload(true)}
            >
              <RefreshCw className="size-4" />
              <span>Tải lại trang (Làm mới)</span>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-destructive hover:text-destructive/90 hover:bg-destructive/10 cursor-pointer font-bold text-sm"
            onClick={onLogout}
          >
            <LogOut className="size-4" />
            <span>Đăng xuất</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
                    type={showPassword ? 'text' : 'password'}
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
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu..."
                    className="h-12 bg-muted/30 focus:bg-background transition-all pl-4 pr-10 font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl border-border text-muted-foreground font-bold hover:bg-muted/50"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-lg shadow-red-100"
                data-action="confirm-change-password"
                onClick={handleChangePassword}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
