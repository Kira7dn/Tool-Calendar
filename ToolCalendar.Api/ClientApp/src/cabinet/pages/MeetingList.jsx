/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Download,
  Search,
  Filter,
  RefreshCw,
  Calendar as CalendarIcon,
  Eye,
  MoreVertical,
  User,
  UserCheck,
  UserX,
  FileText,
  Inbox,
  CheckCircle2,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MeetingDetail } from './MeetingDetail'
import { MeetingProgress } from './MeetingProgress'
import { MeetingModal } from '../components/MeetingModal'

const AUTH_HEADER = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
})

const getStatusBadge = (status) => {
  switch (status) {
    case 'Tham gia':
    case 'Đã xử lý':
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-full text-xs">
          Tham gia
        </span>
      )
    case 'Chưa xác nhận':
    case 'Chưa xử lý':
      return (
        <span className="px-3 py-1 bg-orange-100 text-orange-700 font-semibold rounded-full text-xs">
          Chưa xác nhận
        </span>
      )
    case 'Vắng mặt':
      return (
        <span className="px-3 py-1 bg-red-100 text-red-700 font-semibold rounded-full text-xs">
          Vắng mặt
        </span>
      )
    default:
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-full text-xs">
          Tham gia
        </span>
      )
  }
}

export function MeetingList() {
  const [activeTab, setActiveTab] = useState('invited') // 'invited' | 'prepare'
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [showProgress, setShowProgress] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const fetchMeetings = (tab = activeTab) => {
    setLoading(true)
    let isAdminUser = false
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const role =
          payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
          payload.role ||
          payload.Role
        if (role === 'Admin' || role === 'LanhDao') isAdminUser = true
      }
    } catch {}

    const url =
      isAdminUser && tab === 'all'
        ? '/api/phonghopkhonggiayto/meetings/schedule'
        : '/api/phonghopkhonggiayto/meetings/my-meetings'

    fetch(url, { headers: AUTH_HEADER() })
      .then((r) => r.json())
      .then((json) => {
        const data = Array.isArray(json) ? json : json.data || []
        if (Array.isArray(data)) {
          const mappedData = data.map((m) => ({
            ...m,
            // Lấy trạng thái tham dự thực từ participants[0] trả về bởi backend
            attendanceStatus: m.participants?.[0]?.attendanceStatus ?? 'Chưa xác nhận',
          }))
          setMeetings(mappedData)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handleDeleteMeeting = (id) => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn xóa phiên họp này không? Hành động này không thể hoàn tác.'
      )
    ) {
      return
    }

    fetch(`/api/phonghopkhonggiayto/meetings/${id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER(),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          fetchMeetings(activeTab)
        } else {
          alert('Có lỗi xảy ra: ' + (res.message || 'Không thể xóa phiên họp.'))
        }
      })
      .catch((err) => {
        alert('Lỗi kết nối máy chủ.')
      })
  }

  useEffect(() => {
    fetchMeetings(activeTab)
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const role =
          payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
          payload.role ||
          payload.Role
        if (role === 'Admin' || role === 'LanhDao') {
          setIsAdmin(true)
        }
      }
    } catch {}
  }, [activeTab])

  const filteredMeetings = meetings.filter((m) =>
    m.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const paginatedMeetings = filteredMeetings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalPages = Math.ceil(filteredMeetings.length / pageSize)

  console.log('MeetingList render:', { selectedMeeting, showProgress })

  if (selectedMeeting) {
    if (showProgress) {
      console.log('Rendering MeetingProgress')
      return <MeetingProgress meeting={selectedMeeting} onBack={() => setShowProgress(false)} />
    }
    console.log('Rendering MeetingDetail')
    return (
      <MeetingDetail
        meeting={selectedMeeting}
        onBack={() => setSelectedMeeting(null)}
        onViewProgress={() => {
          console.log('onViewProgress triggered!')
          setShowProgress(true)
        }}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200 shrink-0">
          <h1 className="text-xl font-bold text-[#1a202c]">Quản lý phiên họp</h1>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#c8102e] hover:bg-[#a50e27] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tạo phiên họp
              </Button>
            )}
            <Button variant="outline" className="text-[#c8102e] border-[#c8102e] hover:bg-red-50">
              <Download className="w-4 h-4 mr-2" />
              Xuất file
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* Sub Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('invited')}
                className={`flex-1 pb-3 text-center font-semibold text-sm transition-colors border-b-2 ${
                  activeTab === 'invited'
                    ? 'border-[#c8102e] text-[#c8102e]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Phiên họp cá nhân được mời
              </button>
              <button
                onClick={() => setActiveTab('prepare')}
                className={`flex-1 pb-3 text-center font-semibold text-sm transition-colors border-b-2 ${
                  activeTab === 'prepare'
                    ? 'border-[#c8102e] text-[#c8102e]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Phiên họp cần chuẩn bị tài liệu
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 pb-3 text-center font-semibold text-sm transition-colors border-b-2 ${
                    activeTab === 'all'
                      ? 'border-[#c8102e] text-[#c8102e]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Tất cả phiên họp
                </button>
              )}
            </div>

            {/* Stats Cards */}
            {activeTab !== 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {activeTab === 'invited' ? (
                  <>
                    <div className="bg-[#e6fcf5] border border-[#a7f3d0] rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#10b981] flex items-center justify-center text-white shrink-0">
                        <UserCheck size={24} />
                      </div>
                      <div>
                        <div className="text-gray-600 font-medium text-sm mb-1">Tham gia</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {meetings.filter((m) => m.attendanceStatus === 'Tham gia').length}
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#f59e0b] flex items-center justify-center text-white shrink-0">
                        <User size={24} />
                      </div>
                      <div>
                        <div className="text-gray-600 font-medium text-sm mb-1">Chưa xác nhận</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {
                            meetings.filter(
                              (m) => m.attendanceStatus === 'Chưa xác nhận' || !m.attendanceStatus
                            ).length
                          }
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#fff1f2] border border-[#fecdd3] rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#e11d48] flex items-center justify-center text-white shrink-0">
                        <UserX size={24} />
                      </div>
                      <div>
                        <div className="text-gray-600 font-medium text-sm mb-1">Vắng mặt</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {meetings.filter((m) => m.attendanceStatus === 'Vắng mặt').length}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#e6fcf5] border border-[#a7f3d0] rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#10b981] flex items-center justify-center text-white shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="text-gray-600 font-medium text-sm mb-1">Đã xử lý</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {meetings.filter((m) => m.attendanceStatus === 'Đã xử lý').length}
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#f59e0b] flex items-center justify-center text-white shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="text-gray-600 font-medium text-sm mb-1">Chưa xử lý</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {meetings.filter((m) => m.attendanceStatus === 'Chưa xử lý').length}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* List Header & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-gray-800">Danh sách phiên họp</h2>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <Input
                    placeholder="Tìm kiếm theo tên phiên họp..."
                    className="pl-9 w-[280px] h-9 text-sm rounded-full bg-gray-50 border-gray-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="w-9 h-9 rounded-full text-gray-500"
                >
                  <Filter size={16} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="w-9 h-9 rounded-full text-gray-500"
                  onClick={fetchMeetings}
                >
                  <RefreshCw size={16} />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 text-[#c8102e] border-[#c8102e] hover:bg-red-50 rounded-full px-4"
                    >
                      <Filter size={14} className="mr-2" />
                      Bộ lọc
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[320px] p-4 rounded-xl">
                    <h3 className="font-bold text-gray-800 mb-4">Bộ lọc</h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">
                          Trạng thái tham gia
                        </label>
                        <Select defaultValue="all">
                          <SelectTrigger>
                            <SelectValue placeholder="Tất cả" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                            <SelectItem value="joined">Tham gia</SelectItem>
                            <SelectItem value="pending">Chưa xác nhận</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">
                          Trạng thái phiên họp
                        </label>
                        <Select defaultValue="all">
                          <SelectTrigger>
                            <SelectValue placeholder="Tất cả" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">
                          Loại phiên họp
                        </label>
                        <Select defaultValue="all">
                          <SelectTrigger>
                            <SelectValue placeholder="Tất cả" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">Hình thức họp</label>
                        <Select defaultValue="all">
                          <SelectTrigger>
                            <SelectValue placeholder="Tất cả" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full bg-[#c8102e] hover:bg-[#a50e27] text-white">
                        Lọc dữ liệu
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 text-[#c8102e] border-[#c8102e] hover:bg-red-50 rounded-full px-4"
                    >
                      <CalendarIcon size={14} className="mr-2" />
                      Thời gian
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[280px] p-4 rounded-xl">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">Từ ngày</label>
                        <div className="relative">
                          <Input type="date" className="h-9 text-sm" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">Đến ngày</label>
                        <div className="relative">
                          <Input type="date" className="h-9 text-sm" />
                        </div>
                      </div>
                      <Button className="w-full bg-[#c8102e] hover:bg-[#a50e27] text-white mt-2">
                        Lọc dữ liệu
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center border-r border-gray-200">STT</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200 whitespace-nowrap">
                      Thời gian họp
                    </th>
                    <th className="px-4 py-3 border-r border-gray-200">Tên phiên họp</th>
                    <th className="px-4 py-3 border-r border-gray-200">Địa điểm họp</th>
                    <th className="px-4 py-3 border-r border-gray-200">Chủ trì cuộc họp</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">
                      {activeTab === 'invited' ? 'Trạng thái tham gia' : 'Trạng thái'}
                    </th>
                    <th className="px-4 py-3 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : paginatedMeetings.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-4 py-16 text-center text-gray-400 bg-gray-50/50"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Inbox size={48} className="mb-4 opacity-30" />
                          <p className="text-base font-semibold text-gray-500 mb-1">
                            Không có dữ liệu
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedMeetings.map((m, index) => {
                      const stt = (currentPage - 1) * pageSize + index + 1
                      const startDate = new Date(m.startTime)
                      const endDate = new Date(m.endTime)
                      const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`
                      const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

                      return (
                        <tr
                          key={m.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-center font-medium">{stt}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="font-semibold text-gray-900">{dateStr}</div>
                            <div className="text-xs text-gray-500">{timeStr}</div>
                          </td>
                          <td
                            className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate"
                            title={m.title}
                          >
                            {m.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.roomName}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {m.presider || 'Chưa xác định'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(m.attendanceStatus)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedMeeting(m)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
                              >
                                <Eye size={16} />
                              </button>
                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition outline-none">
                                        <MoreVertical size={16} />
                                      </button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="bg-black text-white text-xs px-2 py-1 border-black font-medium"
                                  >
                                    Thao tác khác
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-56 rounded-xl shadow-lg border-gray-100 p-1"
                                >
                                  <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#1a202c] py-2 outline-none">
                                    <CheckCircle2 size={16} />
                                    <span>Xác nhận tham gia</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#1a202c] py-2 outline-none">
                                    <FolderPlus size={16} />
                                    <span>Thêm tài liệu vào thư viện</span>
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      className="gap-2 cursor-pointer rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 py-2 outline-none"
                                      onClick={() => handleDeleteMeeting(m.id)}
                                    >
                                      <Trash2 size={16} />
                                      <span>Xóa phiên họp</span>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredMeetings.length > 0 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <div className="text-gray-500">
                  {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, filteredMeetings.length)} /{' '}
                  {filteredMeetings.length} bản ghi
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      «
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 border-x border-gray-200 disabled:opacity-50"
                    >
                      ‹
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      // Simple logic for nearby pages, can be refined for large dataset
                      let pageNum = i + 1
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = currentPage - 2 + i
                      }
                      if (pageNum > totalPages) return null

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 py-1.5 font-medium transition ${
                            currentPage === pageNum
                              ? 'bg-[#c8102e] text-white'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 border-x border-gray-200 disabled:opacity-50"
                    >
                      ›
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      »
                    </button>
                  </div>

                  <Select
                    value={pageSize.toString()}
                    onValueChange={(val) => setPageSize(Number(val))}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / trang</SelectItem>
                      <SelectItem value="20">20 / trang</SelectItem>
                      <SelectItem value="30">30 / trang</SelectItem>
                      <SelectItem value="40">40 / trang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      {isAddModalOpen && (
        <MeetingModal
          onClose={() => setIsAddModalOpen(false)}
          onSaved={() => {
            setIsAddModalOpen(false)
            fetchMeetings()
          }}
        />
      )}
    </TooltipProvider>
  )
}
