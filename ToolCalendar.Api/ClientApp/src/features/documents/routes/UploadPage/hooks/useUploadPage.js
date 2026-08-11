/* eslint-disable */
import { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ROLES } from '@/constants/roles'
import { toast } from 'sonner'
import { useDocumentUploadContext } from '../../../contexts/DocumentUploadContext'

export function useUploadPage() {
  const uploadContext = useDocumentUploadContext()
  const { batchItems, setBatchItems } = uploadContext

  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewItem, setReviewItem] = useState(null)
  const [pdfPage, setPdfPage] = useState(1)
  const [pdfPageCount, setPdfPageCount] = useState(1)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deleteItemConfirm, setDeleteItemConfirm] = useState({ open: false, item: null })
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/departments')
      .then((r) => r.ok && r.json())
      .then((d) => d && setDepartments(d))
      .catch(() => {})
    fetch('/api/users')
      .then((r) => r.ok && r.json())
      .then(
        (d) => d && setUsers(d.filter((u) => u.role === ROLES.CAN_BO || u.role === ROLES.ADMIN))
      )
      .catch(() => {})
  }, [])

  const fetchPdfBlob = async (docId) => {
    setIsPdfLoading(true)
    setPdfBlobUrl(null)
    setPdfPageCount(1)
    try {
      const res = await fetch(`/api/documents/${docId}/file`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        setPdfPageCount(pdfDoc.getPageCount())
      } catch (err) {
        console.warn('Failed to parse PDF page count', err)
      }

      setPdfBlobUrl(URL.createObjectURL(blob))
    } catch {
      toast.error('Không thể tải file PDF')
    } finally {
      setIsPdfLoading(false)
    }
  }

  const updateItem = (id, field, value) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const handleDeleteItem = async () => {
    const item = deleteItemConfirm.item
    if (item && typeof item.id === 'number') {
      try {
        await fetch(`/api/documents/${item.id}`, { method: 'DELETE' })
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
    setBatchItems((prev) => prev.filter((i) => i.id !== item?.id))
    setDeleteItemConfirm({ open: false, item: null })
    toast.success('Đã gỡ bỏ văn bản')
  }

  return {
    ...uploadContext,
    departments,
    users,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewItem,
    setReviewItem,
    pdfPage,
    setPdfPage,
    pdfPageCount,
    pdfBlobUrl,
    setPdfBlobUrl,
    isPdfLoading,
    setIsPdfLoading,
    showClearConfirm,
    setShowClearConfirm,
    deleteItemConfirm,
    setDeleteItemConfirm,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isBulkDeleting,
    setIsBulkDeleting,
    fetchPdfBlob,
    updateItem,
    handleDeleteItem,
  }
}
