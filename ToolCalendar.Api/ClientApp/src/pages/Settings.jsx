import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Users, 
  Tag, 
  Database, 
  Bell, 
  Scan, 
  History, 
  Save, 
  RefreshCcw, 
  Trash2, 
  Download, 
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Plus,
  X,
  Play,
  Send,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Settings() {
  const [config, setConfig] = useState({
    maxPagesToScan: 5,
    deadlineKeywords: '',
    deadlineExcludeKeywords: '',
    minDeadlineDays: 0,
    notificationScanTime: '08:30',
    statusList: []
  });
  const [activeTab, setActiveTab] = useState('general');
  const [newStatus, setNewStatus] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/stats/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        const statusArray = typeof data.statusList === 'string' 
          ? data.statusList.split(',').filter(s => s.trim()) 
          : (data.statusList || []);
        setConfig({ ...data, statusList: statusArray });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch('/api/admin/audit-logs?limit=50', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        setAuditLogs(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...config,
        statusList: config.statusList.join(',')
      };
      const response = await fetch('/api/stats/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert('Đã lưu cấu hình hệ thống thành công!');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStatus = () => {
    if (!newStatus.trim()) return;
    if (config.statusList.includes(newStatus.trim())) return;
    setConfig({
      ...config,
      statusList: [...config.statusList, newStatus.trim()]
    });
    setNewStatus('');
  };

  const handleRemoveStatus = (status) => {
    setConfig({
      ...config,
      statusList: config.statusList.filter(s => s !== status)
    });
  };

  const triggerScan = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/notification/trigger-scan', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) alert('Đã bắt đầu quét thời hạn văn bản!');
    } catch (e) {
    } finally {
      setIsTesting(false);
    }
  };

  const testNotification = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/notification/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) alert('Đã gửi thông báo thử nghiệm thành công!');
    } catch (e) {
    } finally {
      setIsTesting(false);
    }
  };

  const clearAuditLogs = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống?')) return;
    try {
      const res = await fetch('/api/admin/clear-audit-logs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        setAuditLogs([]);
        alert('Đã dọn sạch nhật ký hệ thống!');
      }
    } catch (e) {}
  };

  const navigation = [
    { id: 'general', label: 'Cấu hình chung', icon: SettingsIcon },
    { id: 'ocr', label: 'Thông số OCR', icon: Scan },
    { id: 'notifications', label: 'Thông báo & Quét', icon: Bell },
    { id: 'audit', label: 'Nhật ký hệ thống', icon: History, onSelect: fetchAuditLogs },
    { id: 'backup', label: 'Dữ liệu & Sao lưu', icon: Database },
  ];

  return (
    <div className="w-full flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-6">
        {/* Header - Compact */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cấu hình hệ thống</h1>
            <p className="text-xs text-slate-500 mt-0.5">Quản lý tham số vận hành Letron-Leos</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
            <ShieldCheck className="size-3.5 text-[#1a3a6e]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="space-y-4">
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    item.onSelect?.();
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg font-bold text-xs transition-all text-left",
                    activeTab === item.id 
                      ? "bg-[#1a3a6e] text-white shadow-md" 
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                  {activeTab === item.id && <ChevronRight className="size-3.5 ml-auto" />}
                </button>
              ))}
            </nav>
            
            <p className="px-4 text-[10px] text-slate-400 leading-relaxed font-medium">
              Thay đổi sẽ được lưu vết để đảm bảo tính minh bạch.
            </p>
          </aside>

          {/* Main Content Area - No fixed min-height */}
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            {activeTab === 'general' && (
              <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/30 border-b border-slate-100 px-6 py-4">
                  <CardTitle className="text-md font-bold">Cài đặt cơ bản & Trạng thái</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giới hạn OCR</Label>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="number" 
                          value={config.maxPagesToScan} 
                          onChange={e => setConfig({...config, maxPagesToScan: parseInt(e.target.value)})}
                          className="w-20 rounded-lg h-10 font-bold bg-slate-50 border-none shadow-inner" 
                        />
                        <p className="text-[10px] text-slate-400 leading-tight">Số trang tối đa / file</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thời gian quét</Label>
                      <Input 
                        type="time" 
                        value={config.notificationScanTime} 
                        onChange={e => setConfig({...config, notificationScanTime: e.target.value})}
                        className="w-28 rounded-lg h-10 font-bold bg-slate-50 border-none shadow-inner" 
                      />
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái văn bản</Label>
                    <div className="flex gap-2">
                       <Input 
                        placeholder="Thêm trạng thái..." 
                        value={newStatus}
                        onChange={e => setNewStatus(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddStatus()}
                        className="max-w-[200px] rounded-lg h-10 bg-slate-50 border-none font-bold px-3 text-xs"
                       />
                       <Button onClick={handleAddStatus} variant="secondary" className="rounded-lg h-10 px-4 font-bold bg-slate-900 text-white hover:bg-black text-xs">
                         <Plus className="size-3.5 mr-1.5" /> Thêm
                       </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {config.statusList.map((status, i) => (
                        <Badge key={i} className="bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex gap-1.5 items-center font-bold shadow-sm text-[10px]">
                          {status}
                          <X className="size-3 cursor-pointer text-slate-300 hover:text-rose-500" onClick={() => handleRemoveStatus(status)} />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      className="rounded-xl bg-[#1a3a6e] hover:bg-[#132a54] font-bold px-8 h-12 shadow-md"
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                      Lưu cấu hình
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'ocr' && (
              <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/30 border-b border-slate-100 px-6 py-4">
                  <CardTitle className="text-md font-bold">Cấu hình OCR</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ khóa thời hạn</Label>
                       <Textarea 
                         value={config.deadlineKeywords}
                         onChange={e => setConfig({...config, deadlineKeywords: e.target.value})}
                         placeholder="hạn cuối, trước ngày..."
                         className="rounded-xl bg-slate-50 border-none min-h-[50px] font-bold p-2 text-[10px]"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ khóa loại trừ</Label>
                       <Textarea 
                         value={config.deadlineExcludeKeywords}
                         onChange={e => setConfig({...config, deadlineExcludeKeywords: e.target.value})}
                         placeholder="ngày ký, ngày ban hành..."
                         className="rounded-xl bg-slate-50 border-none min-h-[50px] font-bold p-2 text-[10px]"
                       />
                    </div>
                  </div>
                    <div className="pt-2 flex justify-end">
                      <Button 
                        className="rounded-xl bg-[#1a3a6e] hover:bg-[#132a54] font-bold px-6 h-10 text-xs shadow-sm"
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                        Lưu thông số
                      </Button>
                    </div>
                </CardContent>
               </Card>
            )}

            {activeTab === 'notifications' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-lg rounded-2xl bg-white p-6 space-y-4">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Scan className="size-4" /> Quét thời hạn
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Cập nhật trạng thái hạn xử lý ngay bây giờ.</p>
                  <Button onClick={triggerScan} disabled={isTesting} className="w-full h-11 rounded-lg bg-amber-600 hover:bg-amber-700 font-bold text-xs">
                    {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Play className="size-3.5 mr-2" />}
                    Kích hoạt ngay
                  </Button>
                </Card>

                <Card className="border-slate-200 shadow-lg rounded-2xl bg-white p-6 space-y-4">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                    <Bell className="size-4" /> Kiểm tra thông báo
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Đảm bảo hệ thống nhắc nhở hoạt động tốt.</p>
                  <Button onClick={testNotification} disabled={isTesting} className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-xs">
                    {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Send className="size-3.5 mr-2" />}
                    Gửi thông báo Test
                  </Button>
                </Card>
              </div>
            )}

            {activeTab === 'audit' && (
              <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/30 border-b border-slate-100 px-6 py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-md font-bold">Nhật ký hệ thống</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-8 bg-white text-xs font-bold" onClick={fetchAuditLogs}>
                      Làm mới
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 text-rose-600 text-xs font-bold" onClick={clearAuditLogs}>
                      Xóa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-none">
                          <TableHead className="font-bold px-6 py-2 text-[10px] uppercase">Thời gian</TableHead>
                          <TableHead className="font-bold py-2 text-[10px] uppercase">Người thực hiện</TableHead>
                          <TableHead className="font-bold py-2 text-[10px] uppercase">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingLogs ? (
                          [...Array(6)].map((_, i) => (
                            <TableRow key={i}>
                              <TableCell className="px-6 py-4"><div className="h-3 w-24 bg-slate-50 animate-pulse rounded" /></TableCell>
                              <TableCell className="py-4"><div className="h-3 w-16 bg-slate-50 animate-pulse rounded" /></TableCell>
                              <TableCell className="py-4"><div className="h-3 w-40 bg-slate-50 animate-pulse rounded" /></TableCell>
                            </TableRow>
                          ))
                        ) : auditLogs.length > 0 ? (
                          auditLogs.map((log, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                              <TableCell className="px-6 py-2 text-[10px] font-bold text-slate-400">
                                {new Date(log.timestamp).toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="font-bold text-slate-700 text-[11px] py-2">{log.userFullName}</TableCell>
                              <TableCell className="text-[11px] font-bold text-slate-500 py-2">{log.action}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="h-40 text-center opacity-30 font-bold text-xs">
                              Chưa có nhật ký
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {activeTab === 'backup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-lg rounded-2xl bg-white p-6 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <Database className="size-4" /> Xuất dữ liệu
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Tải về toàn bộ dữ liệu dưới định dạng CSV.</p>
                  <Button className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-bold text-xs">
                    <Download className="size-3.5 mr-1.5" /> Tải về CSV
                  </Button>
                </Card>
                
                <Card className="border-slate-200 shadow-lg rounded-2xl bg-white p-6 space-y-4 border-rose-100">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Trash2 className="size-4" /> Nguy hiểm
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Dọn dẹp tệp tin rác và dữ liệu cũ ({" > "}1 năm).</p>
                  <Button variant="outline" className="w-full h-11 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs">
                    <RefreshCcw className="size-3.5 mr-1.5" /> Dọn dẹp
                  </Button>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
