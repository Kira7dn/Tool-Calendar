import React from 'react'
import { ShieldAlert, LogOut } from 'lucide-react'

export function KickedModal({ isOpen, onConfirm }) {
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
