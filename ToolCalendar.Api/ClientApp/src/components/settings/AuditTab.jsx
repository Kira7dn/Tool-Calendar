import { ROLES } from '../../constants/roles'
import { useEffect, useState } from 'react'
import { History, RefreshCcw, Trash2, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden border">
      <CardHeader className="flex flex-row items-start gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/50 space-y-0">
        <span className="mt-0.5 text-red-600">{icon}</span>
        <div>
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {subtitle}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  )
}

function Avatar({ name, role }) {
  if (!name) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
        <Monitor size={14} />
      </span>
    )
  }
  const initials = name.slice(0, 1).toUpperCase()
  const isAdmin = role === ROLES.ADMIN

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-black border',
        isAdmin
          ? 'bg-amber-50 text-amber-600 border-amber-100'
          : 'bg-red-50 text-red-600 border-red-100'
      )}
    >
      {initials}
    </span>
  )
}

export function AuditTab() {
  const [auditLogs, setAuditLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const pageSize = 8
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const columns = [
    {
      header: 'Thời gian',
      width: 'w-48',
      className: 'text-[10px] font-black text-slate-400 uppercase tracking-widest',
      cell: (row) => (
        <span className="text-[11px] font-bold text-slate-400 font-mono">
          {new Date(row.timestamp).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      header: 'Người dùng',
      width: 'w-48',
      className: 'text-[10px] font-black text-slate-400 uppercase tracking-widest',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.userFullName} role={row.role} />
          <span className="text-[11px] font-bold text-slate-700 tracking-tight">
            {row.userFullName || 'Hệ thống'}
          </span>
        </div>
      ),
    },
    {
      header: 'Hành động',
      className: 'text-[10px] font-black text-slate-400 uppercase tracking-widest',
      cellClassName: 'whitespace-normal break-words min-w-[200px]',
      cell: (row) => (
        <span className="text-xs font-medium text-slate-500 group-hover:text-slate-900 transition-colors leading-relaxed">
          {row.action}
        </span>
      ),
    },
  ]

  useEffect(() => {
    fetchAuditLogs(currentPage)
  }, [currentPage])

  const fetchAuditLogs = async (page) => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch(`/api/admin/audit-logs?page=${page}&pageSize=${pageSize}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
      if (response.ok) {
        const data = await response.json()
        setAuditLogs(data.items || [])
        setTotalCount(data.total || 0)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const clearAuditLogs = async () => {
    setIsClearing(true)
    try {
      const res = await fetch('/api/admin/clear-audit-logs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
      if (res.ok) {
        setAuditLogs([])
        setTotalCount(0)
        setCurrentPage(1)
        toast.success('Đã dọn sạch nhật ký hệ thống!')
      }
    } catch (e) {
      toast.error('Có lỗi xảy ra khi dọn nhật ký')
    } finally {
      setIsClearing(false)
      setIsConfirmOpen(false)
    }
  }

  return (
    <SectionCard
      icon={<History className="size-5" />}
      title="Nhật ký hệ thống"
      subtitle="Theo dõi các hoạt động bảo mật và thao tác người dùng"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {totalCount} hoạt động ghi nhận
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAuditLogs(currentPage)}
            className="rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200"
          >
            <RefreshCcw className={cn('size-3 mr-1.5', isLoadingLogs && 'animate-spin')} />
            Làm mới
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmOpen(true)}
            className="rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-100 border-red-100"
          >
            <Trash2 className="size-3 mr-1.5" />
            Xóa tất cả
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0 relative">
        <DataTable
          columns={columns}
          data={auditLogs}
          isLoading={isLoadingLogs}
          emptyMessage="Chưa có hoạt động nào"
          minWidth="650px"
          pagination={{
            page: currentPage,
            totalPages,
            onPageChange: setCurrentPage,
          }}
        />
      </div>

      <ConfirmationModal
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Xác nhận xóa sạch?"
        description="Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống? Thao tác này không thể hoàn tác."
        confirmLabel="XÓA TẤT CẢ"
        onConfirm={clearAuditLogs}
        isLoading={isClearing}
        variant="destructive"
      />
    </SectionCard>
  )
}
