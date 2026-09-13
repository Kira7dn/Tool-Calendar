import { Plus, Search, MoreVertical, Eye, Trash2, FileText } from 'lucide-react'
import { getStatusConfig, DOC_STATUS } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable } from '@/components/ui/data-table'
import { ROLES } from '@/constants/roles'
import { useDocumentsList } from '@/features/documents/hooks/useDocumentsList'

export function Documents({ onTabChange, filters }) {
  const currentUserId = parseInt(localStorage.getItem('user_id') || '0', 10)
  const role = localStorage.getItem('user_role') || ROLES.CAN_BO

  const {
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
    executeDelete,
  } = useDocumentsList(filters)

  const getStatusBadge = (doc) => {
    const statusText = doc.trangThai || doc.status
    const daysLeft = doc.soNgayConLai
    const config = getStatusConfig(statusText, daysLeft)
    return (
      <Badge variant={config.variant} className="font-bold border">
        {config.label}
      </Badge>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN')
    } catch {
      return dateStr
    }
  }

  const handleAction = (action, doc) => {
    if (window.app?.services) {
      if (action === 'view') window.app.services.openDocDetail(doc.id)
      if (action === 'edit') window.app.services.openDocDetail(doc.id, 'edit')
      if (action === 'pdf') window.app.services.openPdfPreview(doc.id, doc.soVanBan)
      if (action === 'delete') setDeleteConfirm({ open: true, doc })
    }
  }

  const columns = [
    {
      header: 'STT',
      width: 'w-12',
      align: 'center',
      className: 'text-foreground',
      cellClassName: 'text-muted-foreground font-medium text-[11px]',
      cell: (row, index) => (page - 1) * pageSize + index + 1,
    },
    {
      header: 'Số văn bản',
      width: 'w-32',
      className: 'text-foreground',
      cellClassName: 'font-bold text-secondary cursor-pointer hover:underline truncate',
      cell: (row) => <span onClick={() => handleAction('view', row)}>{row.soVanBan || '-'}</span>,
    },
    {
      header: 'Ngày ban hành',
      width: 'w-32',
      className: 'text-foreground',
      cellClassName: 'text-muted-foreground whitespace-nowrap text-xs',
      cell: (row) => formatDate(row.ngayBanHanh),
    },
    {
      header: 'Trích yếu',
      className: 'text-foreground',
      cellClassName: 'text-foreground/80 truncate text-xs',
      cell: (row) => (
        <div className="flex flex-col gap-1" title={row.trichYeu}>
          <span className="truncate">{row.trichYeu || '-'}</span>
          {(() => {
            let assigned = false
            if (Number(row.assignedTo) === currentUserId) assigned = true
            try {
              const ids = JSON.parse(row.assignedUserIds || '[]')
              if (ids.some((id) => Number(id) === currentUserId)) assigned = true
            } catch (e) {}
            if (assigned) {
              return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-max">
                  Giao cho tôi
                </Badge>
              )
            }
            return null
          })()}
        </div>
      ),
    },
    {
      header: 'Người tạo',
      width: 'w-32',
      className: 'text-foreground',
      cellClassName: 'text-muted-foreground truncate text-xs',
      cell: (row) => (
        <span title={row.uploadedByFullName}>
          {row.uploadedByFullName || '-'}
          {row.uploadedByUserId === currentUserId && (
            <span className="text-primary font-bold ml-1" title="Tôi tải lên">
              (Tôi)
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Tham mưu',
      width: 'w-32',
      className: 'text-foreground',
      cellClassName: 'text-muted-foreground truncate text-xs',
      cell: (row) => row.coQuanChuQuan || '-',
    },
    {
      header: 'Thời hạn',
      width: 'w-32',
      className: 'text-foreground',
      cellClassName: 'text-muted-foreground whitespace-nowrap text-xs',
      cell: (row) => formatDate(row.thoiHan),
    },
    {
      header: 'Trạng thái',
      width: 'w-32',
      className: 'text-foreground',
      cell: (row) => getStatusBadge(row),
    },
    {
      header: 'Thao tác',
      width: 'w-20',
      align: 'center',
      className: 'text-foreground',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 glass-card shadow-2xl">
            <DropdownMenuItem
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 hover:text-primary hover:bg-primary/5 cursor-pointer transition-all font-bold text-xs"
              onClick={() => handleAction('view', row)}
            >
              <Eye className="size-4 text-primary" />
              <span>Chi tiết</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all font-bold text-xs"
              onClick={() => handleAction('pdf', row)}
            >
              <FileText className="size-4 text-blue-500" />
              <span>Xem PDF</span>
            </DropdownMenuItem>
            {localStorage.getItem('user_role') === ROLES.ADMIN && (
              <DropdownMenuItem
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer transition-all font-bold text-xs"
                onClick={() => handleAction('delete', row)}
              >
                <Trash2 className="size-4" />
                <span>Xóa văn bản</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="absolute top-[var(--space-page)] bottom-[var(--space-page)] left-[var(--space-page)] right-[var(--space-page)] max-md:left-4 max-md:right-4 space-y-[var(--space-page)] flex flex-col animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5">
        <h2 className="text-xl">Quản lý văn bản</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
          Hệ thống quản lý văn bản
        </p>
      </div>

      <Card className="glass-card shadow-sm flex-1 flex flex-col min-h-0 gap-2 px-2">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-4 space-y-0 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-4 flex-shrink-0">
            <Button
              size="sm"
              className="rounded-full shadow-lg shadow-primary/20"
              onClick={() => onTabChange('upload')}
            >
              <Plus className="size-4 mr-1" /> Thêm mới
            </Button>

            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-full border border-border/50 max-md:hidden">
              <Button
                variant={activeTab === 'all' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-full h-7 px-4 text-xs font-semibold transition-all ${activeTab === 'all' ? 'shadow-sm' : ''}`}
                onClick={() => {
                  setActiveTab('all')
                  setPage(1)
                }}
              >
                Tất cả
              </Button>
              <Button
                variant={activeTab === 'assigned_to_me' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-full h-7 px-4 text-xs font-semibold transition-all ${activeTab === 'assigned_to_me' ? 'shadow-sm' : ''}`}
                onClick={() => {
                  setActiveTab('assigned_to_me')
                  setPage(1)
                }}
              >
                Giao cho tôi
              </Button>
              <Button
                variant={activeTab === 'uploaded_by_me' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-full h-7 px-4 text-xs font-semibold transition-all ${activeTab === 'uploaded_by_me' ? 'shadow-sm' : ''}`}
                onClick={() => {
                  setActiveTab('uploaded_by_me')
                  setPage(1)
                }}
              >
                Tôi tải lên
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-64 max-md:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm số hiệu, nội dung..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-9 px-3 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value={DOC_STATUS.CHUA_XU_LY.value}>
                {DOC_STATUS.CHUA_XU_LY.icon} {DOC_STATUS.CHUA_XU_LY.label}
              </option>
              <option value={DOC_STATUS.DA_XU_LY.value}>
                {DOC_STATUS.DA_XU_LY.icon} {DOC_STATUS.DA_XU_LY.label}
              </option>
            </select>
            <select
              className="h-9 px-3 text-sm max-md:hidden"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                setPage(1)
              }}
            >
              <option value="newest">📅 Mới nhất</option>
              <option value="oldest">📅 Cũ nhất</option>
              <option value="deadline_asc">⏳ Hạn gần nhất</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {error ? (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState onRetry={() => setPage(1)} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={documents}
              isLoading={isLoading}
              emptyMessage="Không tìm thấy văn bản nào"
              minWidth="1000px"
              pagination={{
                page,
                totalPages,
                totalCount,
                pageSize,
                onPageChange: setPage,
                onPageSizeChange: setPageSize,
              }}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmationModal
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
        title="Xác nhận xóa?"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deleteConfirm.doc?.soVanBan}"? Thao tác này không thể hoàn tác.`}
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />
    </div>
  )
}
