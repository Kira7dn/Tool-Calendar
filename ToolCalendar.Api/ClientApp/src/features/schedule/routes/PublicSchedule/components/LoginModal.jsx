/* eslint-disable */
import React, { useState } from 'react'
import { X, Lock, User, Key, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function LoginModal({ isOpen, onClose, onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsLoggingIn(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (response.ok) {
        const data = await response.json()
        const { token, ...userInfo } = data
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user_name', data.username || data.fullName)
        localStorage.setItem('user_role', data.role)
        toast.success('Đăng nhập thành công!')
        onSuccess()
      } else {
        toast.error('Tên đăng nhập hoặc mật khẩu không chính xác.')
      }
    } catch (error) {
      toast.error('Lỗi kết nối hệ thống.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="bg-[#c8102e] p-8 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white/50 hover:text-white"
          >
            <X size={20} />
          </button>
          <div className="size-16 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <Lock className="text-white" size={32} />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            Yêu cầu xác thực
          </h3>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">
            Vui lòng đăng nhập để xem nội dung văn bản
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#c8102e] transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder="Tên đăng nhập"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold outline-none focus:border-[#c8102e] transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="relative group">
              <Key
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#c8102e] transition-colors"
                size={18}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu"
                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold outline-none focus:border-[#c8102e] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#c8102e] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-4 bg-[#c8102e] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#a00d25] transition-all shadow-xl shadow-red-100 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Đăng nhập & Tiếp tục
          </button>
        </form>
      </div>
    </div>
  )
}
