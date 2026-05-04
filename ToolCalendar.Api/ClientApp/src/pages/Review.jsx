import React, { useEffect, useState, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Trash2, 
  Maximize2, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  User,
  Layout,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Review({ onBack }) {
  const [docs, setDocs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    soVanBan: '',
    coQuanChuQuan: '',
    trichYeu: '',
    thoiHan: '',
    departmentId: '',
    assignedTo: ''
  });

  useEffect(() => {
    fetchReviewDocs();
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
        setUsers(userData.filter(u => u.role === 'CanBo'));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (docs.length > 0 && docs[currentIndex]) {
      const doc = docs[currentIndex];
      setFormData({
        soVanBan: doc.soVanBan || '',
        coQuanChuQuan: doc.coQuanChuQuan || '',
        trichYeu: doc.trichYeu || '',
        thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
        departmentId: doc.departmentId || '',
        assignedTo: doc.assignedTo || ''
      });
    }
  }, [currentIndex, docs]);

  const fetchReviewDocs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/documents?status=Chưa xử lý&size=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch review docs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const doc = docs[currentIndex];
    setIsSaving(true);
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...doc,
          ...formData,
          thoiHan: formData.thoiHan ? `${formData.thoiHan}T00:00:00` : null,
          status: 'Đã rà soát'
        })
      });

      if (response.ok) {
        // Also assign if data provided
        if (formData.departmentId || formData.assignedTo) {
          await fetch(`/api/documents/${doc.id}/assign`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              departmentIds: formData.departmentId ? [parseInt(formData.departmentId)] : [],
              userIds: formData.assignedTo ? [parseInt(formData.assignedTo)] : []
            })
          });
        }

        const newDocs = [...docs];
        newDocs.splice(currentIndex, 1);
        setDocs(newDocs);
        if (currentIndex >= newDocs.length && newDocs.length > 0) {
          setCurrentIndex(newDocs.length - 1);
        }
      }
    } catch (error) {
      console.error('Failed to save review:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa văn bản này?')) return;
    const doc = docs[currentIndex];
    try {
      const response = await fetch(`/api/documents/bulk-delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([doc.id])
      });
      if (response.ok) {
        const newDocs = [...docs];
        newDocs.splice(currentIndex, 1);
        setDocs(newDocs);
      }
    } catch (e) {}
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="size-10 animate-spin text-[#1a3a6e]" />
        <p className="text-slate-500 font-bold">Đang chuẩn bị dữ liệu OCR...</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="p-6 rounded-full bg-slate-100">
          <CheckCircle2 className="size-12 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-black text-slate-900">Hoàn tất kiểm duyệt!</h3>
        <p className="text-slate-500 font-medium">Tất cả văn bản mới đã được xử lý thông tin.</p>
        <Button onClick={onBack} className="rounded-xl bg-[#1a3a6e] px-8 h-12 font-bold mt-4 shadow-xl">
          Quay lại Dashboard
        </Button>
      </div>
    );
  }

  const currentDoc = docs[currentIndex];

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col animate-in fade-in zoom-in-95 duration-300">
      <header className="h-16 bg-slate-800 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10 rounded-full">
            <X className="size-5" />
          </Button>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col">
            <h2 className="text-white font-bold text-sm">Kiểm duyệt bóc tách OCR</h2>
            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">
              Tài liệu {currentIndex + 1} / {docs.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => prev - 1)}
            className="text-white hover:bg-white/10 rounded-xl px-4"
          >
            <ChevronLeft className="size-4 mr-2" /> Trước đó
          </Button>
          <Button 
            variant="ghost" 
            disabled={currentIndex === docs.length - 1}
            onClick={() => setCurrentIndex(prev => prev + 1)}
            className="text-white hover:bg-white/10 rounded-xl px-4"
          >
            Tiếp theo <ChevronRight className="size-4 ml-2" />
          </Button>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 shadow-lg shadow-emerald-500/20"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Xác nhận & Lưu
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-slate-700 flex flex-col overflow-hidden relative border-r border-white/5">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-4">
            <span className="text-white text-xs font-bold">{currentDoc.fileName}</span>
            <div className="h-3 w-px bg-white/20" />
            <a href={currentDoc.filePath} target="_blank" className="text-white hover:text-blue-400">
               <ExternalLink className="size-4" />
            </a>
          </div>
          
          <div className="flex-1">
             <iframe 
                src={`${currentDoc.filePath}#toolbar=0&navpanes=0`} 
                className="w-full h-full border-none"
                title="PDF Preview"
             />
          </div>
        </div>

        <div className="w-[500px] bg-white flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-8">
              <div className="space-y-1">
                <Badge className="bg-[#1a3a6e] text-white font-black text-[10px] uppercase tracking-tighter mb-2">Thông tin AI đề xuất</Badge>
                <h3 className="text-xl font-bold text-slate-900">Bóc tách thông tin</h3>
                <p className="text-sm text-slate-500">Vui lòng kiểm tra và chỉnh sửa nếu AI nhận diện sai</p>
              </div>

              <div className="space-y-6">
                <FormField label="Số văn bản / Số hiệu" icon={FileText}>
                  <Input 
                    value={formData.soVanBan} 
                    onChange={e => setFormData({...formData, soVanBan: e.target.value})}
                    className="rounded-xl border-slate-200 h-12 font-bold text-[#1a3a6e]" 
                  />
                </FormField>

                <FormField label="Ngày ban hành / Thời hạn" icon={Calendar}>
                  <Input 
                    type="date"
                    value={formData.thoiHan} 
                    onChange={e => setFormData({...formData, thoiHan: e.target.value})}
                    className="rounded-xl border-slate-200 h-12 font-medium" 
                  />
                </FormField>

                <FormField label="Cơ quan chủ quản / Ban hành" icon={Building2}>
                  <Input 
                    value={formData.coQuanChuQuan} 
                    onChange={e => setFormData({...formData, coQuanChuQuan: e.target.value})}
                    className="rounded-xl border-slate-200 h-12 font-medium" 
                  />
                </FormField>

                <FormField label="Trích yếu nội dung" icon={Layout}>
                  <Textarea 
                    value={formData.trichYeu} 
                    onChange={e => setFormData({...formData, trichYeu: e.target.value})}
                    className="rounded-xl border-slate-200 min-h-[150px] font-medium leading-relaxed" 
                  />
                </FormField>

                <div className="pt-4 border-t border-slate-100">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">Phân công xử lý</Label>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Phòng ban</Label>
                        <select 
                          value={formData.departmentId}
                          onChange={e => setFormData({...formData, departmentId: e.target.value})}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium"
                        >
                          <option value="">Chọn đơn vị...</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700">Cán bộ</Label>
                        <select 
                          value={formData.assignedTo}
                          onChange={e => setFormData({...formData, assignedTo: e.target.value})}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium"
                        >
                          <option value="">Chọn cán bộ...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                        </select>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
            <Button variant="ghost" onClick={handleDelete} className="w-full text-rose-600 font-bold hover:bg-rose-50 rounded-xl h-12">
              <Trash2 className="size-4 mr-2" /> Xóa tài liệu này
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function FormField({ label, icon: Icon, children }) {
  return (
    <div className="space-y-3 group">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-[#1a3a6e] transition-colors">
          {label}
        </Label>
        <Icon className="size-3.5 text-slate-300 group-focus-within:text-[#1a3a6e] transition-colors" />
      </div>
      {children}
    </div>
  );
}
