/* eslint-disable */
/* global Response */
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

// ─── Global Fetch Interceptor for standardized ApiResponse ────────────────
const originalFetch = window.fetch
window.fetch = async (...args) => {
  const response = await originalFetch(...args)
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const clone = response.clone()
    try {
      const json = await clone.json()
      if (
        json &&
        typeof json === 'object' &&
        'success' in json &&
        ('data' in json || 'errors' in json)
      ) {
        let unwrappedData
        if (json.success) {
          unwrappedData = json.data !== null ? json.data : { message: json.message }
        } else {
          unwrappedData = {
            message: json.message,
            error: json.message,
            errors: json.errors,
          }
        }

        const newResponse = new Response(JSON.stringify(unwrappedData), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })

        Object.defineProperty(newResponse, 'url', { value: response.url })
        return newResponse
      }
    } catch (e) {
      // Ignore parsing error
    }
  }
  return response
}
import { AppShell } from './shell/AppShell.jsx'
import { LoginPage } from './pages/Login.jsx'
import PublicSchedule from './pages/PublicSchedule.jsx'
import { CabinetAppShell } from './cabinet/CabinetAppShell.jsx'
import './styles/globals.css'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ShieldAlert, LogOut } from 'lucide-react'

// ─── Modal cảnh báo bị đá phiên (toàn hệ thống) ───────────────────────────
function KickedModal({ isOpen, onConfirm }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header vàng cảnh báo */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-center">
          <div className="size-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
            <ShieldAlert className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Phiên bị chấm dứt
          </h2>
          <p className="text-white/80 text-sm font-semibold mt-3 leading-relaxed">
            Tài khoản của bạn vừa được đăng nhập từ một <strong>thiết bị khác</strong>.
            <br />
            Phiên làm việc hiện tại đã bị kết thúc để bảo vệ tài khoản.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
            <div className="text-orange-500 mt-0.5">⚠️</div>
            <p className="text-xs text-orange-700 font-semibold leading-relaxed">
              Nếu không phải bạn đăng nhập, hãy đổi mật khẩu ngay để bảo vệ tài khoản.
            </p>
          </div>
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-100"
          >
            <LogOut size={16} /> Đăng nhập lại
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root Component ─────────────────────────────────────────────────────────
function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'))
  const [isKicked, setIsKicked] = useState(false)

  useEffect(() => {
    document.body.classList.add('app-booting')

    // Lắng nghe thay đổi localStorage (đăng xuất từ tab khác)
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('auth_token'))
    }

    // Lắng nghe sự kiện unauthorized từ bất kỳ đâu
    const handleUnauthorized = () => {
      localStorage.removeItem('auth_token')
      setIsAuthenticated(false)
    }

    // 🔴 Lắng nghe sự kiện bị đá (từ signalr.js)
    const handleKicked = (e) => {
      console.warn('[Root] Nhận sự kiện auth:kicked:', e.detail)
      setIsKicked(true)
      setIsAuthenticated(false)
    }

    // 🟢 HỆ THỐNG IDLE TIMEOUT CHUẨN ENTERPRISE (Auto Logout)
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 phút
    const LAST_ACTIVITY_KEY = 'last_activity_time'

    // Hàm throttle để giới hạn số lần bắn sự kiện (giảm tải CPU)
    const throttle = (func, limit) => {
      let inThrottle
      return function() {
        const args = arguments
        const context = this
        if (!inThrottle) {
          func.apply(context, args)
          inThrottle = true
          setTimeout(() => inThrottle = false, limit)
        }
      }
    }

    // Cập nhật thời gian tương tác vào localStorage để đồng bộ đa Tab
    const updateActivity = throttle(() => {
      if (localStorage.getItem('auth_token')) {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
      }
    }, 2000) // Chỉ cập nhật tối đa 1 lần mỗi 2 giây

    // Heartbeat kiểm tra mỗi 10 giây xem đã quá hạn 30 phút chưa
    const checkIdleInterval = setInterval(() => {
      if (!localStorage.getItem('auth_token')) return

      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY)
      if (!lastActivityStr) {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
        return
      }

      const lastActivity = parseInt(lastActivityStr, 10)
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        console.warn('[Root] Hết thời gian truy cập (Idle Timeout), tự động đăng xuất.')
        
        // Gọi API Logout để xóa Cookie HttpOnly trên Backend (chuẩn bảo mật)
        fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }).catch(() => {})

        localStorage.removeItem('auth_token')
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        setIsAuthenticated(false)
        alert('Phiên làm việc đã hết hạn do bạn không hoạt động trong một thời gian dài. Vui lòng đăng nhập lại.')
      }
    }, 10000)

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }))

    // Khởi tạo thời gian lúc mới vào app
    if (localStorage.getItem('auth_token')) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
    }

    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('auth:unauthorized', handleUnauthorized)
    document.addEventListener('auth:kicked', handleKicked)

    return () => {
      clearInterval(checkIdleInterval)
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity))
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('auth:unauthorized', handleUnauthorized)
      document.removeEventListener('auth:kicked', handleKicked)
    }
  }, [])

  const handleLoginSuccess = () => {
    setIsKicked(false)
    setIsAuthenticated(true)
  }

  // Hỗ trợ đường dẫn công khai (không cần đăng nhập)
  const isPublicRoute = window.location.pathname === '/campha'
  const isCabinetRoute = window.location.pathname.startsWith('/phonghopkhonggiayto')

  if (isPublicRoute) {
    return <PublicSchedule />
  }

  return (
    <>
      {/* Modal bị đá - hiển thị trên tất cả màn hình */}
      <KickedModal isOpen={isKicked} onConfirm={() => setIsKicked(false)} />

      <TooltipProvider>
        {!isAuthenticated ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : isCabinetRoute ? (
          <CabinetAppShell />
        ) : (
          <AppShell />
        )}
      </TooltipProvider>
    </>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
