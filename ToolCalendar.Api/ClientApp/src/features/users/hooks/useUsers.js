/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, user: null })

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        setUsers(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/departments')
      if (response.ok) {
        setDepartments(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchDepartments()
  }, [fetchUsers, fetchDepartments])

  const handleDeleteUser = useCallback((user) => {
    if (user.username === 'admin') {
      toast.error('Không thể xóa tài khoản Quản trị cấp cao (admin)')
      return
    }
    setDeleteConfirm({ open: true, user })
  }, [])

  const executeDelete = useCallback(async () => {
    const user = deleteConfirm.user
    if (!user) return

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success(`Đã xóa người dùng ${user.fullName}`)
        fetchUsers()
      }
    } catch (e) {
      toast.error('Có lỗi xảy ra khi xóa')
    } finally {
      setDeleteConfirm({ open: false, user: null })
    }
  }, [deleteConfirm.user, fetchUsers])

  const removeVietnameseTones = (str) => {
    if (!str) return ''
    str = str.toLowerCase()
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i')
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
    str = str.replace(/đ/g, 'd')
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '')
    str = str.replace(/\u02C6|\u0306|\u031B/g, '')
    return str.trim()
  }

  const filteredUsers = useMemo(() => {
    const searchTerm = removeVietnameseTones(search)
    return users.filter((user) => {
      const name = removeVietnameseTones(user.fullName)
      const uname = removeVietnameseTones(user.username)
      const mail = removeVietnameseTones(user.email)
      return name.includes(searchTerm) || uname.includes(searchTerm) || mail.includes(searchTerm)
    })
  }, [users, search])

  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [filteredUsers, currentPage, pageSize])

  const setSearchAndReset = useCallback((val) => {
    setSearch(val)
    setCurrentPage(1)
  }, [])

  const setPageSizeAndReset = useCallback((val) => {
    setPageSize(val)
    setCurrentPage(1)
  }, [])

  return {
    users: paginatedUsers,
    departments,
    isLoading,
    search,
    setSearch: setSearchAndReset,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize: setPageSizeAndReset,
    totalPages,
    deleteConfirm,
    setDeleteConfirm,
    handleDeleteUser,
    executeDelete,
    fetchUsers,
  }
}
