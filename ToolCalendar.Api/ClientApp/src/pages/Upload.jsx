import React, { useState, useRef, useEffect } from 'react';
import {
  Upload as UploadIcon,
  UploadCloud,
  FileText,
  FolderOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  User,
  MoreVertical,
  Trash2,
  Eye,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Save,
  Trash,
  Send,
  Layers,
  Edit3,
  SearchCode,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

export function Upload({ onTabChange }) {
  const [isDragging, setIsDragging] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/admin/departments', { headers }),
        fetch('/api/users', { headers })
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData.filter(u => u.role === 'CanBo' || u.role === 'Admin'));
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles);
    }
  };

  const parseIds = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val || '[]'); } catch { return []; }
  };

  const handleFileUpload = async (fileList) => {
    setIsProcessing(true);
    setOverallProgress(0);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setCurrentFileName(file.name);
      setOverallProgress(Math.round(((i) / fileList.length) * 100));

      const tempId = `temp-${Date.now()}-${i}`;
      const newItem = {
        id: tempId,
        fileName: file.name,
        soVanBan: '',
        trichYeu: '',
        coQuanChuQuan: '',
        thoiHan: '',
        departmentIds: [],
        assignedToIds: [],
        status: 'processing',
        warnings: []
      };

      setBatchItems(prev => [newItem, ...prev]);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: formData
        });

        if (response.ok) {
          const doc = await response.json();
          const sUserIds = parseIds(doc.assignedUserIds || doc.assignedToIds);
          const sDeptIds = parseIds(doc.assignedDepartmentIds || doc.departmentIds);

          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            id: doc.id,
            soVanBan: doc.soVanBan || '',
            trichYeu: doc.trichYeu || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            status: (sUserIds.length || sDeptIds.length) ? 'ready' : 'review',
            warnings: doc.ocrWarnings || [],
            suggestedUserIds: sUserIds,
            suggestedDeptIds: sDeptIds,
            assignedToIds: sUserIds,
            departmentIds: sDeptIds
          } : item));
        } else {
          setBatchItems(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
        }
      } catch (error) {
        setBatchItems(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
      }
    }

    setOverallProgress(100);
    setTimeout(() => {
      setIsProcessing(false);
      setCurrentFileName('');
    }, 1000);
  };

  const updateItem = (id, field, value) => {
    setBatchItems(prev => prev.map(item => {
      if (item.id === id) {
        let updated = { ...item, [field]: value };

        if (field === 'assignedToIds') {
          const userIds = value;
          const currentDeptIds = [...updated.departmentIds];
          userIds.forEach(uid => {
            const user = users.find(u => u.id === uid);
            if (user && user.departmentId && !currentDeptIds.includes(user.departmentId)) {
              currentDeptIds.push(user.departmentId);
            }
          });
          updated.departmentIds = currentDeptIds;
        }

        if (updated.status === 'review' && (updated.departmentIds.length > 0 || updated.assignedToIds.length > 0)) {
          updated.status = 'ready';
        } else if (updated.status === 'ready' && updated.departmentIds.length === 0 && updated.assignedToIds.length === 0) {
          updated.status = 'review';
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveAll = async () => {
    const targets = batchItems.filter(item => item.status === 'ready' || item.status === 'review');
    if (targets.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const item of targets) {
      try {
        const saveRes = await fetch(`/api/documents/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: item.id,
            soVanBan: item.soVanBan,
            trichYeu: item.trichYeu,
            coQuanChuQuan: item.coQuanChuQuan,
            thoiHan: item.thoiHan ? `${item.thoiHan}T00:00:00` : null,
            status: 'Chưa xử lý'
          })
        });

        if (saveRes.ok) {
          if (item.departmentIds.length > 0 || item.assignedToIds.length > 0) {
            await fetch(`/api/documents/${item.id}/assign`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                departmentIds: item.departmentIds,
                userIds: item.assignedToIds
              })
            });
          }

          setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success' } : i));
          successCount++;
        }
      } catch (e) {
        console.error(e);
      }
    }

    setIsProcessing(false);
    if (successCount === targets.length) {
      setTimeout(() => setBatchItems([]), 2000);
    }
  };

  const handleClearBatch = async () => {
    if (batchItems.length === 0) return;
    if (!confirm('Bạn có chắc chắn muốn hủy đợt bóc tách này? Thao tác này sẽ xóa vĩnh viễn các văn bản khỏi hệ thống.')) return;

    const realIds = batchItems.filter(i => typeof i.id === 'number').map(i => i.id);
    if (realIds.length > 0) {
      try {
        await fetch('/api/documents/bulk-delete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(realIds)
        });
      } catch (e) {
        console.error('Failed to cleanup on server:', e);
      }
    }
    setBatchItems([]);
    setCurrentPage(1);
  };

  const handleRemoveItem = async (item) => {
    if (typeof item.id === 'number') {
      try {
        await fetch('/api/documents/bulk-delete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([item.id])
        });
      } catch (e) { }
    }
    setBatchItems(prev => prev.filter(i => i.id !== item.id));
  };

  const shortenFileName = (name, maxLength = 24) => {
    if (name.length <= maxLength) return name;
    const extIndex = name.lastIndexOf('.');
    if (extIndex === -1) return name.substring(0, maxLength) + '...';
    const ext = name.substring(extIndex);
    const base = name.substring(0, extIndex);
    const chars = Math.max(5, maxLength - ext.length - 3);
    return base.substring(0, chars) + '...' + ext;
  };

  const summary = {
    processing: batchItems.filter(i => i.status === 'processing').length,
    review: batchItems.filter(i => i.status === 'review').length,
    ready: batchItems.filter(i => i.status === 'ready').length,
    success: batchItems.filter(i => i.status === 'success').length,
    error: batchItems.filter(i => i.status === 'error').length
  };

  const totalPages = Math.ceil(batchItems.length / pageSize);
  const paginatedItems = batchItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-[var(--space-page)] flex flex-col h-full animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-info pl-3 py-0.5">
        <h2 className="text-xl">Số hóa tài liệu</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">PDF OCR Engine</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-[var(--space-page)] flex-1 min-h-0">
        <div className="w-full lg:w-[320px] xl:w-[350px] flex-shrink-0 space-y-4 flex flex-col justify-center">
          <Card
            className={cn(
              "gap-2 relative group flex flex-col items-center justify-center p-2 text-center min-h-[320px] rounded-3xl transition-all duration-300 border-2 border-dashed",
              isDragging
                ? "border-primary bg-primary/5 ring-4 ring-primary/10 scale-[1.02]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 glass-card"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept="application/pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => handleFileUpload(Array.from(e.target.files))}
              title=""
            />

            <div className={cn(
              "flex items-center justify-center size-14 rounded-full mb-3 transition-all duration-300 shadow-sm",
              isDragging ? "bg-primary text-primary-foreground scale-110" : "bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary/20"
            )}>
              <UploadCloud className="size-7" />
            </div>

            <h3 className="text-sm font-semibold mb-1 text-foreground">
              {isDragging ? "Thả tệp vào đây..." : "Tải tệp tin lên"}
            </h3>

            <p className="text-xs text-muted-foreground max-w-[220px] mb-6">
              Kéo thả tệp PDF vào đây hoặc chọn tải lên từ máy tính.
            </p>

            <div className="flex flex-col gap-2 w-full max-w-[200px] relative z-20">
              <Button
                variant={isDragging ? "default" : "primary"}
                className="font-bold rounded-xl shadow-sm w-full pointer-events-none"
              >
                Chọn tệp tin
              </Button>
              <Button
                variant="outline"
                className="font-bold rounded-xl text-muted-foreground hover:bg-muted/50 w-full"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); folderInputRef.current?.click(); }}
              >
                <FolderOpen className="size-3.5 mr-2" />
                Tải cả thư mục
              </Button>
            </div>

            <input type="file" ref={folderInputRef} className="hidden" webkitdirectory="true" directory="true" multiple onChange={(e) => handleFileUpload(Array.from(e.target.files))} />
          </Card>

          {isProcessing && (
            <Card className="border-none shadow-2xl bg-primary text-primary-foreground p-6 rounded-3xl animate-in zoom-in-95">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/50">Đang xử lý OCR</p>
                    <h4 className="text-sm font-bold truncate max-w-[150px]">{currentFileName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black">{overallProgress}%</span>
                  </div>
                </div>
                <Progress value={overallProgress} className="h-1.5 bg-primary-foreground/10" indicatorClassName="bg-primary-foreground" />
              </div>
            </Card>
          )}

          {batchItems.length > 0 && (
            <Card className="p-4 shadow-lg space-y-3 glass-card">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Trạng thái đợt tải</h4>
              <div className="space-y-2">
                <SummaryChip label="Đang OCR" count={summary.processing} color="bg-info/10 text-info" />
                <SummaryChip label="Cần rà soát" count={summary.review} countColor="text-warning" color="bg-warning/10 text-warning" />
                <SummaryChip label="Sẵn sàng lưu" count={summary.ready} color="bg-success/10 text-success" />
                <SummaryChip label="Đã lưu" count={summary.success} color="bg-success text-success-foreground" />
                <SummaryChip label="Lỗi OCR" count={summary.error} color="bg-destructive/10 text-destructive" />
              </div>
            </Card>
          )}
        </div>

        <div className="flex-1 space-y-4 flex flex-col min-w-0">
          {batchItems.length > 0 ? (
            <Card className="shadow-2xl flex-1 flex flex-col overflow-hidden glass-card gap-2 px-2 py-0">
              <CardHeader className="px-6 py-6 border-b border-border flex flex-col md:flex-row items-center justify-between bg-muted/20">
                <div>
                  <h3 className="text-lg">Danh sách bóc tách ({batchItems.length})</h3>
                  <CardDescription>Trang {currentPage} / {totalPages || 1}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive font-bold" onClick={handleClearBatch}>
                    <Trash className="size-4 mr-2" /> Hủy đợt tải
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-warning/30 text-warning bg-warning/10 hover:bg-warning/20 font-bold rounded-xl"
                    disabled={!batchItems.some(i => i.status === 'review' || i.status === 'ready')}
                    onClick={() => onTabChange('review')}
                  >
                    <SearchCode className="size-4 mr-2" /> Kiểm duyệt đợt tải
                  </Button>
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success/90 text-success-foreground font-bold rounded-xl shadow-lg shadow-success/20"
                    disabled={!batchItems.some(i => i.status === 'ready' || i.status === 'review')}
                    onClick={handleSaveAll}
                  >
                    <Save className="size-4 mr-2" /> Lưu & Phân công tất cả
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="px-8 py-4 font-bold text-foreground">Tên tệp</TableHead>
                      <TableHead className="font-bold text-foreground">Số hiệu</TableHead>
                      <TableHead className="font-bold text-foreground">Thời hạn</TableHead>
                      <TableHead className="font-bold text-foreground">Phân công</TableHead>
                      <TableHead className="font-bold text-foreground">Trạng thái</TableHead>
                      <TableHead className="px-8 font-bold text-right text-foreground">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="px-8">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">PDF</div>
                            <span className="text-sm font-bold text-foreground max-w-[150px] truncate" title={item.fileName}>
                              {shortenFileName(item.fileName)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              value={item.soVanBan}
                              onChange={(e) => updateItem(item.id, 'soVanBan', e.target.value)}
                              placeholder="Số hiệu..."
                              className={cn(
                                "h-9 text-xs font-bold rounded-xl border-border",
                                item.warnings?.some(w => w.includes('Số')) && "border-warning/50 bg-warning/10"
                              )}
                            />
                            {item.warnings?.some(w => w.includes('Số')) && (
                              <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-warning" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={item.thoiHan}
                            onChange={(e) => updateItem(item.id, 'thoiHan', e.target.value)}
                            className="h-9 text-xs font-bold rounded-xl border-border w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            <MultiSelectPopover
                              label="Đơn vị"
                              options={departments.map(d => ({ id: d.id, label: d.name }))}
                              selectedIds={item.departmentIds}
                              suggestedIds={item.suggestedDeptIds}
                              onToggle={(id) => {
                                const newIds = item.departmentIds.includes(id)
                                  ? item.departmentIds.filter(i => i !== id)
                                  : [...item.departmentIds, id];
                                updateItem(item.id, 'departmentIds', newIds);
                              }}
                              icon={Building2}
                            />
                            <MultiSelectPopover
                              label="Cán bộ"
                              options={users.map(u => ({ id: u.id, label: u.fullName }))}
                              selectedIds={item.assignedToIds}
                              suggestedIds={item.suggestedUserIds}
                              onToggle={(id) => {
                                const newIds = item.assignedToIds.includes(id)
                                  ? item.assignedToIds.filter(i => i !== id)
                                  : [...item.assignedToIds, id];
                                updateItem(item.id, 'assignedToIds', newIds);
                              }}
                              icon={User}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="px-8 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-xl text-muted-foreground hover:text-info"
                              onClick={() => setEditingItem(item)}
                              title="Sửa nhanh chi tiết"
                            >
                              <Edit3 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-primary" onClick={() => window.app?.services?.openDocDetail(item.id)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-center gap-4 bg-muted/30">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="rounded-xl h-8 px-4"
                  >
                    <ChevronLeft className="size-4 mr-2" /> Trước
                  </Button>
                  <span className="text-xs font-bold text-muted-foreground">Trang {currentPage} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="rounded-xl h-8 px-4"
                  >
                    Tiếp <ChevronRight className="size-4 ml-2" />
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="shadow-sm flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border glass-card bg-muted/10">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <FileText className="size-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold text-foreground">Danh sách trống</p>
              <p className="text-xs text-muted-foreground mt-1">Tải tệp tin để bắt đầu xử lý hàng loạt</p>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Edit Dialog */}
      < Dialog open={!!editingItem
      } onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-muted/50 p-6 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-primary">
              <Edit3 className="size-5" /> Sửa nhanh chi tiết
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              Chỉnh sửa thông tin bóc tách cho file: <span className="text-foreground font-bold">{editingItem?.fileName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 grid grid-cols-2 gap-6">
            <div className="space-y-4 col-span-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trích yếu nội dung</Label>
                <Textarea
                  value={editingItem?.trichYeu || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, trichYeu: e.target.value })}
                  placeholder="Nhập trích yếu..."
                  className="rounded-2xl border-border min-h-[100px] font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Số hiệu</Label>
              <Input
                value={editingItem?.soVanBan || ''}
                onChange={(e) => setEditingItem({ ...editingItem, soVanBan: e.target.value })}
                className="rounded-xl border-border font-bold text-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Thời hạn</Label>
              <Input
                type="date"
                value={editingItem?.thoiHan || ''}
                onChange={(e) => setEditingItem({ ...editingItem, thoiHan: e.target.value })}
                className="rounded-xl border-border"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cơ quan ban hành</Label>
              <Input
                value={editingItem?.coQuanChuQuan || ''}
                onChange={(e) => setEditingItem({ ...editingItem, coQuanChuQuan: e.target.value })}
                className="rounded-xl border-border font-medium"
              />
            </div>
          </div>

          <DialogFooter className="bg-muted/50 p-6 gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)} className="rounded-xl font-bold">Hủy</Button>
            <Button
              className="bg-primary hover:bg-sidebar-mid text-primary-foreground rounded-xl px-8 font-bold shadow-lg"
              onClick={() => {
                updateItem(editingItem.id, 'trichYeu', editingItem.trichYeu);
                updateItem(editingItem.id, 'soVanBan', editingItem.soVanBan);
                updateItem(editingItem.id, 'thoiHan', editingItem.thoiHan);
                updateItem(editingItem.id, 'coQuanChuQuan', editingItem.coQuanChuQuan);
                setEditingItem(null);
              }}
            >
              Cập nhật thông tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
}

function SummaryChip({ label, count, color, countColor }) {
  if (count === 0 && !label.includes('Đã lưu')) return null;
  return (
    <div className={cn("flex items-center justify-between p-2.5 rounded-2xl border border-transparent transition-all", color)}>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      <span className={cn("text-xs font-black", countColor)}>{count}</span>
    </div>
  );
}

function MultiSelectPopover({ label, options, selectedIds, suggestedIds, onToggle, icon: Icon }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-xl border-border px-2 flex gap-1 relative">
          <Icon className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-bold">{label}</span>
          {selectedIds.length > 0 && (
            <Badge className="absolute -top-2 -right-2 size-4 p-0 flex items-center justify-center bg-primary text-primary-foreground border-background text-[8px] font-black">
              {selectedIds.length}
            </Badge>
          )}
          <ChevronDown className="size-3 text-muted-foreground/30" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 rounded-2xl overflow-hidden shadow-2xl border-border" align="start">
        <div className="p-2 border-b border-border bg-muted/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1">{label}</p>
        </div>
        <div className="h-48 overflow-auto">
          <div className="p-1">
            {options.map((opt) => {
              const isSuggested = suggestedIds?.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 hover:bg-muted/30 cursor-pointer rounded-xl transition-colors",
                    isSuggested && "bg-info/5 border-l-2 border-info"
                  )}
                  onClick={() => onToggle(opt.id)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.includes(opt.id)} className="rounded-md border-border" />
                    <span className={cn("text-xs font-bold", isSuggested ? "text-info" : "text-foreground")}>{opt.label}</span>
                  </div>
                  {isSuggested && <Sparkles className="size-3 text-info" />}
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'processing': return <Badge variant="info" className="animate-pulse">Đang OCR...</Badge>;
    case 'review': return <Badge variant="warning">Cần rà soát</Badge>;
    case 'ready': return <Badge variant="success">Sẵn sàng</Badge>;
    case 'success': return <Badge variant="success" className="bg-success text-success-foreground font-black flex gap-1"><Check className="size-3" /> Đã lưu</Badge>;
    case 'error': return <Badge variant="destructive">Lỗi OCR</Badge>;
    default: return null;
  }
}
