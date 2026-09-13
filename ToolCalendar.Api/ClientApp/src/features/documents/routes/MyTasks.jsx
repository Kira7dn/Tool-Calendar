// documents/pages/MyTasks.jsx — Trang Việc của tôi (đã refactor)
// Logic tách vào useMyTasks.js | EvidenceModal tách ra component riêng
import { useState } from 'react'
import { Search, Calendar, ChevronLeft, ChevronRight, CheckCircle2, Upload, X } from 'lucide-react'
import { getStatusConfig } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { DOCUMENT_STATUS } from '@/constants/document'
import { TASK_FILTER } from '../../../constants/document'

import { cn } from '@/lib/utils'
import { useMyTasks } from '../../../features/tasks/hooks/useMyTasks'
import { EvidenceModal } from '../../../features/tasks/components/EvidenceModal'

function StatItem({ label, count, color, isLoading, isActive, onClick }) {
  const colorMap = {
    info: 'bg-info shadow-[0_0_8px_rgba(14,165,233,0.5)]',
    warning: 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    destructive: 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    success: 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  }
  const activeMap = {
    info: 'bg-info/10 text-info ring-1 ring-info/20',
    warning: 'bg-warning/10 text-warning ring-1 ring-warning/20',
    destructive: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
    success: 'bg-success/10 text-success ring-1 ring-success/20',
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 px-2.5 rounded-lg gap-2 font-bold transition-all',
        isActive ? activeMap[color] : 'hover:bg-muted/50'
      )}
      onClick={onClick}
      disabled={isLoading}
    >
      <div className={cn('size-2 rounded-full', colorMap[color])} />
      <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{label}:</span>
      {isLoading ? (
        <Skeleton className="h-3 w-4" />
      ) : (
        <span className={cn('text-xs font-black', isActive ? `text-${color}` : 'text-foreground')}>
          {count}
        </span>
      )}
    </Button>
  )
}

export function MyTasks({ onTabChange }) {
  const {
    tasks,
    isLoading,
    stats,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    fetchTasks,
    acceptTask,
  } = useMyTasks()

  const [evidenceDocId, setEvidenceDocId] = useState(null)

  const columns = [
    {
      header: 'STT',
      width: 'w-12',
      align: 'center',
      className: 'font-bold text-foreground',
      cellClassName: 'text-muted-foreground font-medium text-[11px]',
      cell: (row, index) => (currentPage - 1) * PAGE_SIZE + index + 1,
    },
    {
      header: 'Số hiệu',
      width: 'w-28',
      className: 'font-bold text-foreground',
      cellClassName: 'font-bold text-primary text-xs whitespace-nowrap',
      cell: (row) => row.soVanBan,
    },
    {
      header: 'Trích yếu nội dung',
      className: 'font-bold text-foreground',
      cellClassName: 'truncate font-medium text-muted-foreground text-xs',
      cell: (row) => (
        <div title={row.trichYeu} className="truncate">
          {row.trichYeu}
        </div>
      ),
    },
    {
      header: 'Thời hạn',
      width: 'w-28',
      className: 'font-bold text-foreground',
      cellClassName: 'text-muted-foreground font-bold text-[10px] whitespace-nowrap uppercase',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3 text-muted-foreground/50" />
          {formatDate(row.hanXuLy)}
        </div>
      ),
    },
    {
      header: 'Trạng thái',
      width: 'w-28',
      align: 'center',
      className: 'font-bold text-foreground',
      cell: (row) => getStatusBadge(row),
    },
    {
      header: 'Thao tác',
      width: 'w-36',
      align: 'center',
      className: 'font-bold text-foreground',
      cell: (row) => <ActionButtons task={row} />,
    },
  ]

  const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '-')

  const getStatusBadge = (task) => {
    const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null
    const now = new Date()
    const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null
    const config = getStatusConfig(task.status, daysLeft)
    return (
      <Badge
        variant={config.variant}
        className="px-2 py-0 rounded-full font-bold text-[9px] uppercase border"
      >
        {config.label}
      </Badge>
    )
  }

  const ActionButtons = ({ task, isMobile = false }) => {
    const h = isMobile ? 'h-7 px-2.5' : 'h-8 px-3'
    return (
      <div className={cn('flex items-center gap-1.5', !isMobile && 'justify-center')}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(h, 'rounded-lg text-info font-bold hover:bg-info/5 text-[11px]')}
          onClick={() => window.app?.services?.openDocDetail?.(task.id)}
        >
          Chi tiết
        </Button>
        {!task.status || task.status === DOCUMENT_STATUS.CHUA_XU_LY ? (
          <Button
            size="sm"
            className={cn(
              h,
              'rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-[11px] shadow-sm text-white'
            )}
            onClick={() => acceptTask(task)}
          >
            Tiếp nhận
          </Button>
        ) : task.status === DOCUMENT_STATUS.DANG_XU_LY ? (
          <Button
            size="sm"
            className={cn(
              h,
              'rounded-lg bg-red-600 hover:bg-red-700 font-bold text-[11px] shadow-sm text-white'
            )}
            onClick={() => setEvidenceDocId(task.id)}
          >
            <Upload className="size-3 mr-1.5" />
            Nộp
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full pb-6 animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-success pl-3 py-0 mb-4">
        <h2 className="text-xl">Việc của tôi</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
          Personal Task Queue
        </p>
      </div>

      <Card className="glass-card shadow-sm flex-1 flex flex-col overflow-hidden gap-2 px-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border bg-muted/10">
          <div className="flex items-center">
            <div className="flex items-center gap-1 max-md:hidden">
              <StatItem
                label="Mới"
                count={stats.new}
                color="info"
                isLoading={isLoading}
                isActive={statusFilter === TASK_FILTER.NEW}
                onClick={() => setStatusFilter(TASK_FILTER.NEW)}
              />
              <StatItem
                label="Đang làm"
                count={stats.doing}
                color="warning"
                isLoading={isLoading}
                isActive={statusFilter === TASK_FILTER.DOING}
                onClick={() => setStatusFilter(TASK_FILTER.DOING)}
              />
              <StatItem
                label="Quá hạn"
                count={stats.overdue}
                color="destructive"
                isLoading={isLoading}
                isActive={statusFilter === TASK_FILTER.OVERDUE}
                onClick={() => setStatusFilter(TASK_FILTER.OVERDUE)}
              />
              <StatItem
                label="Đã xong"
                count={stats.completed}
                color="success"
                isLoading={isLoading}
                isActive={statusFilter === TASK_FILTER.COMPLETED}
                onClick={() => setStatusFilter(TASK_FILTER.COMPLETED)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 flex items-center">
              {statusFilter !== TASK_FILTER.ALL && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setStatusFilter(TASK_FILTER.ALL)}
                  className="bg-muted/50 text-muted-foreground rounded-full font-bold px-3 h-8 gap-2 border-none hover:bg-muted transition-all group"
                  title="Nhấn để bỏ lọc"
                >
                  <span className="text-[10px] uppercase">
                    {statusFilter === TASK_FILTER.NEW
                      ? 'Mới'
                      : statusFilter === TASK_FILTER.DOING
                        ? 'Đang làm'
                        : statusFilter === TASK_FILTER.OVERDUE
                          ? 'Quá hạn'
                          : 'Đã xong'}
                  </span>
                  <X className="size-3.5 group-hover:scale-110 transition-transform" />
                </Button>
              )}
            </div>
            <div className="relative w-64 max-md:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm văn bản..."
                className="pl-9 h-9 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-hidden flex flex-col p-0">
          <div className="relative flex-1 overflow-auto pt-px">
            {/* Desktop Table */}
            <div className="hidden md:flex flex-col min-h-0 flex-1 relative">
              <DataTable
                columns={columns}
                data={tasks}
                isLoading={isLoading}
                emptyMessage="Không có nhiệm vụ nào cần xử lý."
                minWidth="1000px"
              />
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))
              ) : tasks.length > 0 ? (
                tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground font-bold shrink-0">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}.
                        </span>
                        <span className="font-black text-primary text-xs truncate">
                          {task.soVanBan || '—'}
                        </span>
                      </div>
                      {getStatusBadge(task)}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground leading-snug line-clamp-2">
                      {task.trichYeu || '—'}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
                        <Calendar className="size-3 text-muted-foreground/50" />
                        <span>{formatDate(task.hanXuLy)}</span>
                      </div>
                      <ActionButtons task={task} isMobile />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 opacity-20">
                  <CheckCircle2 className="size-16" />
                  <p className="text-sm font-bold">Không có nhiệm vụ nào.</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border flex items-center justify-between bg-card/50 z-10">
            <p className="text-xs text-muted-foreground font-medium">
              Trang <span className="text-foreground">{currentPage}</span> /{' '}
              <span className="text-foreground">{totalPages || 1}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 text-xs font-semibold px-3"
              >
                <ChevronLeft className="size-4 mr-1" />
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs font-semibold px-3"
              >
                Tiếp
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EvidenceModal
        isOpen={!!evidenceDocId}
        onClose={() => setEvidenceDocId(null)}
        docId={evidenceDocId}
        onSuccess={fetchTasks}
      />
    </div>
  )
}
