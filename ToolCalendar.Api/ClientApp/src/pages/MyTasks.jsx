import React, { useEffect, useState } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  FileText, 
  ExternalLink, 
  Upload, 
  MoreVertical,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export function MyTasks({ onTabChange }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ new: 0, doing: 0, overdue: 0 });
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    fetchTasks();

    const handleUpdate = () => fetchTasks();
    document.addEventListener('realtime:document_updated', handleUpdate);
    return () => document.removeEventListener('realtime:document_updated', handleUpdate);
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/documents/my-tasks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (taskList) => {
    const now = new Date();
    let n = 0, d = 0, o = 0;
    taskList.forEach(task => {
      const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null;
      const isOverdue = deadline && deadline < now && (task.status || '').toLowerCase().indexOf('hoàn thành') === -1;
      const status = (task.status || '').toLowerCase();
      
      if (isOverdue) o++;
      else if (status.includes('đang xử lý')) d++;
      else if (!status.includes('hoàn thành')) n++;
    });
    setStats({ new: n, doing: d, overdue: o });
  };

  const handleSubmitEvidence = async () => {
    if (!evidenceNotes.trim()) return;
    if (selectedFiles.length === 0) {
      alert('Vui lòng chọn ít nhất 1 file bằng chứng!');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('notes', evidenceNotes);
      selectedFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`/api/documents/${selectedDocId}/submit-evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (response.ok) {
        setIsEvidenceModalOpen(false);
        setEvidenceNotes('');
        setSelectedFiles([]);
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to submit evidence:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getStatusBadge = (task) => {
    const now = new Date();
    const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null;
    const isOverdue = deadline && deadline < now && (task.status || '').toLowerCase().indexOf('hoàn thành') === -1;
    const status = (task.status || '').toLowerCase();

    if (status.includes('đã hoàn thành')) return <Badge variant="success" className="font-bold uppercase text-[10px]">Đã hoàn thành</Badge>;
    if (isOverdue) return <Badge variant="destructive" className="font-bold uppercase text-[10px]">Quá hạn</Badge>;
    if (status.includes('đang xử lý')) return <Badge variant="warning" className="font-bold uppercase text-[10px]">Đang xử lý</Badge>;
    return <Badge variant="info" className="font-bold uppercase text-[10px]">Mới</Badge>;
  };

  // Local Filtering Logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.soVanBan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.trichYeu?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const now = new Date();
    const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null;
    const isOverdue = deadline && deadline < now && (task.status || '').toLowerCase().indexOf('hoàn thành') === -1;
    const status = (task.status || '').toLowerCase();

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'new') return matchesSearch && !status.includes('đang xử lý') && !status.includes('hoàn thành') && !isOverdue;
    if (statusFilter === 'doing') return matchesSearch && status.includes('đang xử lý') && !isOverdue;
    if (statusFilter === 'overdue') return matchesSearch && isOverdue;
    if (statusFilter === 'completed') return matchesSearch && status.includes('hoàn thành');
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col gap-0 border-l-4 border-success pl-3 py-0.5">
        <h2 className="text-xl">Việc của tôi</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Personal Task Queue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TaskStatCard label="Chưa xử lý" count={stats.new} color="text-info" bgColor="bg-info/10" onClick={() => setStatusFilter('new')} />
        <TaskStatCard label="Đang thực hiện" count={stats.doing} color="text-warning" bgColor="bg-warning/10" onClick={() => setStatusFilter('doing')} />
        <TaskStatCard label="Quá hạn" count={stats.overdue} color="text-destructive" bgColor="bg-destructive/10" onClick={() => setStatusFilter('overdue')} />
      </div>

      <Card className="shadow-xl overflow-hidden glass-card">
        <CardHeader className="px-8 py-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Danh sách nhiệm vụ
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground rounded-full font-bold">
                  {statusFilter === 'new' ? 'Mới' : statusFilter === 'doing' ? 'Đang làm' : statusFilter === 'overdue' ? 'Quá hạn' : 'Đã xong'}
                  <X className="size-3 ml-1 cursor-pointer" onClick={() => setStatusFilter('all')} />
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Cập nhật trạng thái và nộp kết quả xử lý tại đây</CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Tìm kiếm văn bản..." 
                className="pl-10 h-10 bg-muted/50"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border">
                  <Filter className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 shadow-2xl glass-card">
                <DropdownMenuItem onClick={() => setStatusFilter('all')} className="font-bold">Tất cả</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('new')} className="text-info font-bold">Việc mới</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('doing')} className="text-warning font-bold">Đang làm</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('overdue')} className="text-destructive font-bold">Quá hạn</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')} className="text-success font-bold">Đã hoàn thành</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-16 font-bold px-8 py-4 text-foreground">STT</TableHead>
                <TableHead className="font-bold py-4 text-foreground">Số hiệu</TableHead>
                <TableHead className="font-bold text-foreground">Trích yếu nội dung</TableHead>
                <TableHead className="font-bold text-foreground">Thời hạn</TableHead>
                <TableHead className="font-bold text-center text-foreground">Trạng thái</TableHead>
                <TableHead className="font-bold text-right px-8 text-foreground">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-8"><div className="h-4 w-6 bg-muted/50 animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted/50 animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-64 bg-muted/50 animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted/50 animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 w-20 bg-muted/50 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="px-8 text-right"><div className="h-8 w-24 bg-muted/50 animate-pulse rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedTasks.length > 0 ? (
                paginatedTasks.map((task, index) => (
                  <TableRow key={task.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell className="px-8 text-muted-foreground font-medium text-xs">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-bold text-secondary whitespace-nowrap">{task.soVanBan}</TableCell>
                    <TableCell className="max-w-md truncate font-medium text-muted-foreground" title={task.trichYeu}>
                      {task.trichYeu}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDate(task.hanXuLy)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(task)}</TableCell>
                    <TableCell className="px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-xl text-info font-bold hover:bg-info/5"
                          onClick={() => window.app?.services?.openDocDetail?.(task.id)}
                        >
                          Chi tiết
                        </Button>
                        <Button 
                          size="sm" 
                          className="rounded-xl bg-secondary hover:bg-sidebar-mid font-bold"
                          onClick={() => {
                            setSelectedDocId(task.id);
                            setIsEvidenceModalOpen(true);
                          }}
                        >
                          <Upload className="size-3.5 mr-2" /> Nộp kết quả
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border/50">
                    <TableCell className="px-8 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-full max-w-[200px]" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-8 py-4 text-right"><Skeleton className="h-8 w-16 rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30">
                      <CheckCircle2 className="size-16 mb-4" />
                      <p className="text-lg font-bold">Không tìm thấy công việc nào phù hợp.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-center gap-4 bg-muted/30">
             <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl h-8 px-4">
               <ChevronLeft className="size-4 mr-2" /> Trước
             </Button>
             <span className="text-xs font-bold text-muted-foreground">Trang {currentPage} / {totalPages}</span>
             <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl h-8 px-4">
               Tiếp <ChevronRight className="size-4 ml-2" />
             </Button>
          </div>
        )}
      </Card>

      <Dialog open={isEvidenceModalOpen} onOpenChange={setIsEvidenceModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-secondary text-secondary-foreground">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary-foreground/10">
                <Upload className="size-5" />
              </div>
              Nộp bằng chứng kết quả
            </DialogTitle>
            <DialogDescription className="text-secondary-foreground/70 font-medium">
              Tải lên tài liệu hoặc ghi chú kết quả xử lý văn bản này.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ghi chú xử lý</Label>
              <Textarea 
                placeholder="Mô tả tóm tắt kết quả xử lý..." 
                className="min-h-[120px] rounded-2xl border-border bg-muted/50 focus:bg-background transition-all font-medium p-4"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tệp đính kèm ({selectedFiles.length})</Label>
              <div 
                className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer group relative"
                onClick={() => document.getElementById('evidence-file-input').click()}
              >
                <input 
                  id="evidence-file-input"
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])}
                />
                <FileText className="size-8 mx-auto text-muted-foreground/30 group-hover:text-secondary transition-colors mb-2" />
                <p className="text-xs font-bold text-muted-foreground">Kéo thả hoặc nhấn để chọn file</p>
                {selectedFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {selectedFiles.map((file, i) => (
                      <Badge key={i} variant="secondary" className="bg-card/50">{file.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/50 gap-3">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsEvidenceModalOpen(false)}>Hủy bỏ</Button>
            <Button 
              className="rounded-xl bg-success hover:bg-success/90 font-bold px-8 shadow-lg shadow-success/20"
              onClick={handleSubmitEvidence}
              disabled={isSubmitting || !evidenceNotes.trim() || selectedFiles.length === 0}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
              Xác nhận hoàn thành
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskStatCard({ label, count, color, bgColor, onClick }) {
  return (
    <Card className="border-border shadow-sm overflow-hidden rounded-3xl cursor-pointer hover:shadow-md transition-all group" onClick={onClick}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
          <h3 className={cn("text-3xl font-black tracking-tighter", color)}>{count}</h3>
        </div>
        <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", bgColor)}>
          <CheckSquare className={cn("size-6", color)} />
        </div>
      </CardContent>
    </Card>
  );
}
