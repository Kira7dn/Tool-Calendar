/* eslint-disable */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'

const DocumentUploadContext = createContext(null)

export function DocumentUploadProvider({ children }) {
  const [isDragging, setIsDragging] = useState(false)
  const [batchItems, setBatchItems] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentFileName, setCurrentFileName] = useState('')

  useEffect(() => {
    const handleOcrProgress = async (e) => {
      const { docId, status } = e.detail

      if (status !== DOCUMENT_STATUS.DANG_XU_LY) {
        try {
          const res = await fetch(`/api/documents/${docId}`)
          if (res.ok) {
            const u = await res.json()
            setBatchItems((prev) =>
              prev.map((b) =>
                b.id === docId
                  ? {
                      ...b,
                      soVanBan: u.soVanBan || '',
                      trichYeu: u.trichYeu || '',
                      coQuanBanHanh: u.coQuanBanHanh || '',
                      coQuanChuQuan: u.coQuanChuQuan || '',
                      ngayBanHanh: u.ngayBanHanh ? u.ngayBanHanh.split('T')[0] : '',
                      thoiHan: u.thoiHan ? u.thoiHan.split('T')[0] : '',
                      departmentIds: u.departmentId ? [u.departmentId] : [],
                      assignedToIds: u.assignedTo ? [u.assignedTo] : [],
                      status: u.status === DOCUMENT_STATUS.LOI_OCR ? 'error' : 'ready',
                    }
                  : b
              )
            )
          }
        } catch {
          /* ignore */
        }
      }
    }

    document.addEventListener('realtime:ocr_progress', handleOcrProgress)
    return () => {
      document.removeEventListener('realtime:ocr_progress', handleOcrProgress)
    }
  }, [])

  const handleFileUpload = async (fileList) => {
    if (!fileList.length) return
    setIsProcessing(true)
    setOverallProgress(0)
    const MAX_CONCURRENT = 8
    let completedCount = 0
    const total = fileList.length
    const newItems = Array.from(fileList).map((file, i) => ({
      id: `temp-${Date.now()}-${i}`,
      fileName: file.name,
      soVanBan: '',
      trichYeu: '',
      coQuanBanHanh: '',
      coQuanChuQuan: '',
      ngayBanHanh: '',
      thoiHan: '',
      departmentIds: [],
      assignedToIds: [],
      status: 'processing',
      _tempFile: file,
    }))
    setBatchItems((prev) => [...newItems, ...prev])
    setCurrentFileName(`Đang xử lý ${total} file...`)

    const uploadOne = async (item) => {
      const formData = new FormData()
      formData.append('file', item._tempFile)
      try {
        const response = await fetch('/api/documents/upload', { method: 'POST', body: formData })
        if (response.ok) {
          const doc = await response.json()
          const mapped = {
            ...item,
            _tempFile: undefined,
            id: doc.id,
            soVanBan: doc.soVanBan || '',
            trichYeu: doc.trichYeu || '',
            coQuanBanHanh: doc.coQuanBanHanh || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            ngayBanHanh: doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            departmentIds: doc.departmentId ? [doc.departmentId] : [],
            assignedToIds: doc.assignedTo ? [doc.assignedTo] : [],
            filePath: doc.filePath || '',
            status:
              doc.status === DOCUMENT_STATUS.DANG_XU_LY
                ? 'processing'
                : doc.status === DOCUMENT_STATUS.LOI_OCR
                  ? 'error'
                  : 'ready',
          }
          setBatchItems((prev) => prev.map((b) => (b.id === item.id ? mapped : b)))
          setBatchItems((prev) =>
            prev.map((b) =>
              b.id === item.id ? { ...b, status: 'error', _tempFile: undefined } : b
            )
          )
        }
      } catch {
        setBatchItems((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, status: 'error', _tempFile: undefined } : b))
        )
      } finally {
        completedCount++
        setOverallProgress(Math.round((completedCount / total) * 100))
        setCurrentFileName(
          total - completedCount > 0 ? `Còn ${total - completedCount} file đang xử lý...` : ''
        )
      }
    }

    const uploadQueue = [...newItems]
    await Promise.all(
      Array.from({ length: MAX_CONCURRENT }, async () => {
        while (uploadQueue.length > 0) {
          const item = uploadQueue.shift()
          if (item) await uploadOne(item)
        }
      })
    )
    setOverallProgress(100)
    setTimeout(() => {
      setIsProcessing(false)
      setCurrentFileName('')
    }, 800)
  }

  const value = {
    isDragging,
    setIsDragging,
    batchItems,
    setBatchItems,
    isProcessing,
    setIsProcessing,
    overallProgress,
    setOverallProgress,
    currentFileName,
    setCurrentFileName,
    handleFileUpload,
  }

  return <DocumentUploadContext.Provider value={value}>{children}</DocumentUploadContext.Provider>
}

export function useDocumentUploadContext() {
  const context = useContext(DocumentUploadContext)
  if (!context) {
    throw new Error('useDocumentUploadContext must be used within a DocumentUploadProvider')
  }
  return context
}
