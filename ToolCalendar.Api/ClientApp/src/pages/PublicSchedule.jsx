/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  X,
  Lock,
  User,
  Key,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import * as signalR from '@microsoft/signalr'
import { ErrorState } from '@/components/ui/error-state'

const DAYS_OF_WEEK = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

function LoginModal({ isOpen, onClose, onSuccess }) {
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
        const { token, ...userInfo } = data // Tách token ra, còn lại là thông tin user
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

function ScheduleBlock({ day, onViewDoc }) {
  return (
    <div className="mb-6">
      <p className="text-[#0a3d8f] font-black text-sm mb-2 uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-[#cc0000] rounded-full" />
        {day.dayLabel}, {day.date}
      </p>
      <div className="space-y-3">
        {day.items.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onViewDoc(item.docToken)}
            className="bg-white/60 p-3 rounded-lg border-l-4 border-gray-300 hover:border-[#cc0000] hover:bg-white cursor-pointer transition-all group shadow-sm"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[#cc0000] font-bold text-[11px] px-2 py-0.5 bg-red-50 rounded">
                {item.docNumber}
              </span>
              <svg
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#cc0000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-gray-700 text-xs leading-relaxed font-medium line-clamp-2 italic mb-3">
              "{item.content}"
            </p>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[9px] text-[#0a3d8f] font-black uppercase flex items-center gap-1 group-hover:text-[#cc0000] transition-colors">
                Xem chi tiết PDF
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavBar() {
  const [activeNav, setActiveNav] = useState('VĂN BẢN ĐẾN HẠN')
  const navItems = ['TRANG CHỦ', 'VĂN BẢN ĐẾN HẠN', 'TÌM KIẾM']

  const handleNavClick = (item) => {
    if (item === 'TRANG CHỦ') {
      window.location.href = '/'
      return
    }
    if (item === 'TÌM KIẾM') {
      window.location.href = '/?tab=search'
      return
    }
    setActiveNav(item)
  }

  return (
    <nav className="bg-[#2c6e49] w-full shadow-md">
      <div className="max-w-6xl mx-auto flex items-center">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => handleNavClick(item)}
            className={`
              px-6 py-3 text-xs font-bold tracking-wide transition-all uppercase
              ${
                activeNav === item
                  ? 'bg-[#1a4a30] text-white shadow-inner'
                  : 'text-white hover:bg-[#1a4a30]/50'
              }
            `}
          >
            {item}
          </button>
        ))}
      </div>
    </nav>
  )
}

function Header({ user, onLogout, onOpenLogin }) {
  const [showDropdown, setShowDropdown] = useState(false)

  // Kiểm tra thêm trực tiếp từ localStorage để dự phòng trường hợp state bị trễ
  const effectiveUser = React.useMemo(() => {
    if (user) return user
    try {
      const fullName = localStorage.getItem('user_full_name')
      const username = localStorage.getItem('user_name')
      const role = localStorage.getItem('user_role')
      if (fullName || username) {
        return { fullName: fullName || username, role: role || 'Thành viên' }
      }
      return null
    } catch {
      return null
    }
  }, [user])

  return (
    <header className="bg-white border-b-4 border-[#c8102e]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-white rounded-full shadow-lg border border-gray-100 overflow-hidden shrink-0">
            <img
              src="/assets/logo_campha.jpg"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0a3d8f] tracking-tighter uppercase leading-tight">
              Hệ thống Điều phối Công văn
            </h1>
            <p className="text-[#c8102e] font-bold text-sm tracking-widest uppercase italic">
              UBND phường CẨM PHẢ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block text-gray-500 text-[10px] font-bold uppercase tracking-widest">
            <p>Hệ thống giám sát thực thi công việc</p>
            <p>Dữ liệu thời gian thực</p>
          </div>

          {effectiveUser ? (
            <div className="flex items-center gap-3 pl-6 border-l border-gray-100 animate-in fade-in duration-500">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-none">
                  {effectiveUser.fullName ||
                    effectiveUser.username ||
                    effectiveUser.name ||
                    'Người dùng'}
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {effectiveUser.role || 'Thành viên'}
                </p>
              </div>
              <div className="relative">
                <div
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="size-10 rounded-2xl bg-gradient-to-br from-[#c8102e] to-[#a00d25] flex items-center justify-center text-white font-black shadow-lg shadow-red-100 border-2 border-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  {(effectiveUser.fullName || effectiveUser.username || effectiveUser.name || 'U')
                    .charAt(0)
                    .toUpperCase()}
                </div>
                {/* Logout Dropdown */}
                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 top-full pt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          onLogout()
                          setShowDropdown(false)
                        }}
                        className="bg-white border border-slate-100 shadow-2xl rounded-xl py-3 px-5 text-[10px] font-black text-red-600 uppercase tracking-widest hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <X size={14} strokeWidth={3} /> Đăng xuất hệ thống
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="size-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer group animate-in fade-in duration-500"
              title="Click để đăng nhập"
            >
              <User size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

// Modal cảnh báo bị đá khỏi phiên
function KickedModal({ isOpen, onConfirm }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-center">
          <div className="size-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
            <ShieldAlert className="text-white" size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Phiên bị chấm dứt
          </h2>
          <p className="text-white/80 text-xs font-semibold mt-2 leading-relaxed">
            Tài khoản của bạn vừa đăng nhập từ một thiết bị khác.
            <br />
            Phiên làm việc hiện tại đã bị kết thúc.
          </p>
        </div>
        <div className="p-6">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Tôi đã hiểu, đăng nhập lại
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PublicSchedule() {
  const [scheduleData, setScheduleData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [pendingDocId, setPendingDocId] = useState(null)
  const [user, setUser] = useState(null)
  const [isKicked, setIsKicked] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const signalRRef = useRef(null)

  const refreshUser = () => {
    try {
      const username = localStorage.getItem('user_name')
      const role = localStorage.getItem('user_role')
      if (username) {
        setUser({ fullName: username, role: role || 'Thành viên' })
      } else {
        setUser(null)
      }
    } catch (e) {
      console.error('Lỗi đồng bộ user:', e)
      setUser(null)
    }
  }

  const connectSignalR = (token) => {
    // Hủy kết nối cũ nếu có
    if (signalRRef.current) {
      signalRRef.current.stop()
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub', {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    // Lắng nghe sự kiện bị đá (Backend tự join group qua JWT trong OnConnectedAsync)
    connection.on('Kicked', (message) => {
      console.warn('[SignalR] Bị đá khỏi phiên:', message)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      setUser(null)
      setIsKicked(true)
    })

    connection
      .start()
      .then(() => console.log('[SignalR] Đã kết nối vào /notificationHub'))
      .catch((err) => console.warn('[SignalR] Lỗi kết nối:', err))

    signalRRef.current = connection
  }

  const fetchSchedule = () => {
    setLoading(true)
    setError(false)
    fetch('/api/documents/public-schedule')
      .then((res) => {
        if (!res.ok) throw new Error('API request failed')
        return res.json()
      })
      .then((data) => {
        setScheduleData(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Lỗi tải dữ liệu:', err)
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    refreshUser()

    // Nếu đã có token khi load trang → kết nối SignalR luôn
    const token = localStorage.getItem('auth_token')
    if (token && token !== 'undefined') {
      connectSignalR(token)
    }

    fetchSchedule()

    // Cleanup khi unmount
    return () => {
      if (signalRRef.current) signalRRef.current.stop()
    }
  }, [])

  const handleViewDoc = async (docToken) => {
    // Trường hợp: người dùng phải đăng nhập mới xem được nội dung chi tiết
    const token = localStorage.getItem('auth_token')
    if (!token || token === 'undefined') {
      setPendingDocId(docToken)
      setIsLoginModalOpen(true)
      return
    }

    // Hiển thị thông báo đang tải
    const toastId = toast.loading('Đang tải văn bản...')

    try {
      // ✅ Fetch PDF dưới dạng blob — URL thật không bao giờ xuất hiện trong browser history
      // Điều này ngăn người dùng copy URL và dùng lại trong tab ẩn danh
      const response = await fetch(
        `/api/documents/public-file?token=${encodeURIComponent(docToken)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (response.ok) {
        const blob = await response.blob()
        // Tạo URL tạm thời từ blob — URL dạng blob:// chỉ hợp lệ trong tab này
        // Không thể share, không lưu trong history, tự hủy khi tab đóng
        const blobUrl = URL.createObjectURL(blob)
        const pdfWindow = window.open('', '_blank')
        if (pdfWindow) {
          pdfWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Văn bản công vụ</title>
              <style>body,html{margin:0;padding:0;height:100%;overflow:hidden}iframe{width:100%;height:100vh;border:none}</style>
            </head>
            <body>
              <iframe src="${blobUrl}" type="application/pdf"></iframe>
              <script>
                // Tự động giải phóng blob URL sau khi tải xong (bảo mật bộ nhớ)
                window.addEventListener('load', function() {
                  setTimeout(function() { URL.revokeObjectURL('${blobUrl}'); }, 60000);
                });
              </script>
            </body>
            </html>
          `)
          pdfWindow.document.close()
        } else {
          // Trình duyệt chặn popup — fallback: tải thẳng file
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = `vanban_${docToken.substring(0, 8)}.pdf`
          a.click()
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
        }
        toast.dismiss(toastId)
        toast.success('Đã tải văn bản thành công.')
      } else if (response.status === 401 || response.status === 403) {
        toast.dismiss(toastId)
        toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
        setPendingDocId(docToken)
        setIsLoginModalOpen(true)
      } else {
        toast.dismiss(toastId)
        toast.error('Không thể tải file văn bản.')
      }
    } catch (error) {
      toast.dismiss(toastId)
      console.error('Lỗi tải file:', error)
      toast.error('Lỗi kết nối máy chủ.')
    }
  }

  const handleLoginSuccess = () => {
    refreshUser()
    setIsLoginModalOpen(false)

    // Kết nối SignalR sau khi đăng nhập thành công
    const token = localStorage.getItem('auth_token')
    if (token) connectSignalR(token)

    if (pendingDocId) {
      handleViewDoc(pendingDocId)
      setPendingDocId(null)
    }
  }

  const handleLogout = () => {
    setIsLoggingOut(true)
    if (signalRRef.current) signalRRef.current.stop()
    setTimeout(() => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_full_name')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_id')
      // ✅ Xóa jwt_cookie khi đăng xuất để ngăn truy cập trái phép
      document.cookie = 'jwt_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
      setUser(null)
      setIsLoggingOut(false)
    }, 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c8102e] mx-auto mb-4" />
          <p className="text-gray-600 font-bold uppercase text-xs tracking-widest">
            Đang kết nối hệ thống...
          </p>
        </div>
      </div>
    )
  }

  const today =
    scheduleData.find((d) => d.dayLabel.includes('Hôm nay')) ||
    (scheduleData.length > 0 ? scheduleData[0] : null)
  const upcomingDays = scheduleData.filter((d) => d !== today)

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f4f7f6] font-sans">
        {/* ── Logout Animation Overlay ───────────────────────── */}
        {isLoggingOut && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 animate-in fade-in duration-300">
            <div className="relative mb-8">
              <div className="size-24 rounded-full bg-white flex items-center justify-center overflow-hidden border border-white/20 shadow-xl">
                <img
                  src="/assets/logo_campha.jpg"
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-red-400 animate-spin" />
            </div>
            <p className="text-white font-black text-xl uppercase tracking-[0.3em] mb-2">
              Đang đăng xuất
            </p>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
              Hệ thống điều phối công văn
            </p>
            <div className="flex gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-2 rounded-full bg-red-400"
                  style={{ animation: `ps-bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
            <style>{`
              @keyframes ps-bounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
                40% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        <KickedModal
          isOpen={isKicked}
          onConfirm={() => {
            setIsKicked(false)
            setIsLoginModalOpen(true) // Mở lại form đăng nhập
          }}
        />

        <Header user={user} onLogout={handleLogout} onOpenLogin={() => setIsLoginModalOpen(true)} />
        <NavBar />

        <main className="max-w-6xl mx-auto px-4 py-8">
          {error ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <ErrorState onRetry={fetchSchedule} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-2xl border-t-8 border-[#0a3d8f] overflow-hidden">
                  <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black text-[#0a3d8f] uppercase tracking-tight mb-1">
                        Danh sách văn bản đến hạn
                      </h2>
                      <p className="text-[#cc0000] font-bold text-sm uppercase">
                        {today ? today.dayLabel + ', ' + today.date : 'Hôm nay'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                      </span>
                      <span className="text-[#cc0000] text-xs font-black uppercase tracking-widest">
                        Live
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    {today && today.items.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {today.items.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleViewDoc(item.docToken)}
                            className="bg-white border-2 border-gray-100 p-5 rounded-xl hover:border-[#0a3d8f] hover:shadow-xl cursor-pointer transition-all duration-300 relative group flex flex-col justify-between h-full"
                          >
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="bg-[#0a3d8f] group-hover:bg-[#cc0000] text-white px-2 py-1 rounded text-[10px] font-black transition-colors">
                                  {item.docNumber}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  Hạn xử lý
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 font-bold leading-relaxed mb-4">
                                {item.content}
                              </p>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                              <span className="text-[10px] text-[#0a3d8f] font-black uppercase flex items-center gap-1 group-hover:text-[#cc0000] transition-colors">
                                Xem chi tiết PDF
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-gray-400 italic">
                        <p className="text-4xl mb-4">📄</p>
                        <p className="uppercase text-xs font-bold tracking-widest">
                          Không có văn bản nào đến hạn trong ngày hôm nay
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden sticky top-4">
                  <div className="bg-[#2c6e49] px-4 py-4">
                    <h3 className="text-white font-black text-center uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Sắp đến hạn xử lý
                    </h3>
                  </div>
                  <div className="p-5 bg-gray-50/50">
                    {upcomingDays.length > 0 ? (
                      <div className="space-y-4">
                        {upcomingDays.map((day, idx) => (
                          <ScheduleBlock key={idx} day={day} onViewDoc={handleViewDoc} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 text-[10px] uppercase font-bold italic py-10">
                        Chưa có văn bản dự kiến đến hạn tiếp theo
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={handleLoginSuccess}
        />

        <footer className="mt-12 bg-gray-800 text-gray-400 py-8 px-4 text-center text-xs">
          <p className="mb-2">© 2026 Bản quyền thuộc về UBND phường Cẩm Phả</p>
          <p>Hệ thống được phát triển bởi LinkStrategy</p>
        </footer>
      </div>
    </TooltipProvider>
  )
}
