import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload as UploadIcon, 
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
  SearchCode
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
          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            id: doc.id,
            soVanBan: doc.soVanBan || '',
            trichYeu: doc.trichYeu || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            status: 'review',
            warnings: doc.ocrWarnings || []
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
      } catch (e) {}
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
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1 border-l-4 border-[#c0392b] pl-4 py-1">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Số hóa hồ sơ hàng loạt</h2>
        <p className="text-sm text-slate-500 font-medium">Tải lên nhiều tệp PDF, AI sẽ bóc tách và hỗ trợ phân công nhanh</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <Card 
            className={cn(
              "relative border-2 border-dashed transition-all duration-300 p-8 text-center h-[300px] flex flex-col items-center justify-center rounded-3xl",
              isDragging ? "border-[#c0392b] bg-red-50/30 scale-[1.02]" : "border-slate-200 bg-white/80 backdrop-blur-md shadow-xl",
              isProcessing && "opacity-50 pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="p-4 rounded-2xl bg-red-50 text-[#c0392b] mb-4">
              <UploadIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Thả tệp PDF vào đây</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6">Tự động nhận diện & bóc tách</p>
            
            <div className="flex flex-col w-full gap-2">
              <Button 
                className="bg-[#c0392b] hover:bg-[#a93226] text-white rounded-xl shadow-lg font-bold"
                onClick={() => fileInputRef.current?.click()}
              >
                Chọn tệp tin
              </Button>
              <Button 
                variant="ghost" 
                className="text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderOpen className="size-4 mr-2" /> Thư mục
              </Button>
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" multiple onChange={(e) => handleFileUpload(Array.from(e.target.files))} />
            <input type="file" ref={folderInputRef} className="hidden" webkitdirectory="true" directory="true" multiple onChange={(e) => handleFileUpload(Array.from(e.target.files))} />
          </Card>

          {isProcessing && (
            <Card className="border-none shadow-2xl bg-[#1a3a6e] text-white p-6 rounded-3xl animate-in zoom-in-95">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Đang xử lý OCR</p>
                    <h4 className="text-sm font-bold truncate max-w-[150px]">{currentFileName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black">{overallProgress}%</span>
                  </div>
                </div>
                <Progress value={overallProgress} className="h-1.5 bg-white/10" indicatorClassName="bg-white" />
              </div>
            </Card>
          )}

          {batchItems.length > 0 && (
            <Card className="p-4 border-slate-100 bg-white/50 backdrop-blur-sm rounded-3xl shadow-lg space-y-3">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Trạng thái đợt tải</h4>
               <div className="space-y-2">
                 <SummaryChip label="Đang OCR" count={summary.processing} color="bg-blue-50 text-blue-600" />
                 <SummaryChip label="Cần rà soát" count={summary.review} countColor="text-amber-600" color="bg-amber-50 text-amber-600" />
                 <SummaryChip label="Sẵn sàng lưu" count={summary.ready} color="bg-emerald-50 text-emerald-600" />
                 <SummaryChip label="Đã lưu" count={summary.success} color="bg-emerald-600 text-white" />
                 <SummaryChip label="Lỗi OCR" count={summary.error} color="bg-rose-50 text-rose-600" />
               </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          {batchItems.length > 0 ? (
            <Card className="border-slate-200 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md">
              <CardHeader className="px-8 py-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
                <div>
                  <CardTitle className="text-lg font-bold">Danh sách bóc tách ({batchItems.length})</CardTitle>
                  <CardDescription>Trang {currentPage} / {totalPages || 1}</CardDescription>
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-600 font-bold" onClick={handleClearBatch}>
                     <Trash className="size-4 mr-2" /> Hủy đợt tải
                   </Button>
                   <Button 
                    variant="outline"
                    size="sm" 
                    className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold rounded-xl"
                    disabled={!batchItems.some(i => i.status === 'review' || i.status === 'ready')}
                    onClick={() => onTabChange('review')}
                   >
                     <SearchCode className="size-4 mr-2" /> Kiểm duyệt đợt tải
                   </Button>
                   <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20"
                    disabled={!batchItems.some(i => i.status === 'ready' || i.status === 'review')}
                    onClick={handleSaveAll}
                   >
                     <Save className="size-4 mr-2" /> Lưu & Phân công tất cả
                   </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="px-8 py-4 font-bold text-slate-800">Tên tệp</TableHead>
                      <TableHead className="font-bold text-slate-800">Số hiệu</TableHead>
                      <TableHead className="font-bold text-slate-800">Thời hạn</TableHead>
                      <TableHead className="font-bold text-slate-800">Phân công</TableHead>
                      <TableHead className="font-bold text-slate-800">Trạng thái</TableHead>
                      <TableHead className="px-8 font-bold text-right text-slate-800">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={item.id} className="group hover:bg-slate-50/30 transition-colors">
                        <TableCell className="px-8">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-[10px]">PDF</div>
                            <span className="text-sm font-bold text-slate-700 max-w-[150px] truncate" title={item.fileName}>
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
                                "h-9 text-xs font-bold rounded-xl border-slate-200",
                                item.warnings?.some(w => w.includes('Số')) && "border-amber-400 bg-amber-50"
                              )}
                            />
                            {item.warnings?.some(w => w.includes('Số')) && (
                              <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date"
                            value={item.thoiHan} 
                            onChange={(e) => updateItem(item.id, 'thoiHan', e.target.value)}
                            className="h-9 text-xs font-bold rounded-xl border-slate-200 w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            <MultiSelectPopover 
                              label="Đơn vị"
                              options={departments.map(d => ({ id: d.id, label: d.name }))}
                              selectedIds={item.departmentIds}
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
                              className="size-8 rounded-xl text-slate-400 hover:text-blue-600" 
                              onClick={() => setEditingItem(item)}
                              title="Sửa nhanh chi tiết"
                            >
                              <Edit3 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl text-slate-400 hover:text-[#1a3a6e]" onClick={() => window.app?.services?.openDocDetail(item.id)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl text-slate-400 hover:text-red-600" onClick={() => handleRemoveItem(item)}>
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
                <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-4 bg-slate-50/30">
                   <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="rounded-xl h-8 px-4"
                   >
                     <ChevronLeft className="size-4 mr-2" /> Trước
                   </Button>
                   <span className="text-xs font-bold text-slate-500">Trang {currentPage} / {totalPages}</span>
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
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl opacity-40 py-20">
              <FileText className="size-16 text-slate-200 mb-4" />
              <p className="text-xl font-bold text-slate-400">Danh sách trống</p>
              <p className="text-sm text-slate-400">Tải tệp tin để bắt đầu xử lý hàng loạt</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-slate-50/50 p-6 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-[#1a3a6e]">
              <Edit3 className="size-5" /> Sửa nhanh chi tiết
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-400">
              Chỉnh sửa thông tin bóc tách cho file: <span className="text-slate-600 font-bold">{editingItem?.fileName}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 grid grid-cols-2 gap-6">
            <div className="space-y-4 col-span-2">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trích yếu nội dung</Label>
                  <Textarea 
                    value={editingItem?.trichYeu || ''} 
                    onChange={(e) => setEditingItem({...editingItem, trichYeu: e.target.value})}
                    placeholder="Nhập trích yếu..."
                    className="rounded-2xl border-slate-200 min-h-[100px] font-medium"
                  />
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Số hiệu</Label>
               <Input 
                  value={editingItem?.soVanBan || ''} 
                  onChange={(e) => setEditingItem({...editingItem, soVanBan: e.target.value})}
                  className="rounded-xl border-slate-200 font-bold text-[#1a3a6e]"
               />
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thời hạn</Label>
               <Input 
                  type="date"
                  value={editingItem?.thoiHan || ''} 
                  onChange={(e) => setEditingItem({...editingItem, thoiHan: e.target.value})}
                  className="rounded-xl border-slate-200"
               />
            </div>

            <div className="space-y-2 col-span-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cơ quan ban hành</Label>
               <Input 
                  value={editingItem?.coQuanChuQuan || ''} 
                  onChange={(e) => setEditingItem({...editingItem, coQuanChuQuan: e.target.value})}
                  className="rounded-xl border-slate-200 font-medium"
               />
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)} className="rounded-xl font-bold">Hủy</Button>
            <Button 
              className="bg-[#1a3a6e] hover:bg-[#132a54] text-white rounded-xl px-8 font-bold shadow-lg"
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
      </Dialog>
    </div>
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

function MultiSelectPopover({ label, options, selectedIds, onToggle, icon: Icon }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-2 flex gap-1 relative">
          <Icon className="size-3 text-slate-400" />
          <span className="text-[10px] font-bold">{label}</span>
          {selectedIds.length > 0 && (
            <Badge className="absolute -top-2 -right-2 size-4 p-0 flex items-center justify-center bg-blue-600 text-white border-white text-[8px] font-black">
              {selectedIds.length}
            </Badge>
          )}
          <ChevronDown className="size-3 text-slate-300" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-100" align="start">
        <div className="p-2 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 py-1">{label}</p>
        </div>
        <div className="h-48 overflow-auto">
          <div className="p-1">
            {options.map((opt) => (
              <div 
                key={opt.id} 
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors"
                onClick={() => onToggle(opt.id)}
              >
                <Checkbox checked={selectedIds.includes(opt.id)} className="rounded-md border-slate-300" />
                <span className="text-xs font-bold text-slate-700">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'processing': return <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 animate-pulse">Đang OCR...</Badge>;
    case 'review': return <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 font-bold">Cần rà soát</Badge>;
    case 'ready': return <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold">Sẵn sàng</Badge>;
    case 'success': return <Badge variant="secondary" className="bg-emerald-600 text-white border-emerald-500 font-black flex gap-1"><Check className="size-3" /> Đã lưu</Badge>;
    case 'error': return <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-100 font-bold">Lỗi OCR</Badge>;
    default: return null;
  }
}
