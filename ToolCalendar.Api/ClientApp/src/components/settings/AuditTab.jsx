import React, { useEffect, useState } from 'react';
import { History, RefreshCcw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from 'sonner';

export function AuditTab() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const pageSize = 6;

  useEffect(() => {
    fetchAuditLogs(currentPage);
  }, [currentPage]);

  const fetchAuditLogs = async (page) => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`/api/admin/audit-logs?page=${page}&pageSize=${pageSize}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.items || []);
        setTotalCount(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const clearAuditLogs = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống?')) return;
    try {
      const res = await fetch('/api/admin/clear-audit-logs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        setAuditLogs([]);
        setTotalCount(0);
        setCurrentPage(1);
        toast.success('Đã dọn sạch nhật ký hệ thống!');
      }
    } catch (e) { }
  };

  return (
    <Card className="shadow-xl shadow-black/5 glass-card overflow-hidden border-none ring-1 ring-border/50 h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <History className="size-5 text-primary" />
          <div>
            <CardTitle>Nhật ký hệ thống</CardTitle>
            <CardDescription>Theo dõi các hoạt động bảo mật và thao tác người dùng</CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchAuditLogs(currentPage)}>
            <RefreshCcw className="size-4 mr-2" /> Làm mới
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={clearAuditLogs}>
            <Trash2 className="size-4 mr-2" /> Xóa tất cả
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="min-h-[300px] flex flex-col">
          <div className="flex-1">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-border/50">
                  <TableHead className="px-5 w-[180px] text-xs font-bold uppercase tracking-wider text-muted-foreground">Thời gian</TableHead>
                  <TableHead className="w-[200px] text-xs font-bold uppercase tracking-wider text-muted-foreground">Người dùng</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLogs ? (
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i} className="border-border/30 h-[40px]">
                      <TableCell className="px-5 py-0"><div className="h-4 w-28 bg-muted/50 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-0"><div className="h-4 w-24 bg-muted/50 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-0"><div className="h-4 w-full bg-muted/50 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : auditLogs.length > 0 ? (
                  auditLogs.map((log, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/2 transition-colors border-border/30 h-[40px]">
                      <TableCell className="px-5 py-0 text-sm text-muted-foreground/80 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="py-0">
                        <div className="flex items-center gap-2">
                          <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {log.userFullName?.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{log.userFullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground py-0">
                        <span className="bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 inline-block text-xs font-medium">{log.action}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="h-[240px]">
                    <TableCell colSpan={3} className="text-center opacity-30 text-xs font-bold tracking-widest uppercase">
                      CHƯA CÓ DỮ LIỆU
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-5 h-[40px] border-t border-border/50 bg-muted/5 shrink-0 text-xs">
            <p className="font-bold text-muted-foreground uppercase tracking-wider">
              Trang {currentPage} / {totalPages || 1}
            </p>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1 || isLoadingLogs}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="h-7 px-3 text-xs"
              >
                Trước
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage >= totalPages || isLoadingLogs}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="h-7 px-3 text-xs"
              >
                Sau
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
