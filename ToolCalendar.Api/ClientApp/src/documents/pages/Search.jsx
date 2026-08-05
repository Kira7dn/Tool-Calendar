/* eslint-disable */
import React, { useEffect, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function Search({ filters, onTabChange }) {
  const [documents, setDocuments] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Search Filters
  const [search, setSearch] = useState(filters?.search || '')
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
      setStatus(newStatus)
      setSort(newSort)
      setFromDate(newFrom)
      setToDate(newTo)
      setAddFromDate(newAddFrom)
      setAddToDate(newAddTo)
      setPage(1)

      setIsLoading(true)
      let url = `/api/documents?page=1&size=${pageSize}&search=${encodeURIComponent(newSearch)}&status=${newStatus}&sort=${newSort}`
      if (newFrom) url += `&fromDate=${newFrom}`
      if (newTo) url += `&toDate=${newTo}`
      if (newAddFrom) url += `&addFromDate=${newAddFrom}`
      if (newAddTo) url += `&addToDate=${newAddTo}`

      fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } })
        .then((res) => res.json())
        .then((data) => {
          setDocuments(data.data || [])
          setTotalPages(data.totalPages || 1)
          setTotalCount(data.totalCount || 0)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    }
  }, [filters])

  useEffect(() => {
    fetchDocuments()
  }, [page, pageSize])

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      let url = `/api/documents?page=${page}&size=${pageSize}&search=${encodeURIComponent(search)}&status=${status}&sort=${sort}`
      if (fromDate) url += `&fromDate=${fromDate}`
      if (toDate) url += `&toDate=${toDate}`
      if (addFromDate) url += `&addFromDate=${addFromDate}`
      if (addToDate) url += `&addToDate=${addToDate}`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
      const date = new Date(dateStr)
      return date.toLocaleDateString('vi-VN')
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

          {/* Từ khóa */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <SearchIcon className="size-3 text-primary" />
              Từ khóa tìm kiếm
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

          {/* Trạng thái */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <span className="size-3 inline-flex items-center justify-center text-primary text-[9px]">
                ●
              </span>
              Trạng thái
            </span>
            <select
              className="h-8 px-2 rounded-lg bg-muted/30 border-none text-xs font-bold outline-none cursor-pointer appearance-none min-w-[150px]"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.values(DOC_STATUS).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <span className="size-3 inline-flex items-center justify-center text-primary text-[9px]">
                ↕
              </span>
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
          {/* Ngày tiếp nhận */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 flex items-center gap-1.5 md:ml-1">
              <Calendar className="size-3 text-primary" />
              Tiếp nhận từ ngày
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

          {/* Hạn xử lý */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 flex items-center gap-1.5 md:ml-3">
              <Calendar className="size-3 text-primary" />
              Hạn xử lý từ
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
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="relative flex-1 overflow-auto pt-px">
            <Table className="w-full min-w-[1000px] table-fixed">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-center w-12 text-foreground">STT</TableHead>
                  <TableHead className="font-bold text-foreground w-36">Số văn bản</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Hạn xử lý</TableHead>
                  <TableHead className="font-bold text-foreground">Trích yếu</TableHead>
                  <TableHead className="font-bold text-foreground w-44">Tham mưu</TableHead>
                  <TableHead className="font-bold text-foreground w-32">Trạng thái</TableHead>
                  <TableHead className="font-bold text-center text-foreground w-20">
                    Chi tiết
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="relative">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-[40px]">
                      <TableCell className="text-center w-14">
                        <Skeleton className="h-4 w-6 mx-auto" />
                      </TableCell>
                      <TableCell className="w-40">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="w-36">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="min-w-[300px]">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell className="w-40">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="w-36">
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="text-center w-24">
                        <Skeleton className="h-7 w-7 rounded-full mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : documents.length > 0 ? (
                  documents.map((doc, idx) => (
                    <TableRow
                      key={doc.id}
                      className="group transition-colors h-[40px] hover:bg-muted/30"
                    >
                      <TableCell className="py-1 text-muted-foreground font-medium text-[10px] w-14 text-center">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="py-1 font-bold text-secondary w-40 truncate text-[11px]">
                        {doc.soVanBan || '-'}
                      </TableCell>
                      <TableCell className="py-1 text-red-600 font-black whitespace-nowrap w-36 text-[10px]">
                        {formatDate(doc.thoiHan)}
                      </TableCell>
                      <TableCell className="py-1 max-w-0" title={doc.trichYeu}>
                        <div className="truncate text-[11px] text-foreground/80 font-medium">
                          {doc.trichYeu || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 w-44" title={doc.coQuanChuQuan}>
                        <div className="truncate text-[10px] text-muted-foreground font-bold max-w-[160px]">
                          {doc.coQuanChuQuan || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 w-36">{getStatusBadge(doc)}</TableCell>
                      <TableCell className="py-1 text-center w-24">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-primary hover:bg-primary/10"
                          onClick={() => window.app?.services?.openDocDetail?.(doc.id)}
                        >
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-[200px] text-center p-0 align-middle">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                        <SearchIcon className="size-14" />
                        <p className="text-sm font-bold">Không tìm thấy kết quả nào phù hợp</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-card/50">
            <p className="text-xs text-muted-foreground font-medium">
              Trang <span className="text-foreground font-bold">{page}</span> /{' '}
              <span className="text-foreground">{totalPages || 1}</span>
              <span className="mx-2 text-muted-foreground/30">|</span>
              Tổng <span className="text-foreground font-bold">{totalCount}</span> kết quả
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-7 text-xs font-semibold px-3"
              >
                <ChevronLeft className="size-3.5 mr-1" /> Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-7 text-xs font-semibold px-3"
              >
                Sau <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
