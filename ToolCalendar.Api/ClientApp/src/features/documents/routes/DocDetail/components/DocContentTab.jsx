/* eslint-disable */
import React, { useState, useCallback } from 'react'

// Icon map cho từng domain nguồn
const SOURCE_ICONS = {
  'thuvienphapluat.vn': '⚖️',
  'vanban.chinhphu.vn': '🏛️',
  'chinhphu.vn': '🇻🇳',
  'moj.gov.vn': '📜',
  'quangninh.gov.vn': '🗺️',
  'scholar.google.com': '🎓',
  default: '🔗',
}

function ReferenceCard({ item }) {
  const icon = SOURCE_ICONS[item.source] ?? SOURCE_ICONS.default
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 hover:border-blue-500/60 transition-all duration-200 p-4 no-underline"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-1 truncate">
            {item.source}
          </p>
          <p className="text-slate-200 text-[12px] font-semibold leading-snug mb-2 line-clamp-2 group-hover:text-white transition-colors">
            {item.title}
          </p>
          {item.snippet && item.snippet !== item.title && (
            <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">
              {item.snippet}
            </p>
          )}
          <p className="text-blue-500 text-[10px] mt-2 truncate group-hover:text-blue-400">
            {item.url}
          </p>
        </div>
      </div>
    </a>
  )
}

export function DocContentTab({ doc, docId, pdfUrl, setIsFullscreenPdf }) {
  const [refState, setRefState] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [references, setReferences] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  const handleFindReferences = useCallback(async () => {
    setRefState('loading')
    setReferences([])
    setErrorMsg('')
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/documents/${docId}/references`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setReferences(json.data)
        setRefState('done')
      } else {
        setErrorMsg(json.message || 'Không tìm thấy kết quả.')
        setRefState('error')
      }
    } catch {
      setErrorMsg('Lỗi kết nối. Vui lòng thử lại.')
      setRefState('error')
    }
  }, [docId])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] lg:h-full animate-in fade-in zoom-in-95 duration-400">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
          Văn bản và tài liệu tham khảo
        </h2>
        <div className="flex items-center gap-3">
          {/* Nút Xử lý lại OCR — giữ nhỏ, ít nổi bật */}
          <button
            id="btn-reprocess-ocr"
            onClick={async () => {
              const btn = document.getElementById('btn-reprocess-ocr')
              btn.disabled = true
              btn.textContent = 'Đang OCR...'
              try {
                const token = localStorage.getItem('auth_token')
                await fetch(`/api/documents/${docId}/reprocess-ocr`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                })
                btn.textContent = 'Đang chờ...'
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
                    btn.textContent = 'OCR lại'
                  }
                }, 4000)
              } catch {
                btn.disabled = false
                btn.textContent = 'OCR lại'
              }
            }}
            className="text-[9px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            OCR lại
          </button>
          <button
            className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-widest"
            onClick={() => {
              const token = localStorage.getItem('auth_token')
              document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
              if (window.innerWidth < 768) setIsFullscreenPdf(true)
              else window.open(`/api/documents/${docId}/file`, '_blank')
            }}
          >
            Toàn màn hình
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* PDF viewer */}
        <div className="flex-1 bg-slate-100/50 border-r border-slate-100 relative">
          <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
        </div>

        {/* Panel phải: AI References */}
        <div className="w-full md:w-80 shrink-0 bg-slate-900 flex flex-col overflow-hidden">
          {/* Sub-header */}
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Tài liệu tham khảo
            </p>
            <button
              id="btn-find-refs"
              onClick={handleFindReferences}
              disabled={refState === 'loading'}
              className="text-[9px] font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              {refState === 'loading' ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang tìm...
                </>
              ) : (
                '🔍 Tìm kiếm'
              )}
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {/* Idle state */}
            {refState === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                <span className="text-4xl opacity-60">🤖</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  AI sẽ đọc nội dung văn bản và tìm các tài liệu pháp lý liên quan từ{' '}
                  <span className="text-blue-400">thuvienphapluat.vn</span>,{' '}
                  <span className="text-blue-400">chinhphu.vn</span> và các nguồn uy tín khác.
                </p>
                <p className="text-slate-600 text-[10px]">Nhấn 🔍 Tìm kiếm để bắt đầu</p>
              </div>
            )}

            {/* Loading state */}
            {refState === 'loading' && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-slate-400 text-[11px] text-center">
                  AI đang phân tích nội dung văn bản
                  <br />
                  và tìm kiếm tài liệu tham khảo...
                </p>
                <p className="text-slate-600 text-[10px]">(Có thể mất 15-30 giây)</p>
              </div>
            )}

            {/* Error state */}
            {refState === 'error' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                <span className="text-3xl">⚠️</span>
                <p className="text-red-400 text-[11px]">{errorMsg}</p>
                <button
                  onClick={handleFindReferences}
                  className="text-[9px] font-bold px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg uppercase tracking-widest transition-colors"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Results */}
            {refState === 'done' && references.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                <span className="text-3xl">🔍</span>
                <p className="text-slate-400 text-[11px]">
                  Không tìm thấy tài liệu tham khảo phù hợp.
                </p>
              </div>
            )}

            {refState === 'done' && references.length > 0 && (
              <>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {references.length} tài liệu được tìm thấy
                </p>
                {references.map((item, idx) => (
                  <ReferenceCard key={idx} item={item} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
