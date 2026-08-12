/* eslint-disable */
import React, { useState } from 'react'
import { User, X } from 'lucide-react'

export function Header({ user, onLogout, onOpenLogin }) {
  const [showDropdown, setShowDropdown] = useState(false)

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
              Hệ thống Điều phối Văn bản
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
