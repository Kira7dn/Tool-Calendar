/* eslint-disable */
import React from 'react'
import { cn } from '@/lib/utils'

export function DocContentTab({ doc, docId, pdfUrl, setIsFullscreenPdf }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] lg:h-full animate-in fade-in zoom-in-95 duration-400">
      <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
          FILE & OCR RESULT
        </h2>
        <button
          className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-widest"
          onClick={() => {
            const token = localStorage.getItem('auth_token')
            // ✅ Bảo mật: Dùng cookie thay vì token trên URL
            document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
            if (window.innerWidth < 768) {
              setIsFullscreenPdf(true)
            } else {
              window.open(`/api/documents/${docId}/file`, '_blank')
            }
          }}
        >
          XEM TOÀN MÀN HÌNH
        </button>
      </div>
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="flex-1 bg-slate-100/50 border-r border-slate-100 relative">
          <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
        </div>
        <div className="w-full md:w-80 shrink-0 bg-slate-900 p-6 overflow-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              OCR DATA STREAM
            </p>
            <button
              id="btn-reprocess-ocr"
              onClick={async () => {
                const btn = document.getElementById('btn-reprocess-ocr')
                btn.disabled = true
                btn.textContent = 'Đang xử lý...'
                try {
                  const token = localStorage.getItem('auth_token')
                  await fetch(`/api/documents/${docId}/reprocess-ocr`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  btn.textContent = 'Đang chờ kết quả...'
                  // Poll mỗi 4s, tối đa 10 lần
                  let tries = 0
                  const poll = setInterval(async () => {
                    tries++
                    const r = await fetch(`/api/documents/${docId}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const json = await r.json()
                    if (json.data?.fullText) {
                      clearInterval(poll)
                      window.location.reload()
                    } else if (tries >= 10) {
                      clearInterval(poll)
                      btn.disabled = false
                      btn.textContent = 'Xử lý lại OCR'
                    }
                  }, 4000)
                } catch {
                  btn.disabled = false
                  btn.textContent = 'Xử lý lại OCR'
                }
              }}
              className="text-[9px] font-bold px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              Xử lý lại OCR
            </button>
          </div>
          <div className="text-slate-400 font-mono text-[11px] leading-relaxed select-all">
            {doc.fullText || 'HỆ THỐNG KHÔNG TÌM THẤY DỮ LIỆU OCR.'}
          </div>
        </div>
      </div>
    </div>
  )
}
