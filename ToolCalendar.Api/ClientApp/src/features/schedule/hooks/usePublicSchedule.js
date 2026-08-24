/* eslint-disable */
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import * as signalR from '@microsoft/signalr'

export function usePublicSchedule() {
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

    const token = localStorage.getItem('auth_token')
    if (token && token !== 'undefined') {
      connectSignalR(token)
    }

    fetchSchedule()

    return () => {
      if (signalRRef.current) signalRRef.current.stop()
    }
  }, [])

  const handleViewDoc = async (docToken) => {
    const token = localStorage.getItem('auth_token')
    if (!token || token === 'undefined') {
      setPendingDocId(docToken)
      setIsLoginModalOpen(true)
      return
    }

    const toastId = toast.loading('Đang tải văn bản...')

    try {
      const response = await fetch(
        `/api/documents/public-file?token=${encodeURIComponent(docToken)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (response.ok) {
        const blob = await response.blob()
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
                window.addEventListener('load', function() {
                  setTimeout(function() { URL.revokeObjectURL('${blobUrl}'); }, 60000);
                });
              </script>
            </body>
            </html>
          `)
          pdfWindow.document.close()
        } else {
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
      document.cookie = 'jwt_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
      setUser(null)
      setIsLoggingOut(false)
    }, 1500)
  }

  return {
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
  }
}
