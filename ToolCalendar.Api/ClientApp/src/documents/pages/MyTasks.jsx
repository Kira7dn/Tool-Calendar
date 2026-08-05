/* eslint-disable */
import React, { useEffect, useState } from 'react'
import {
  FileText,
  Upload,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Paperclip,
} from 'lucide-react'
import { getStatusConfig } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function MyTasks({ onTabChange }) {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ new: 0, doing: 0, overdue: 0, completed: 0 })
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState(null)
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  useEffect(() => {
    fetchTasks()
    const handleUpdate = () => fetchTasks()
    document.addEventListener('realtime:document_updated', handleUpdate)
    return () => document.removeEventListener('realtime:document_updated', handleUpdate)
  }, [])

  const fetchTasks = async () => {
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
  }

  const calculateStats = (taskList) => {
    const now = new Date()
    let n = 0,
      d = 0,
      o = 0,
      c = 0
    taskList.forEach((task) => {
      const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null
      const isOverdue =
        deadline && deadline < now && (task.status || '').toLowerCase().indexOf('hoàn thành') === -1
      const status = (task.status || '').toLowerCase()

      if (status.includes('hoàn thành')) c++
      else if (isOverdue) o++
      else if (status.includes('đang xử lý')) d++
      else n++
    })
    setStats({ new: n, doing: d, overdue: o, completed: c })
  }

  const handleSubmitEvidence = async () => {
    if (!evidenceNotes.trim()) return
    if (selectedFiles.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 file bằng chứng!')
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('notes', evidenceNotes)
      selectedFiles.forEach((file) => formData.append('files', file))

      const response = await fetch(`/api/documents/${selectedDocId}/submit-evidence`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setIsEvidenceModalOpen(false)
        setEvidenceNotes('')
        setSelectedFiles([])
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to submit evidence:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('vi-VN')
  }

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

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.soVanBan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.trichYeu?.toLowerCase().includes(searchQuery.toLowerCase())

    const now = new Date()
    const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null
    const isOverdue =
      deadline && deadline < now && (task.status || '').toLowerCase().indexOf('hoàn thành') === -1
    const status = (task.status || '').toLowerCase()

    if (statusFilter === 'all') return matchesSearch
    if (statusFilter === 'new')
      return (
        matchesSearch &&
        !status.includes('đang xử lý') &&
        !status.includes('hoàn thành') &&
        !isOverdue
      )
    if (statusFilter === 'doing')
      return matchesSearch && status.includes('đang xử lý') && !isOverdue
    if (statusFilter === 'overdue') return matchesSearch && isOverdue
    if (statusFilter === 'completed') return matchesSearch && status.includes('hoàn thành')

    return matchesSearch
  })

  const totalPages = Math.ceil(filteredTasks.length / pageSize)
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
          <div className="flex items-center ">
            {/* <CardTitle className="text-md font-bold flex items-center gap-2 whitespace-nowrap">
              Danh sách nhiệm vụ
            </CardTitle> */}

            <div className="flex items-center gap-1 max-md:hidden">
              <StatItem
                label="Mới"
                count={stats.new}
                color="info"
                isLoading={isLoading}
                isActive={statusFilter === 'new'}
                onClick={() => {
                  setStatusFilter('new')
                  setCurrentPage(1)
                }}
              />
              <StatItem
                label="Đang làm"
                count={stats.doing}
                color="warning"
                isLoading={isLoading}
                isActive={statusFilter === 'doing'}
                onClick={() => {
                  setStatusFilter('doing')
                  setCurrentPage(1)
                }}
              />
              <StatItem
                label="Quá hạn"
                count={stats.overdue}
                color="destructive"
                isLoading={isLoading}
                isActive={statusFilter === 'overdue'}
                onClick={() => {
                  setStatusFilter('overdue')
                  setCurrentPage(1)
                }}
              />
              <StatItem
                label="Đã xong"
                count={stats.completed}
                color="success"
                isLoading={isLoading}
                isActive={statusFilter === 'completed'}
                onClick={() => {
                  setStatusFilter('completed')
                  setCurrentPage(1)
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 flex items-center">
              {statusFilter !== 'all' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all')
                    setCurrentPage(1)
                  }}
                  className="bg-muted/50 text-muted-foreground rounded-full font-bold px-3 h-8 gap-2 border-none hover:bg-muted transition-all group"
                  title="Nhấn để bỏ lọc"
                >
                  <span className="text-[10px] uppercase">
                    {statusFilter === 'new'
                      ? 'Mới'
                      : statusFilter === 'doing'
                        ? 'Đang làm'
                        : statusFilter === 'overdue'
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
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="relative flex-1 overflow-auto pt-px">
            {/* Desktop Table */}
            <Table className="table-fixed w-full hidden md:table">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-center w-12 text-foreground">STT</TableHead>
                  <TableHead className="font-bold text-foreground w-28">Số hiệu</TableHead>
                  <TableHead className="font-bold text-foreground">Trích yếu nội dung</TableHead>
                  <TableHead className="font-bold text-foreground w-28">Thời hạn</TableHead>
                  <TableHead className="font-bold text-center text-foreground w-28">
                    Trạng thái
                  </TableHead>
                  <TableHead className="font-bold text-center text-foreground w-36">
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
                  Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i} className="h-[48px]">
                      <TableCell className="text-center w-12">
                        <Skeleton className="h-4 w-6 mx-auto" />
                      </TableCell>
                      <TableCell className="w-28">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell className="w-28">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-center w-28">
                        <Skeleton className="h-6 w-20 rounded-full mx-auto" />
                      </TableCell>
                      <TableCell className="text-center w-36">
                        <Skeleton className="h-8 w-32 rounded-lg mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedTasks.length > 0 ? (
                  paginatedTasks.map((task, index) => (
                    <TableRow key={task.id} className="group transition-colors h-[48px]">
                      <TableCell className="text-center text-muted-foreground font-medium text-[11px] w-12">
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="font-bold text-primary text-xs whitespace-nowrap w-28">
                        {task.soVanBan}
                      </TableCell>
                      <TableCell
                        className="truncate font-medium text-muted-foreground text-xs"
                        title={task.trichYeu}
                      >
                        {task.trichYeu}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-bold text-[10px] whitespace-nowrap uppercase w-28">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground/50" />
                          {formatDate(task.hanXuLy)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center w-28">{getStatusBadge(task)}</TableCell>
                      <TableCell className="text-center w-36">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 rounded-lg text-info font-bold hover:bg-info/5 text-[11px]"
                            onClick={() => window.app?.services?.openDocDetail?.(task.id)}
                          >
                            Chi tiết
                          </Button>

                          {!task.status || task.status === 'Chưa xử lý' ? (
                            <Button
                              size="sm"
                              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-[11px] shadow-sm text-white"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/documents/${task.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ ...task, status: 'Đang xử lý' }),
                                  })
                                  if (res.ok) {
                                    toast.success('Đã tiếp nhận văn bản')
                                    fetchTasks()
                                  }
                                } catch (e) {
                                  toast.error('Lỗi kết nối')
                                }
                              }}
                            >
                              Tiếp nhận
                            </Button>
                          ) : (
                            task.status === 'Đang xử lý' && (
                              <Button
                                size="sm"
                                className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-[11px] shadow-sm text-white"
                                onClick={() => {
                                  setSelectedDocId(task.id)
                                  setIsEvidenceModalOpen(true)
                                }}
                              >
                                <Upload className="size-3 mr-1.5" /> Nộp
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-[240px] text-center p-0 align-middle">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                        <CheckCircle2 className="size-16" />
                        <p className="text-sm font-bold">Không có nhiệm vụ nào cần xử lý.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

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
              ) : paginatedTasks.length > 0 ? (
                paginatedTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors"
                  >
                    {/* Row 1: STT + Số hiệu + Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground font-bold shrink-0">
                          {(currentPage - 1) * pageSize + index + 1}.
                        </span>
                        <span className="font-black text-primary text-xs truncate">
                          {task.soVanBan || '—'}
                        </span>
                      </div>
                      {getStatusBadge(task)}
                    </div>

                    {/* Row 2: Trích yếu */}
                    <p className="text-xs font-medium text-muted-foreground leading-snug line-clamp-2">
                      {task.trichYeu || '—'}
                    </p>

                    {/* Row 3: Thời hạn + Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
                        <Calendar className="size-3 text-muted-foreground/50" />
                        <span>{formatDate(task.hanXuLy)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 rounded-lg text-info font-bold text-[11px]"
                          onClick={() => window.app?.services?.openDocDetail?.(task.id)}
                        >
                          Chi tiết
                        </Button>
                        {!task.status || task.status === 'Chưa xử lý' ? (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-[11px] text-white"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/documents/${task.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ ...task, status: 'Đang xử lý' }),
                                })
                                if (res.ok) {
                                  toast.success('Đã tiếp nhận văn bản')
                                  fetchTasks()
                                }
                              } catch (e) {
                                toast.error('Lỗi kết nối')
                              }
                            }}
                          >
                            Tiếp nhận
                          </Button>
                        ) : (
                          task.status === 'Đang xử lý' && (
                            <Button
                              size="sm"
                              className="h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-[11px] text-white"
                              onClick={() => {
                                setSelectedDocId(task.id)
                                setIsEvidenceModalOpen(true)
                              }}
                            >
                              <Upload className="size-3 mr-1" /> Nộp
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 opacity-20">
                  <CheckCircle2 className="size-16" />
                  <p className="text-sm font-bold">Không có nhiệm vụ nào cần xử lý.</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border flex items-center justify-between bg-card/50">
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
                <ChevronLeft className="size-4 mr-1" /> Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs font-semibold px-3"
              >
                Tiếp <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEvidenceModalOpen} onOpenChange={setIsEvidenceModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl glass-card">
          <DialogHeader className="p-8 bg-primary text-white">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-white/10">
                <Upload className="size-5 text-white" />
              </div>
              Nộp kết quả xử lý
            </DialogTitle>
            <DialogDescription className="text-white/80 font-medium">
              Hệ thống sẽ ghi nhận và cập nhật trạng thái văn bản sau khi bạn nộp bằng chứng.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Ghi chú kết quả
              </Label>
              <Textarea
                placeholder="Nhập ghi chú hoặc tóm tắt kết quả xử lý..."
                className="min-h-[100px] rounded-2xl border-border bg-muted/50 focus:bg-background transition-all font-medium p-4"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Tệp minh chứng ({selectedFiles.length})
              </Label>
              <div
                className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer group relative"
                onClick={() => document.getElementById('evidence-file-input').click()}
              >
                <input
                  id="evidence-file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])
                  }
                />
                <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/10 transition-colors">
                  <FileText className="size-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground">
                  Nhấn để chọn hoặc kéo thả tệp tại đây
                </p>
                {selectedFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {selectedFiles.map((file, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm"
                      >
                        <Paperclip size={10} className="text-slate-400" />
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/50 gap-3 border-t border-border">
            <Button
              variant="ghost"
              className="rounded-xl font-bold h-11"
              onClick={() => setIsEvidenceModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              className="rounded-xl bg-success hover:bg-success/90 font-bold px-8 h-11 shadow-lg shadow-success/20 flex-1"
              onClick={handleSubmitEvidence}
              disabled={isSubmitting || !evidenceNotes.trim() || selectedFiles.length === 0}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="size-4 mr-2" />
              )}
              Nộp & Hoàn thành
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskStatCard({ label, count, icon: Icon, iconColor, onClick }) {
  return (
    <Card
      className="shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden glass-card"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className={cn(
            'p-2 rounded-xl transition-transform group-hover:scale-110 duration-300',
            iconColor
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
            {label}
          </p>
          <h3 className="text-xl font-black text-foreground tracking-tight leading-none">
            {count}
          </h3>
        </div>
      </CardContent>
    </Card>
  )
}

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
