// features/tasks/hooks/useMyTasks.js
// Logic fetch, filter, paginate danh sách nhiệm vụ của cán bộ
import { useState, useEffect, useCallback, useMemo } from 'react'
import { DOCUMENT_STATUS, TASK_FILTER } from '@/constants/document'
import { toast } from 'sonner'

export function useMyTasks() {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ new: 0, doing: 0, overdue: 0, completed: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(TASK_FILTER.ALL)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  const calculateStats = useCallback((taskList) => {
    const now = new Date()
    let n = 0,
      d = 0,
      o = 0,
      c = 0
    taskList.forEach((task) => {
      const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null
      const isOverdue =
        deadline &&
        deadline < now &&
        !(task.status || '').toLowerCase().includes(DOCUMENT_STATUS.HOAN_THANH)
      const status = (task.status || '').toLowerCase()
      if (status.includes(DOCUMENT_STATUS.HOAN_THANH)) c++
      else if (isOverdue) o++
      else if (status.includes('đang xử lý')) d++
      else n++
    })
    setStats({ new: n, doing: d, overdue: o, completed: c })
  }, [])

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/documents/my-tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
        calculateStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [calculateStats])

  useEffect(() => {
    fetchTasks()
    const handleUpdate = () => fetchTasks()
    document.addEventListener('realtime:document_updated', handleUpdate)
    return () => document.removeEventListener('realtime:document_updated', handleUpdate)
  }, [fetchTasks])

  const acceptTask = useCallback(
    async (task) => {
      try {
        const res = await fetch(`/api/documents/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...task, status: DOCUMENT_STATUS.DANG_XU_LY }),
        })
        if (res.ok) {
          toast.success('Đã tiếp nhận văn bản')
          fetchTasks()
        }
      } catch {
        toast.error('Lỗi kết nối')
      }
    },
    [fetchTasks]
  )

  const filteredTasks = useMemo(() => {
    const now = new Date()
    return tasks.filter((task) => {
      const matchesSearch =
        task.soVanBan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.trichYeu?.toLowerCase().includes(searchQuery.toLowerCase())
      const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null
      const isOverdue =
        deadline &&
        deadline < now &&
        !(task.status || '').toLowerCase().includes(DOCUMENT_STATUS.HOAN_THANH)
      const status = (task.status || '').toLowerCase()
      if (statusFilter === TASK_FILTER.ALL) return matchesSearch
      if (statusFilter === TASK_FILTER.NEW)
        return (
          matchesSearch &&
          !status.includes('đang xử lý') &&
          !status.includes(DOCUMENT_STATUS.HOAN_THANH) &&
          !isOverdue
        )
      if (statusFilter === TASK_FILTER.DOING)
        return matchesSearch && status.includes('đang xử lý') && !isOverdue
      if (statusFilter === TASK_FILTER.OVERDUE) return matchesSearch && isOverdue
      if (statusFilter === TASK_FILTER.COMPLETED)
        return matchesSearch && status.includes(DOCUMENT_STATUS.HOAN_THANH)
      return matchesSearch
    })
  }, [tasks, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE)
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const setFilterAndReset = useCallback((filter) => {
    setStatusFilter(filter)
    setCurrentPage(1)
  }, [])
  const setSearchAndReset = useCallback((q) => {
    setSearchQuery(q)
    setCurrentPage(1)
  }, [])

  return {
    tasks: paginatedTasks,
    isLoading,
    stats,
    searchQuery,
    setSearchQuery: setSearchAndReset,
    statusFilter,
    setStatusFilter: setFilterAndReset,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    fetchTasks,
    acceptTask,
  }
}
