/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'

export function useDocDetail(docId, onBack) {
  const [doc, setDoc] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [routings, setRoutings] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  // Modals state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [editForm, setEditForm] = useState(null)

  // PDF state
  const [pdfPage, setPdfPage] = useState(1)
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false)

  // Comments form state
  const [commentFiles, setCommentFiles] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const fileInputRef = useRef(null)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [docRes, deptRes, userRes] = await Promise.all([
        fetch(`/api/documents/${docId}`),
        fetch('/api/admin/departments'),
        fetch('/api/users'),
      ])

      if (docRes.ok) {
        const data = await docRes.json()
        setDoc(data)
        setEditForm(data)
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json()
        setDepartments(Array.isArray(deptData) ? deptData : [])
      }
      if (userRes.ok) {
        const userData = await userRes.json()
        setUsers(Array.isArray(userData) ? userData : [])
      }

      await Promise.all([fetchComments(), fetchRoutings()])
    } catch (error) {
      console.error('Failed to fetch document details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRoutings = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}/routings`)
      if (response.ok) {
        const data = await response.json()
        setRoutings(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch routings:', error)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    }
  }

  useEffect(() => {
    if (docId) {
      fetchData()

      const handleCommentEvent = (e) => {
        if (e.detail?.documentId === parseInt(docId)) {
          fetchComments()
        }
      }

      document.addEventListener('realtime:new_comment', handleCommentEvent)
      document.addEventListener('realtime:delete_comment', handleCommentEvent)
      document.addEventListener('realtime:comment_reaction', handleCommentEvent)

      return () => {
        document.removeEventListener('realtime:new_comment', handleCommentEvent)
        document.removeEventListener('realtime:delete_comment', handleCommentEvent)
        document.removeEventListener('realtime:comment_reaction', handleCommentEvent)
      }
    }
  }, [docId])

  const handleUpdateStatus = async (newStatus) => {
    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Đã chuyển trạng thái sang: ${newStatus}`)
        fetchData()
      } else {
        toast.error('Không thể cập nhật trạng thái.')
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ.')
    }
  }

  const handleRejectRouting = async (routingId, reason) => {
    if (!routingId) {
      toast.error('Không tìm thấy bản ghi luân chuyển của bạn.')
      return
    }
    try {
      const isAssignment = routingId === 'synthetic-root-assignee'
      const url = isAssignment
        ? `/api/documents/${docId}/reject-assignment`
        : `/api/routings/${routingId}/reject`

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ reason: reason || 'Không có lý do' }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast.success('Đã hủy tiếp nhận thành công.')
        setIsRejectModalOpen(false)
        setRejectReason('')
        await Promise.all([fetchRoutings(), fetchData()])
      } else {
        toast.error(data.message || 'Không thể hủy tiếp nhận.')
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ.')
    }
  }

  const executeDelete = async () => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Xóa văn bản thành công')
        onBack()
      } else {
        toast.error('Có lỗi xảy ra khi xóa văn bản')
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsDeleteModalOpen(false)
    }
  }

  const handleViewEvidence = async (path) => {
    try {
      const response = await fetch(`/api/documents/evidence-file?path=${encodeURIComponent(path)}`)
      if (response.ok) {
        const url = `/api/documents/evidence-file?path=${encodeURIComponent(path)}`
        const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
        if (isImg) {
          setPreviewImage(url)
        } else {
          window.open(url, '_blank')
        }
      } else {
        toast.error('Không có quyền xem file này hoặc file không tồn tại.')
      }
    } catch (error) {
      toast.error('Lỗi khi tải file bằng chứng.')
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    setIsSubmittingComment(true)
    try {
      const formData = new FormData()
      formData.append('content', newComment)

      if (commentFiles.length > 0) {
        commentFiles.forEach((file) => {
          formData.append('files', file)
        })
      }

      const response = await fetch(`/api/documents/${docId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })
      if (response.ok) {
        setNewComment('')
        setCommentFiles([])
        await fetchComments()
      } else {
        toast.error('Có lỗi xảy ra khi gửi bình luận.')
      }
    } catch (error) {
      console.error('Failed to post comment:', error)
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  return {
    doc,
    setDoc,
    comments,
    setComments,
    isLoading,
    activeTab,
    setActiveTab,
    departments,
    users,
    routings,
    previewImage,
    setPreviewImage,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isForwardModalOpen,
    setIsForwardModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isEvidenceModalOpen,
    setIsEvidenceModalOpen,
    isRejectModalOpen,
    setIsRejectModalOpen,
    rejectReason,
    setRejectReason,
    editForm,
    setEditForm,
    pdfPage,
    setPdfPage,
    isFullscreenPdf,
    setIsFullscreenPdf,
    fetchData,
    fetchRoutings,
    fetchComments,
    handleUpdateStatus,
    handleRejectRouting,
    executeDelete,
    handleViewEvidence,
    commentFiles,
    setCommentFiles,
    newComment,
    setNewComment,
    isSubmittingComment,
    handlePostComment,
    fileInputRef,
  }
}
