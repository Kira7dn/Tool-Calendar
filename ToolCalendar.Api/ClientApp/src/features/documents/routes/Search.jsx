/* eslint-disable */
import React from 'react'
import {
  Search as SearchIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { getStatusConfig, DOC_STATUS } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable } from '@/components/ui/data-table'
import { useSearch } from '@/features/documents/hooks/useSearch'

export function Search({ filters, onTabChange }) {
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
  } = useSearch(filters)

  const handleSearch = (e) => {
    e?.preventDefault()
    setPage(1)
    fetchDocuments()
  }

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

  return (
    <div className="flex flex-col flex-1 min-w-0 gap-3 animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      {/* ── Toolbar 2 dòng ─── */}
      <form
        onSubmit={handleSearch}
        className="glass-card rounded-xl px-4 py-2.5 shadow-sm flex flex-col gap-2 shrink-0"
      >
        {/* Dòng 1: Tiêu đề + Từ khóa + Trạng thái + Sắp xếp */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="border-l-4 border-primary pl-3 mr-1 shrink-0">
            <h2 className="text-sm font-black leading-none">Tìm kiếm văn bản</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider leading-none mt-0.5">
              Tra cứu nâng cao
            </p>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <SearchIcon className="size-3 text-primary" /> Từ khóa tìm kiếm
            </span>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Số hiệu, trích yếu, cơ quan..."
                className="pl-8 h-8 bg-muted/30 border-none rounded-lg text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <span className="size-3 inline-flex items-center justify-center text-primary text-[9px]">
                ●
              </span>{' '}
              Trạng thái
            </span>
            <select
              className="h-8 px-2 rounded-lg bg-muted/30 border-none text-xs font-bold outline-none cursor-pointer appearance-none min-w-[150px]"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value={DOC_STATUS.CHUA_XU_LY.value}>
                {DOC_STATUS.CHUA_XU_LY.icon} {DOC_STATUS.CHUA_XU_LY.label}
              </option>
              <option value={DOC_STATUS.DA_XU_LY.value}>
                {DOC_STATUS.DA_XU_LY.icon} {DOC_STATUS.DA_XU_LY.label}
              </option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <span className="size-3 inline-flex items-center justify-center text-primary text-[9px]">
                ↕
              </span>{' '}
              Sắp xếp theo
            </span>
            <select
              className="h-8 px-2 rounded-lg bg-muted/30 border-none text-xs font-bold outline-none cursor-pointer appearance-none"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">📅 Mới nhất</option>
              <option value="oldest">📅 Cũ nhất</option>
              <option value="deadline_asc">⏳ Hạn gần nhất</option>
            </select>
          </div>
        </div>

        {/* Dòng 2: Ngày tiếp nhận + Hạn xử lý + Nút tìm */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-3 border-t border-border/40 pt-4 md:pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 flex items-center gap-1.5 md:ml-1">
              <Calendar className="size-3 text-primary" /> Tiếp nhận từ ngày
            </span>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Input
                type="date"
                className="h-7 px-2 bg-muted/30 border-none rounded-lg text-xs w-full flex-1 sm:w-[125px] min-w-0"
                value={addFromDate}
                onChange={(e) => setAddFromDate(e.target.value)}
              />
              <span className="text-[10px] font-black text-muted-foreground shrink-0">đến</span>
              <Input
                type="date"
                className="h-7 px-2 bg-muted/30 border-none rounded-lg text-xs w-full flex-1 sm:w-[125px] min-w-0"
                value={addToDate}
                onChange={(e) => setAddToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 flex items-center gap-1.5 md:ml-3">
              <Calendar className="size-3 text-primary" /> Hạn xử lý từ
            </span>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Input
                type="date"
                className="h-7 px-2 bg-muted/30 border-none rounded-lg text-xs w-full flex-1 sm:w-[125px] min-w-0"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-[10px] font-black text-muted-foreground shrink-0">đến</span>
              <Input
                type="date"
                className="h-7 px-2 bg-muted/30 border-none rounded-lg text-xs w-full flex-1 sm:w-[125px] min-w-0"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1 md:mt-0 md:ml-auto w-full md:w-auto justify-end">
            {(fromDate || toDate || addFromDate || addToDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                  setAddFromDate('')
                  setAddToDate('')
                }}
                className="text-[10px] font-bold text-muted-foreground/60 hover:text-destructive transition-colors underline underline-offset-2 shrink-0"
              >
                Xóa bộ lọc
              </button>
            )}
            <Button
              type="submit"
              className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-md shadow-primary/20 transition-all active:scale-[0.98] flex-1 md:flex-none"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <SearchIcon className="size-3.5 mr-1.5" />
              )}
              Tìm kiếm
            </Button>
          </div>
        </div>
      </form>

      {/* ── Bảng kết quả ─── */}
      <Card className="glass-card shadow-sm flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden px-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0 relative">
          <DataTable
            columns={columns}
            data={documents}
            isLoading={isLoading}
            error={!!error}
            errorContent={<ErrorState onRetry={fetchDocuments} />}
            emptyMessage="Không tìm thấy kết quả nào phù hợp"
            minWidth="1000px"
            pagination={{
              page,
              totalPages,
              totalCount,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
              pageSizeOptions: [10, 20, 50, 100],
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
