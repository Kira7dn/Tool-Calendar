/* eslint-disable */
import React from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/ui/error-state'

import { usePublicSchedule } from '../features/schedule/hooks/usePublicSchedule'
import { LoginModal } from '../features/schedule/routes/PublicSchedule/components/LoginModal'
import { Header } from '../features/schedule/routes/PublicSchedule/components/Header'
import { NavBar } from '../features/schedule/routes/PublicSchedule/components/NavBar'
import { KickedModal } from '../features/schedule/routes/PublicSchedule/components/KickedModal'
import { ScheduleBlock } from '../features/schedule/routes/PublicSchedule/components/ScheduleBlock'

export default function PublicSchedule() {
  const {
    scheduleData,
    loading,
    error,
    isLoginModalOpen,
    setIsLoginModalOpen,
    user,
    isKicked,
    setIsKicked,
    isLoggingOut,
    fetchSchedule,
    handleViewDoc,
    handleLoginSuccess,
    handleLogout,
  } = usePublicSchedule()

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
            setIsLoginModalOpen(true)
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
