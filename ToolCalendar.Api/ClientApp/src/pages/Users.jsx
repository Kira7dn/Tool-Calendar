/* eslint-disable */
import React, { useState } from 'react'
import {
  Plus,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { DataTable } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { ROLES } from '@/constants/roles'
import { useUsers } from '@/features/users/hooks/useUsers'
import { UserModal } from '@/features/users/components/UserModal'

export function Users() {
  const {
    users,
    departments,
    isLoading,
    search,
    setSearch,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalCount = users.length,
    deleteConfirm,
    setDeleteConfirm,
    handleDeleteUser,
    executeDelete,
    fetchUsers,
  } = useUsers()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  const handleOpenModal = (user = null) => {
    setEditingUser(user)
    setIsModalOpen(true)
  }

  const columns = [
    {
      header: 'STT',
      width: 'w-12',
      align: 'center',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cellClassName: 'text-muted-foreground font-bold text-xs',
      cell: (row, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      header: 'Người dùng',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cell: (row) => (
        <div className="flex items-center gap-4">
          <div className="size-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            {row.fullName?.charAt(0) || 'U'}
          </div>
          <div className="truncate">
            <div className="font-black text-foreground text-sm truncate">{row.fullName}</div>
            <div className="text-xs text-muted-foreground font-bold">@{row.username}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Liên hệ',
      width: 'w-44',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cellClassName: 'truncate',
      cell: (row) => (
        <div className="flex flex-col gap-1 truncate">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground truncate">
            <Mail className="size-3 text-muted-foreground/30 shrink-0" />{' '}
            <span className="truncate">{row.email || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground truncate">
            <Phone className="size-3 text-muted-foreground/30 shrink-0" />{' '}
            <span className="truncate">{row.phoneNumber || '-'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Phòng ban',
      width: 'w-36',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cellClassName: 'truncate',
      cell: (row) => (
        <Badge
          variant="default"
          className="bg-muted/50 text-muted-foreground font-bold text-[10px] truncate max-w-full"
        >
          {row.departmentName || 'Chưa phân phòng'}
        </Badge>
      ),
    },
    {
      header: 'Vai trò',
      width: 'w-28',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cell: (row) => getRoleBadge(row.role),
    },
    {
      header: 'Thao tác',
      width: 'w-24',
      align: 'right',
      className: 'font-black text-[10px] uppercase tracking-widest',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-info hover:bg-info/10"
            onClick={() => handleOpenModal(row)}
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
            disabled={row.username === 'admin'}
            onClick={() => handleDeleteUser(row)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const getRoleBadge = (role) => {
    let color = 'bg-muted/50 text-muted-foreground'
    if (role === ROLES.ADMIN) color = 'bg-info/15 text-info border-info/30'
    else if (role === ROLES.LANH_DAO) color = 'bg-primary/15 text-primary border-primary/30'
    else if (role === ROLES.VAN_THU) color = 'bg-warning/15 text-warning border-warning/30'
    else if (role === ROLES.CAN_BO) color = 'bg-success/15 text-success border-success/30'

    return (
      <Badge
        variant="outline"
        className={cn('font-bold text-[10px] uppercase tracking-tighter', color)}
      >
        {role === ROLES.ADMIN
          ? 'Quản trị viên'
          : role === ROLES.LANH_DAO
            ? 'Lãnh đạo'
            : role === ROLES.VAN_THU
              ? 'Văn thư'
              : 'Cán bộ'}
      </Badge>
    )
  }

  return (
    <div className="space-y-[var(--space-page)] flex flex-col h-full animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5">
        <h2 className="text-xl">Quản lý người dùng</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
          Access Control & Staff Management
        </p>
      </div>

      <Card className="glass-card shadow-2xl flex-1 flex flex-col overflow-hidden gap-2 px-2 py-0">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between p-8 border-b border-border gap-4 bg-muted/20">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, email..."
                className="pl-9 h-11 bg-muted/50 focus:bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              className="h-11 px-6 rounded-2xl bg-primary hover:bg-sidebar-mid text-primary-foreground font-bold shadow-lg shadow-primary/20"
              onClick={() => handleOpenModal()}
            >
              <Plus className="size-4 mr-2" /> Thêm tài khoản
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col min-h-0 relative">
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            emptyMessage="Không có dữ liệu người dùng"
            minWidth="1000px"
            pagination={{
              page: currentPage,
              totalPages,
              totalCount,
              pageSize,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
              pageSizeOptions: [10, 20, 25, 50],
            }}
          />
        </CardContent>
      </Card>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
        departments={departments}
        onSuccess={fetchUsers}
      />

      <ConfirmationModal
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
        title="Xác nhận xóa?"
        description={`Bạn có chắc chắn muốn xóa tài khoản "${deleteConfirm.user?.fullName}"? Thao tác này không thể hoàn tác.`}
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />
    </div>
  )
}
