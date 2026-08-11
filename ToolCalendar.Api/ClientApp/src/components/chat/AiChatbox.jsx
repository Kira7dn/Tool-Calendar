import { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Bot, Send, X, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function AiChatbox({ currentDocId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/chat/history')
        if (response.ok) {
          const result = await response.json()
          if (result.data && result.data.length > 0) {
            setMessages(
              result.data.map((msg) => ({
                id: msg.id.toString(),
                role: msg.role,
                content: msg.content,
                timestamp: msg.createdAt,
              }))
            )
          } else {
            // Không có lịch sử, tạo câu chào mặc định
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
          }
        }
      } catch (error) {
        console.error('Failed to fetch chat history:', error)
      }
    }

    // Chỉ fetch khi mở box lần đầu và chưa có tin nhắn nào
    if (isOpen && messages.length === 0) {
      fetchHistory()
    }
  }, [isOpen, messages.length])

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

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!message.trim() || isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
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
      const result = await response.json()

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.data?.reply || 'Tôi đã tiếp nhận yêu cầu của bạn.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
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

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110',
          'bg-gradient-to-r from-red-700 to-red-600 text-white',
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        )}
      >
        <Bot className="w-8 h-8" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 w-[350px] sm:w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 transform origin-bottom-right flex flex-col border border-slate-100',
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        )}
        style={{ height: '500px', maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-600 p-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                Trợ lý AI
                {currentDocId && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-medium animate-pulse">
                    📄 Đang đọc văn bản
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-red-100">Luôn sẵn sàng hỗ trợ</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Xóa lịch sử trò chuyện"
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-2 max-w-[85%]',
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-red-700" />
                </div>
              )}
              <div
                className={cn(
                  'p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm',
                  msg.role === 'user'
                    ? 'bg-red-700 text-white rounded-br-sm'
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end gap-2 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-red-700" />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-100 rounded-bl-sm shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100">
          <div className="relative flex items-center">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhắc tôi lúc 15h kiểm tra công văn..."
              className="w-full bg-slate-100 text-slate-700 text-sm rounded-full pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-red-600/50 transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="absolute right-2 p-2 bg-red-700 text-white rounded-full hover:bg-red-800 disabled:opacity-50 disabled:hover:bg-red-700 transition-colors"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

AiChatbox.propTypes = {
  currentDocId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}
