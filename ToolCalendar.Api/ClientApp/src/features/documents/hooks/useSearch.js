import { useState, useEffect, useCallback } from 'react'

export function useSearch(filters) {
  const [documents, setDocuments] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)

  // Search Filters
  const [search, setSearch] = useState(filters?.search || '')
  const [debouncedSearch, setDebouncedSearch] = useState(filters?.search || '')
  const [status, setStatus] = useState(filters?.status || '')
  const [fromDate, setFromDate] = useState(filters?.fromDate || '')
  const [toDate, setToDate] = useState(filters?.toDate || '')
  const [addFromDate, setAddFromDate] = useState(filters?.addFromDate || '')
  const [addToDate, setAddToDate] = useState(filters?.addToDate || '')
  const [sort, setSort] = useState(filters?.sort || 'newest')

  useEffect(() => {
    if (filters) {
      const newSearch = filters.search ?? ''
      const newStatus = filters.status ?? ''
      const newSort = filters.sort ?? 'newest'
      const newFrom = filters.fromDate ?? ''
      const newTo = filters.toDate ?? ''
      const newAddFrom = filters.addFromDate ?? ''
      const newAddTo = filters.addToDate ?? ''

      setSearch(newSearch)
      setDebouncedSearch(newSearch)
      setStatus(newStatus)
      setSort(newSort)
      setFromDate(newFrom)
      setToDate(newTo)
      setAddFromDate(newAddFrom)
      setAddToDate(newAddTo)
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
      let url = `/api/documents?page=${page}&size=${pageSize}&search=${encodeURIComponent(debouncedSearch)}&status=${status}&sort=${sort}`
      if (fromDate) url += `&fromDate=${fromDate}`
      if (toDate) url += `&toDate=${toDate}`
      if (addFromDate) url += `&addFromDate=${addFromDate}`
      if (addToDate) url += `&addToDate=${addToDate}`

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
  }, [page, pageSize, debouncedSearch, status, sort, fromDate, toDate, addFromDate, addToDate])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

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
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    addFromDate,
    setAddFromDate,
    addToDate,
    setAddToDate,
    sort,
    setSort,
    fetchDocuments,
  }
}
