/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { documentApi } from '../api/documentApi'

export function useDocumentUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [batchItems, setBatchItems] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentFileName, setCurrentFileName] = useState('')

  const handleFileUpload = useCallback(async (fileList) => {
    if (!fileList.length) return
    setIsProcessing(true)
    setOverallProgress(0)

    const MAX_CONCURRENT = 8
    let completedCount = 0
    const total = fileList.length

    const newItems = Array.from(fileList).map((file, i) => ({
      id: `temp-${Date.now()}-${i}`,
      fileName: file.name,
      status: 'processing',
      _tempFile: file,
    }))

    setBatchItems((prev) => [...newItems, ...prev])
    setCurrentFileName(`Đang xử lý ${total} file...`)

    const uploadOne = async (item) => {
      try {
        const doc = await documentApi.uploadFile(item._tempFile)
        setBatchItems((prev) =>
          prev.map((b) =>
            b.id === item.id
              ? {
                  ...b,
                  ...doc,
                  id: doc.id,
                  _tempFile: undefined,
                  status: doc.status === 'Đang xử lý' ? 'processing' : 'ready',
                }
              : b
          )
        )
      } catch (err) {
        setBatchItems((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, status: 'error', _tempFile: undefined } : b))
        )
      } finally {
        completedCount++
        setOverallProgress(Math.round((completedCount / total) * 100))
        const remaining = total - completedCount
        setCurrentFileName(remaining > 0 ? `Còn ${remaining} file đang xử lý...` : '')
      }
    }

    const uploadQueue = [...newItems]
    const workers = Array.from({ length: MAX_CONCURRENT }, async () => {
      while (uploadQueue.length > 0) {
        const item = uploadQueue.shift()
        if (item) await uploadOne(item)
      }
    })

    await Promise.all(workers)

    setOverallProgress(100)
    setTimeout(() => {
      setIsProcessing(false)
      setCurrentFileName('')
    }, 800)
  }, [])

  return {
    isDragging,
    setIsDragging,
    batchItems,
    setBatchItems,
    isProcessing,
    overallProgress,
    currentFileName,
    handleFileUpload,
  }
}
