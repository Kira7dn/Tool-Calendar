/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
/* eslint-disable react/prop-types */
import { Edit, UserPlus, User, Lock, Eye, EyeOff, Mail, Phone, Loader2, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ROLES } from '@/constants/roles'

export function UserModal({ isOpen, onClose, user, departments, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showModalPassword, setShowModalPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    role: ROLES.CAN_BO,
    departmentId: '0',
  })
  const [errors, setErrors] = useState({ email: '', phoneNumber: '' })

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setFormData({
          username: user.username || '',
          password: '',
          fullName: user.fullName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          role: user.role || ROLES.CAN_BO,
          departmentId: user.departmentId ? user.departmentId.toString() : '0',
        })
      } else {
        setFormData({
          username: '',
          password: '',
          fullName: '',
          email: '',
          phoneNumber: '',
          role: ROLES.CAN_BO,
          departmentId: '0',
        })
      }
      setErrors({ email: '', phoneNumber: '' })
      setShowModalPassword(false)
    }
  }, [isOpen, user])

  const validateEmail = (email) => {
    if (!email) return true
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const validatePhone = (phone) => {
    if (!phone) return true
    const re = /^0[0-9]{9}$/
    return re.test(phone)
  }

  const handleSubmit = async () => {
    if (!formData.fullName || (!user && !formData.username) || (!user && !formData.password)) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc')
      return
    }
    if (formData.email && !validateEmail(formData.email)) {
      toast.error('Email không đúng định dạng')
      return
    }
    if (formData.phoneNumber && !validatePhone(formData.phoneNumber)) {
      toast.error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0')
      return
    }

    setIsSubmitting(true)
    try {
      const url = user ? `/api/users/${user.id}` : '/api/users'
      const method = user ? 'PUT' : 'POST'
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        departmentId:
          formData.departmentId && formData.departmentId !== '0'
            ? parseInt(formData.departmentId)
            : null,
      }
      if (!user) {
        payload.username = formData.username
        payload.passwordHash = formData.password
      } else if (formData.password) {
        payload.passwordHash = formData.password
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onClose()
        toast.success(user ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản thành công')

        if (user && user.id.toString() === localStorage.getItem('user_id')) {
          if (user.role !== formData.role) {
            toast.info('Vai trò của bạn đã bị thay đổi, hệ thống sẽ đăng xuất để cập nhật.')
            setTimeout(() => {
              localStorage.clear()
              window.location.href = '/login'
            }, 1500)
            return
          }
        }

        if (onSuccess) onSuccess()
      } else {
        const err = await response.json()
        toast.error(err.message || 'Lỗi khi lưu người dùng')
      }
    } catch (error) {
      console.error('Submit user failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-[95vw] p-0 border-none shadow-2xl glass-card flex flex-col max-h-[95vh] overflow-hidden">
        <DialogHeader className="p-5 md:p-8 bg-red-600 text-white relative shrink-0">
          <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
              {user ? (
                <Edit className="size-5 text-white" />
              ) : (
                <UserPlus className="size-5 text-white" />
              )}
            </div>
            <span className="drop-shadow-sm">
              {user ? 'Cập nhật tài khoản' : 'Tạo tài khoản mới'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-white/80 font-medium mt-2">
            Thiết lập thông tin đăng nhập và vai trò cho cán bộ
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 md:p-8 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Tên đăng nhập
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="vd: canbo.dv"
                  value={formData.username}
                  onChange={(e) => !user && setFormData({ ...formData, username: e.target.value })}
                  className="pl-10 rounded-xl bg-muted/50 border-none h-11 font-bold disabled:opacity-50"
                  disabled={!!user}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {user ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type={showModalPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 rounded-xl bg-muted/50 border-none h-11 font-bold"
                  autoComplete="new-password"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowModalPassword(!showModalPassword)}
                >
                  {showModalPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Họ và tên
              </Label>
              <Input
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="rounded-xl bg-muted/50 border-none h-11 font-black text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="email@vidu.com"
                  value={formData.email}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({ ...formData, email: val })
                    setErrors((prev) => ({
                      ...prev,
                      email:
                        val && !validateEmail(val) ? 'Email không hợp lệ (vd: abc@gmail.com)' : '',
                    }))
                  }}
                  className={cn(
                    'pl-10 h-11 font-medium',
                    errors.email ? 'border-red-500 bg-red-50' : 'bg-muted/50 border-none'
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-red-500 font-bold ml-1 mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Số điện thoại
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="09xx..."
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({ ...formData, phoneNumber: val })
                    setErrors((prev) => ({
                      ...prev,
                      phoneNumber:
                        val && !validatePhone(val) ? 'SĐT phải có 10 số, bắt đầu bằng 0' : '',
                    }))
                  }}
                  className={cn(
                    'pl-10 rounded-xl h-11 font-medium',
                    errors.phoneNumber ? 'border-red-500 bg-red-50' : 'bg-muted/50 border-none'
                  )}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-[10px] text-red-500 font-bold ml-1 mt-1">{errors.phoneNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Phòng ban
              </Label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-4 h-11 rounded-xl bg-muted/50 border-none text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
              >
                <option value="0">Chưa phân phòng</option>
                {departments
                  .filter(
                    (d) =>
                      d.isActive !== false || d.id.toString() === formData?.departmentId?.toString()
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id.toString()}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Vai trò
              </Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 h-11 rounded-xl bg-muted/50 border-none text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
              >
                <option value={ROLES.CAN_BO}>Cán bộ xử lý</option>
                <option value={ROLES.VAN_THU}>Văn thư</option>
                <option value={ROLES.LANH_DAO}>Lãnh đạo</option>
                <option value={ROLES.ADMIN}>Quản trị viên</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 md:p-6 bg-slate-50 flex items-center justify-end gap-3 border-t border-slate-100 shrink-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-slate-500">
            Hủy bỏ
          </Button>
          <Button
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black px-8 md:px-10 shadow-lg shadow-red-100 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
            onClick={handleSubmit}
            disabled={isSubmitting || !!errors.email || !!errors.phoneNumber}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Check className="size-4 mr-2" />
            )}
            {user ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
