/* eslint-disable */
import React from 'react'
import { MessageSquare, Paperclip, X, Image, Send, Loader2, Heart, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const REACTION_EMOJIS = {
  like: '👍',
  love: '❤️',
  clap: '👏',
  seen: '👀',
}

export function DocComments({
  comments,
  commentFiles,
  setCommentFiles,
  newComment,
  setNewComment,
  isSubmittingComment,
  handlePostComment,
  handleReact,
  fileInputRef,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.7)] animate-pulse shrink-0" />
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest truncate">
            THẢO LUẬN
          </h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200 shrink-0">
          {comments.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {comments.length > 0 ? (
          comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-2.5 group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-red-100">
                  {c.username.substring(0, 1).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                    {c.username}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    {new Date(c.createdAt).toLocaleTimeString('vi-VN')}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none group-hover:bg-white group-hover:shadow-xl group-hover:border-slate-200 transition-all duration-500">
                <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                  "{c.content}"
                </p>

                {/* Hiển thị file đính kèm */}
                {c.attachmentPaths && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {(() => {
                      try {
                        const paths = JSON.parse(c.attachmentPaths)
                        if (!Array.isArray(paths) || paths.length === 0) return null
                        return paths.map((path, pIdx) => {
                          const fileName = path.split('/').pop()
                          const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
                          return (
                            <a
                              key={pIdx}
                              href={`/api/documents/comment-attachment?path=${encodeURIComponent(path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-red-600 hover:border-red-500 hover:bg-red-50 transition-all uppercase"
                            >
                              {isImg ? <Image size={10} /> : <Paperclip size={10} />}
                              <span className="max-w-[100px] truncate">{fileName}</span>
                            </a>
                          )
                        })
                      } catch (e) {
                        return null
                      }
                    })()}
                  </div>
                )}

                {/* Reactions */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {/* Nút Thích (có popover hover) */}
                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-black transition-all">
                      <ThumbsUp size={14} /> Thích
                    </button>
                    {/* Popover chứa emojis */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex items-center gap-1 bg-white border border-slate-200 shadow-xl rounded-full p-1.5 z-10 transition-all origin-bottom-left animate-in fade-in zoom-in-95 duration-200">
                      {Object.keys(REACTION_EMOJIS).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleReact && handleReact(c.id, type)}
                          className="p-1.5 hover:bg-slate-100 rounded-full transition-transform hover:scale-125 origin-bottom"
                          title={type}
                        >
                          <span className="text-2xl leading-none block">
                            {REACTION_EMOJIS[type]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hiển thị danh sách người đã react */}
                  <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                    {Object.keys(REACTION_EMOJIS).map((type) => {
                      const count = c.reactions?.[type]?.count || 0
                      if (count === 0) return null
                      return (
                        <div
                          key={type}
                          className="flex items-center bg-slate-50 border border-slate-100 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-black text-slate-600"
                        >
                          <span className="text-xs mr-1">{REACTION_EMOJIS[type]}</span> {count}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 opacity-30">
            <div className="p-6 rounded-full bg-slate-100 mb-5">
              <MessageSquare size={40} strokeWidth={2} className="text-slate-400" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center leading-loose">
              CHƯA CÓ{' '}
              {localStorage.getItem('user_role') === 'LanhDao' ? 'Ý KIẾN CHỈ ĐẠO' : 'Ý KIẾN'}
              <br />
              NÀO ĐƯỢC GHI NHẬN
            </p>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-inner focus-within:border-red-300 focus-within:ring-8 focus-within:ring-red-50 transition-all duration-500">
          {commentFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2">
              {commentFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600"
                >
                  <Paperclip size={10} className="text-slate-400" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    onClick={() => setCommentFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              localStorage.getItem('user_role') === 'LanhDao'
                ? 'Nhập ý kiến chỉ đạo...'
                : 'Nhập nội dung thảo luận...'
            }
            rows={2}
            className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder-slate-400 resize-none outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
            <input
              type="file"
              multiple
              hidden
              ref={fileInputRef}
              onChange={(e) => {
                const files = Array.from(e.target.files)
                setCommentFiles((prev) => [...prev, ...files])
                e.target.value = null // Reset to allow same file again
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Paperclip size={20} />
            </button>
            <button
              onClick={handlePostComment}
              disabled={isSubmittingComment || !newComment.trim()}
              className={cn(
                'flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                newComment.trim()
                  ? 'bg-red-600 text-white shadow-2xl shadow-red-200 hover:bg-red-700 hover:-translate-y-1 active:translate-y-0'
                  : 'bg-slate-200 text-slate-400'
              )}
            >
              {isSubmittingComment ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              GỬI Ý KIẾN
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
