/* eslint-disable */
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export function useDocumentsList(filters) {
  const [documents, setDocuments] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState(filters?.status || '')
  const [sort, setSort] = useState(filters?.sort || 'newest')
  const [activeTab, setActiveTab] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, doc: null })

  useEffect(() => {
    if (filters) {
      if (filters.search !== undefined) {
        setSearch(filters.search)
        setDebouncedSearch(filters.search)
      }
      if (filters.status !== undefined) {
        setStatus(filters.status)
        if (!filters.sort) {
          if (filters.status === 'overdue' || filters.status === 'today') {
            setSort('deadline_asc')
          } else {
            setSort('newest')
          }
        }
      }
      if (filters.sort !== undefined) setSort(filters.sort)
      setPage(1)
    }
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== debouncedSearch) {
        setDebouncedSearch(search)
        setPage(1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search, debouncedSearch])

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(false)
    try {
      const url = `/api/documents?page=${page}&size=${pageSize}&search=${encodeURIComponent(debouncedSearch)}&status=${status}&sort=${sort}&activeTab=${activeTab}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)
      } else {
        throw new Error('API fetch failed')
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, debouncedSearch, status, sort, activeTab])

  useEffect(() => {
    fetchDocuments()
    const handleUpdate = () => fetchDocuments()
    document.addEventListener('realtime:document_updated', handleUpdate)
    return () => document.removeEventListener('realtime:document_updated', handleUpdate)
  }, [fetchDocuments])

  const executeDelete = useCallback(async () => {
    const doc = deleteConfirm.doc
    if (!doc) return

    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Đã xóa văn bản thành công')
        fetchDocuments()
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xóa')
    } finally {
      setDeleteConfirm({ open: false, doc: null })
    }
  }, [deleteConfirm.doc, fetchDocuments])

  return {
    documents,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalCount,
    isLoading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    sort,
    setSort,
    activeTab,
    setActiveTab,
    deleteConfirm,
    setDeleteConfirm,
    fetchDocuments,
    executeDelete,
  }
}
