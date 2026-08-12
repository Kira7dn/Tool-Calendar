/* eslint-disable */
/* global sessionStorage */
import React, { useEffect, useState } from 'react'
import { Eye, EyeOff, TriangleAlert, Lock, User, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showKickedBanner, setShowKickedBanner] = useState(false)

  useEffect(() => {
    document.body.classList.add('login-page')

    if (sessionStorage.getItem('kicked_out') === '1') {
      setShowKickedBanner(true)
      sessionStorage.removeItem('kicked_out')
    }

    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'unauthorized') {
      setError('Bạn cần đăng nhập để xem nội dung này.')
    } else if (err === 'forbidden') {
      setError(
        'Bạn không có quyền truy cập nội dung này. Vui lòng đăng nhập với tài khoản có thẩm quyền.'
      )
    }

    return () => {
      document.body.classList.remove('login-page')
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user_name', data.username)
        localStorage.setItem('user_full_name', data.fullName || data.username)
        localStorage.setItem('user_role', data.role)
        localStorage.setItem('user_id', data.userId)

        if (onLoginSuccess) {
          onLoginSuccess()
        } else {
          window.location.reload()
        }
        return
      }

      const err = await res.json()
      setError(err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.')
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Premium Background Blobs */}
      <div className="bg-blobs fixed inset-0 pointer-events-none -z-10">
        <div className="blob blob-1 scale-[2] opacity-30 animate-pulse" />
        <div
          className="blob blob-2 scale-[2] opacity-30 animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-[420px] relative animate-in fade-in zoom-in duration-700">
        {/* Decorative Glow */}
        <div className="absolute -top-[5%] -left-[5%] size-32 bg-primary/10 rounded-full blur-[60px]" />
        <div className="absolute -bottom-[5%] -right-[5%] size-32 bg-primary/10 rounded-full blur-[60px]" />

        <Card className="relative glass-card border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden rounded-[2rem]">
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-primary opacity-80" />

          <CardHeader className="pt-8 pb-4 text-center space-y-3">
            <div className="mx-auto size-20 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden transition-transform hover:scale-105 duration-500">
              <img
                src="/assets/logo_campha.jpg"
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/64'
                }}
              />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-2xl font-black text-foreground tracking-tight">
                Chào mừng trở lại
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                Hệ thống điều phối văn bản
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-8 px-8">
            {showKickedBanner && (
              <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-3 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-2.5">
                  <TriangleAlert className="size-4 text-destructive shrink-0" />
                  <p className="text-[11px] font-bold text-destructive leading-tight">
                    Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 group">
                <Label
                  htmlFor="username"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1 group-focus-within:text-primary transition-colors"
                >
                  Tên đăng nhập
                </Label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/input:text-primary transition-colors">
                    <User className="size-4" />
                  </div>
                  <Input
                    type="text"
                    id="username"
                    placeholder="Tài khoản..."
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 pl-11 bg-white/30 border-white/10 focus:bg-white/50 focus:border-primary/30 transition-all rounded-xl font-bold shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5 group">
                <Label
                  htmlFor="password"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1 group-focus-within:text-primary transition-colors"
                >
                  Mật khẩu
                </Label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/input:text-primary transition-colors">
                    <Lock className="size-4" />
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-11 pr-11 bg-white/30 border-white/10 focus:bg-white/50 focus:border-primary/30 transition-all rounded-xl font-bold shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground/20 hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    'w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 shadow-lg',
                    isSubmitting
                      ? 'bg-muted text-muted-foreground opacity-50'
                      : 'bg-primary hover:bg-sidebar-mid text-primary-foreground shadow-primary/20 hover:-translate-y-0.5'
                  )}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang xác thực...</span>
                    </div>
                  ) : (
                    'Đăng nhập ngay'
                  )}
                </Button>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold text-center animate-in shake-1">
                  {error}
                </div>
              )}
            </form>
          </CardContent>

          <div className="bg-white/20 backdrop-blur-md p-4 border-t border-white/5 text-center">
            <p className="text-[9px] text-muted-foreground/50 font-black uppercase tracking-widest">
              &copy; 2026 LINK STRATEGY SYSTEM
            </p>
          </div>
        </Card>

        {/* Footer info */}
        <div className="mt-6 text-center animate-in fade-in duration-1000">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
            Link Strategy Technology Team
          </p>
        </div>
      </div>
    </div>
  )
}
