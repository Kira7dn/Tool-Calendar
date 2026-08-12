/* global TextDecoder */
import PropTypes from 'prop-types'
import { useState, useRef, useEffect } from 'react'
import { Bot, X, Maximize2, Minimize2, Lightbulb, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function AiChatbox({ currentDocId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMoved, setIsMoved] = useState(false)
  const dragInfo = useRef({ isDown: false, startX: 0, startY: 0, initialX: 0, initialY: 0 })

  const handlePointerDown = (e) => {
    dragInfo.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    }
    setIsDragging(true)
    setIsMoved(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!dragInfo.current.isDown) return
    const dx = e.clientX - dragInfo.current.startX
    const dy = e.clientY - dragInfo.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setIsMoved(true)
    }
    setPosition({
      x: dragInfo.current.initialX + dx,
      y: dragInfo.current.initialY + dy,
    })
  }

  const handlePointerUp = (e) => {
    dragInfo.current.isDown = false
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const handleClick = (e) => {
    if (isMoved) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    setIsOpen(true)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Hiển thị tin chào ngay khi mở box lần đầu
  useEffect(() => {
    if (!isOpen) return

    const role = localStorage.getItem('user_role') || ''
    const isAdmin = role === 'Admin' || role === 'LanhDao'
    const welcomeMsg = {
      id: 'welcome',
      role: 'assistant',
      content: isAdmin
        ? 'Dạ vâng ạ, Em chào Sếp! 🫡 Sếp cần em tóm tắt công văn, nhắc việc, hay hỏi gì cứ nhắn em ạ!'
        : 'Chào đồng chí! 👋 Tôi là Trợ lý AI. Đồng chí cần hỗ trợ nghiệp vụ hay nhắc việc gì cứ nhắn tôi nhé!',
      timestamp: new Date().toISOString(),
    }

    setMessages([welcomeMsg])

    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/chat/history')
        if (response.ok) {
          const result = await response.json()
          if (Array.isArray(result) && result.length > 0) {
            setMessages(
              result.map((msg) => ({
                id: msg.id.toString(),
                role: msg.role,
                content: msg.content,
                timestamp: msg.createdAt,
              }))
            )
          }
        }
      } catch (error) {
        console.error('Failed to fetch chat history:', error)
      }
    }

    fetchHistory()
  }, [isOpen])

  const handleClearHistory = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử chat và làm mới phiên làm việc của AI?'))
      return

    try {
      await fetch('/api/chat/history', { method: 'DELETE' })
      const role = localStorage.getItem('user_role') || ''
      const isAdmin = role === 'Admin' || role === 'LanhDao'
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: isAdmin
            ? 'Dạ vâng ạ, Em chào sếp. Sếp cần em hỗ trợ hay nhắc việc gì cứ nhắn em nhé!'
            : 'Chào đồng chí, tôi là Trợ lý AI. Đồng chí cần hỗ trợ gì cứ nhắn tôi nhé!',
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  const handleSend = async (e, text = message) => {
    e?.preventDefault()
    if (!text.trim() || isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, documentId: currentDocId }),
      })

      if (!response.ok) throw new Error('Lỗi kết nối máy chủ')

      setIsLoading(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let assistantContent = ''
      const assistantId = (Date.now() + 1).toString()

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        },
      ])

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const chunk of parts) {
          if (chunk.startsWith('data: ')) {
            const dataStr = chunk.slice(6)
            if (dataStr.trim()) {
              try {
                const dataObj = JSON.parse(dataStr)
                assistantContent += dataObj.text || ''
                const displayContent = assistantContent
                  .replace(/\[REMINDER\|.*?\|.*?\]/g, '')
                  .trim()

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: displayContent } : msg
                  )
                )
              } catch (e) {
                console.error('Lỗi parse JSON stream:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Xin lỗi, tôi đang gặp sự cố khi xử lý yêu cầu của bạn.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const suggestions = [
    'Tóm tắt cho tôi công văn này',
    'Hôm nay có bao nhiêu văn bản quá hạn',
    'Nhắc tôi 5 phút nữa đi họp',
    'Giải quyết, phê duyệt phân tích từ các phòng ban',
  ]

  return (
    <>
      {/* Floating Button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) ${isOpen ? 'scale(0)' : 'scale(1)'}`,
          touchAction: 'none',
        }}
        className={cn(
          'fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-[0_0_20px_rgba(251,146,60,0.4)] transition-all',
          !isDragging && 'duration-300 hover:scale-110',
          'bg-[#1c3a6b] text-white overflow-hidden',
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
        <Bot className="w-8 h-8 pointer-events-none relative z-10 animate-[bounce_3s_infinite]" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          'fixed z-50 bg-slate-50/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 transform origin-bottom-right flex flex-col border border-slate-200/50',
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none',
          isExpanded
            ? 'bottom-[5vh] right-[5vw] w-[90vw] h-[90vh] sm:bottom-[10vh] sm:right-[10vw] sm:w-[80vw] sm:h-[80vh] max-w-[1000px]'
            : 'bottom-6 right-6 w-[400px] h-[600px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)]'
        )}
      >
        {/* Header */}
        <div className="bg-slate-100/80 backdrop-blur-sm p-4 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-blue-700 shadow-sm border border-slate-100">
              AI
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#1c3a6b] text-base flex items-center gap-2 truncate">
                Trợ lý AI
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Trợ lý thông minh, nhanh nội dung điện tử...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              title="Gợi ý câu hỏi"
              className={cn(
                'p-2 rounded-full shadow-sm transition-colors',
                showSuggestions
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              )}
            >
              <Lightbulb className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearHistory}
              title="Xóa lịch sử trò chuyện"
              className="p-2 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full shadow-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
              className="p-2 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-full shadow-sm transition-colors flex items-center gap-1"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {!isExpanded && <span className="text-xs font-medium pr-1">Mở rộng</span>}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-full shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
          {(messages.length <= 1 || showSuggestions) && (
            <div className="flex flex-col items-center justify-center my-6 space-y-2">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  onClick={(e) => {
                    handleSend(e, sug)
                    setShowSuggestions(false)
                  }}
                  className="px-4 py-2 text-sm text-[#1c3a6b] bg-white border border-[#1c3a6b]/30 rounded-full hover:bg-blue-50 transition-colors max-w-[80%] truncate shadow-sm"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-2',
                isExpanded ? 'max-w-[70%]' : 'max-w-[85%]',
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
                  <span className="text-xs font-bold text-blue-700">AI</span>
                </div>
              )}
              <div
                className={cn(
                  'p-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm',
                  msg.role === 'user'
                    ? 'bg-[#1c3a6b] text-white rounded-br-sm'
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end gap-2 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
                <span className="text-xs font-bold text-blue-700">AI</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-100 rounded-bl-sm shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Warning Text */}
        <div className="bg-slate-50/50 py-2 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <span className="text-yellow-500">⚠️</span> Trợ lý AI là AI và có thể trả lời không
            chính xác.
          </p>
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => handleSend(e, message)}
          className="p-4 bg-white border-t border-slate-200"
        >
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập câu hỏi..."
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-full pl-5 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#1c3a6b]/20 focus:border-[#1c3a6b]/50 transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="px-6 py-3 bg-[#1c3a6b] text-white text-sm font-medium rounded-full hover:bg-[#152b52] disabled:opacity-50 disabled:hover:bg-[#1c3a6b] transition-colors shadow-md flex items-center gap-2"
            >
              Gửi
            </button>
          </div>
        </form>
      </div>

      {/* Thêm CSS cho shimmer animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `,
        }}
      />
    </>
  )
}

AiChatbox.propTypes = {
  currentDocId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}
