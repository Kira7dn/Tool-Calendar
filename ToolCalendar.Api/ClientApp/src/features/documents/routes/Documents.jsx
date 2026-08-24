/* eslint-disable */
import React from 'react'
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { getStatusConfig, DOC_STATUS } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState } from '@/components/ui/error-state'
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

  return (
    <div className="space-y-[var(--space-page)] flex flex-col h-full animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5">
        <h2 className="text-xl">Quản lý văn bản</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
          Hệ thống quản lý văn bản
        </p>
      </div>

      <Card className="glass-card shadow-sm flex-1 flex flex-col overflow-hidden gap-2 px-2">
        <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0 border-b border-border bg-muted/20">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-3">
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

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="relative flex-1 overflow-auto pt-px">
            <Table className="w-full min-w-[1000px] table-fixed">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-center w-12 text-foreground">STT</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Số văn bản</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Ngày ban hành</TableHead>
                  <TableHead className="font-bold text-foreground">Trích yếu</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Người tạo</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Tham mưu</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Thời hạn</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Trạng thái</TableHead>
                  <TableHead className="font-bold text-center text-foreground w-20">
                    Thao tác
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="relative">
                {isLoading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px] transition-all duration-300">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <Loader2 className="size-10 text-primary animate-spin" strokeWidth={2.5} />
                        <div className="absolute inset-0 size-10 border-4 border-primary/10 rounded-full" />
                      </div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">
                        Đang tải dữ liệu...
                      </span>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-[48px]">
                      <TableCell className="px-4 py-2.5 text-center w-12">
                        <Skeleton className="h-4 w-6 mx-auto" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 w-32">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 w-32">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 w-32">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 w-32">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 w-32">
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center w-20">
                        <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-[240px] text-center p-0 align-middle">
                      <ErrorState onRetry={() => setPage(1)} />
                    </TableCell>
                  </TableRow>
                ) : documents.length > 0 ? (
                  documents.map((doc, idx) => (
                    <TableRow key={doc.id} className="group transition-colors h-[48px]">
                      <TableCell className="text-muted-foreground font-medium text-[11px] w-12 text-center">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell
                        className="font-bold text-secondary cursor-pointer hover:underline w-32 truncate"
                        onClick={() => handleAction('view', doc)}
                      >
                        {doc.soVanBan || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap w-32 text-xs">
                        {formatDate(doc.ngayBanHanh)}
                      </TableCell>
                      <TableCell
                        className="text-foreground/80 truncate text-xs"
                        title={doc.trichYeu}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="truncate">{doc.trichYeu || '-'}</span>
                          {(() => {
                            let assigned = false
                            if (Number(doc.assignedTo) === currentUserId) assigned = true
                            try {
                              const ids = JSON.parse(doc.assignedUserIds || '[]')
                              if (ids.some((id) => Number(id) === currentUserId)) assigned = true
                            } catch (e) { }
                            if (assigned) {
                              return (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-200 w-max"
                                >
                                  Giao cho tôi
                                </Badge>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground w-32 truncate text-xs"
                        title={doc.uploadedByFullName}
                      >
                        {doc.uploadedByFullName || '-'}
                        {doc.uploadedByUserId === currentUserId && (
                          <span className="text-primary font-bold ml-1" title="Tôi tải lên">
                            (Tôi)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground w-32 truncate text-xs">
                        {doc.coQuanChuQuan || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap w-32 text-xs">
                        {formatDate(doc.thoiHan)}
                      </TableCell>
                      <TableCell className="w-32">{getStatusBadge(doc)}</TableCell>
                      <TableCell className="text-center w-20">
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
                              onClick={() => handleAction('view', doc)}
                            >
                              <Eye className="size-4 text-primary" />
                              <span>Chi tiết</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all font-bold text-xs"
                              onClick={() => handleAction('pdf', doc)}
                            >
                              <FileText className="size-4 text-blue-500" />
                              <span>Xem PDF</span>
                            </DropdownMenuItem>
                            {localStorage.getItem('user_role') === ROLES.ADMIN && (
                              <DropdownMenuItem
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer transition-all font-bold text-xs"
                                onClick={() => handleAction('delete', doc)}
                              >
                                <Trash2 className="size-4" />
                                <span>Xóa văn bản</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-[240px] text-center p-0 align-middle">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                        <Search className="size-16" />
                        <p className="text-sm font-bold">Không tìm thấy văn bản nào</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-border flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-6">
              <p className="text-xs text-muted-foreground font-medium">
                Trang <span className="text-foreground">{page}</span> /{' '}
                <span className="text-foreground">{totalPages || 1}</span>
                <span className="mx-2 text-muted-foreground/30">|</span>Tổng{' '}
                <span className="text-foreground font-bold">{totalCount}</span> văn bản
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                  Hiển thị:
                </span>
                <select
                  className="h-7 px-2 text-[11px] font-bold bg-background border rounded-md outline-none focus:ring-1 ring-primary/30"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  <option value={10}>10 dòng</option>
                  <option value={15}>15 dòng</option>
                  <option value={20}>20 dòng</option>
                  <option value={25}>25 dòng</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 text-xs font-semibold px-4"
              >
                <ChevronLeft className="size-4 mr-1" /> Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 text-xs font-semibold px-4"
              >
                Sau <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
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
