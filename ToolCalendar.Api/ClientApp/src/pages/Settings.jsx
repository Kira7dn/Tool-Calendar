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
  ChevronRight,
  Monitor
} from 'lucide-react';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  unsubscribeUserFromPush 
} from '@/lib/push-notifications';
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
  const [pushStatus, setPushStatus] = useState('loading'); // 'loading', 'granted', 'denied', 'default'

  useEffect(() => {
    fetchSettings();
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const status = await getNotificationPermission();
    setPushStatus(status);
  };

  const handleEnablePush = async () => {
    const status = await requestNotificationPermission();
    setPushStatus(status);
    if (status === 'granted') {
      alert('Đã bật thông báo đẩy thành công!');
    } else if (status === 'denied') {
      alert('Bạn đã chặn thông báo. Vui lòng cho phép trong cài đặt trình duyệt.');
    }
  };

  const handleDisablePush = async () => {
    await unsubscribeUserFromPush();
    setPushStatus('default');
    alert('Đã tắt thông báo đẩy.');
  };

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
          <div className="flex flex-col gap-0 border-l-4 border-secondary pl-3 py-0.5">
            <h2 className="text-xl">Cấu hình hệ thống</h2>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">System Governance & Preferences</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-border">
            <ShieldCheck className="size-3.5 text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Security Active</span>
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
                      ? "bg-secondary text-secondary-foreground shadow-md" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                  {activeTab === item.id && <ChevronRight className="size-3.5 ml-auto" />}
                </button>
              ))}
            </nav>
            
            <p className="px-4 text-[10px] text-muted-foreground leading-relaxed font-medium">
              Thay đổi sẽ được lưu vết để đảm bảo tính minh bạch.
            </p>
          </aside>

          {/* Main Content Area - No fixed min-height */}
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            {activeTab === 'general' && (
              <Card className="shadow-lg glass-card overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border px-6 py-4">
                  <CardTitle className="text-md font-bold">Cài đặt cơ bản & Trạng thái</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Giới hạn OCR</Label>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="number" 
                          value={config.maxPagesToScan} 
                          onChange={e => setConfig({...config, maxPagesToScan: parseInt(e.target.value)})}
                          className="w-20 rounded-lg h-10 font-bold bg-muted/50 border-none shadow-inner" 
                        />
                        <p className="text-[10px] text-muted-foreground leading-tight">Số trang tối đa / file</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Thời gian quét</Label>
                      <Input 
                        type="time" 
                        value={config.notificationScanTime} 
                        onChange={e => setConfig({...config, notificationScanTime: e.target.value})}
                        className="w-28 rounded-lg h-10 font-bold bg-muted/50 border-none shadow-inner" 
                      />
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trạng thái văn bản</Label>
                    <div className="flex gap-2">
                       <Input 
                        placeholder="Thêm trạng thái..." 
                        value={newStatus}
                        onChange={e => setNewStatus(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddStatus()}
                        className="max-w-[200px] rounded-lg h-10 bg-muted/50 border-none font-bold px-3 text-xs"
                       />
                       <Button onClick={handleAddStatus} variant="secondary" className="rounded-lg h-10 px-4 font-bold text-xs">
                         <Plus className="size-3.5 mr-1.5" /> Thêm
                       </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {config.statusList.map((status, i) => (
                        <Badge key={i} className="bg-card text-foreground hover:bg-muted/50 border border-border px-2.5 py-1 rounded-lg flex gap-1.5 items-center font-bold shadow-sm text-[10px]">
                          {status}
                          <X className="size-3 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleRemoveStatus(status)} />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      className="rounded-xl bg-secondary hover:bg-sidebar-mid font-bold px-8 h-12 shadow-md"
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
              <Card className="shadow-lg glass-card overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border px-6 py-4">
                  <CardTitle className="text-md font-bold">Cấu hình OCR</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Từ khóa thời hạn</Label>
                       <Textarea 
                         value={config.deadlineKeywords}
                         onChange={e => setConfig({...config, deadlineKeywords: e.target.value})}
                         placeholder="hạn cuối, trước ngày..."
                         className="rounded-xl bg-muted/50 border-none min-h-[50px] font-bold p-2 text-[10px]"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Từ khóa loại trừ</Label>
                       <Textarea 
                         value={config.deadlineExcludeKeywords}
                         onChange={e => setConfig({...config, deadlineExcludeKeywords: e.target.value})}
                         placeholder="ngày ký, ngày ban hành..."
                         className="rounded-xl bg-muted/50 border-none min-h-[50px] font-bold p-2 text-[10px]"
                       />
                    </div>
                  </div>
                    <div className="pt-2 flex justify-end">
                      <Button 
                        className="rounded-xl bg-secondary hover:bg-sidebar-mid font-bold px-6 h-10 text-xs shadow-sm"
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
                <Card className="shadow-lg glass-card p-6 space-y-4">
                  <div className="flex items-center gap-2 text-warning font-bold text-sm">
                    <Scan className="size-4" /> Quét thời hạn
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">Cập nhật trạng thái hạn xử lý ngay bây giờ.</p>
                  <Button onClick={triggerScan} disabled={isTesting} className="w-full h-11 rounded-lg bg-warning hover:bg-warning/90 font-bold text-xs">
                    {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Play className="size-3.5 mr-2" />}
                    Kích hoạt ngay
                  </Button>
                </Card>

                <Card className="shadow-lg glass-card p-6 space-y-4">
                  <div className="flex items-center gap-2 text-info font-bold text-sm">
                    <Bell className="size-4" /> Kiểm tra thông báo
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">Đảm bảo hệ thống nhắc nhở hoạt động tốt.</p>
                  <Button onClick={testNotification} disabled={isTesting} className="w-full h-11 rounded-lg bg-info hover:bg-info/90 font-bold text-xs">
                    {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Send className="size-3.5 mr-2" />}
                    Gửi thông báo Test
                  </Button>
                </Card>

                <Card className="shadow-lg glass-card p-6 space-y-4 col-span-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                      <Monitor className="size-4" /> Thông báo trình duyệt (Browser Push)
                    </div>
                    <Badge variant={pushStatus === 'granted' ? 'success' : pushStatus === 'denied' ? 'destructive' : 'outline'} className="rounded-full font-bold uppercase text-[9px]">
                      {pushStatus === 'granted' ? 'Đang bật' : pushStatus === 'denied' ? 'Đã chặn' : 'Chưa bật'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    Nhận thông báo ngay lập tức trên máy tính hoặc điện thoại ngay cả khi bạn không mở trình duyệt.
                  </p>
                  <div className="flex gap-3">
                    {pushStatus !== 'granted' ? (
                      <Button onClick={handleEnablePush} className="flex-1 h-11 rounded-lg bg-secondary hover:bg-secondary/90 font-bold text-xs">
                        Kích hoạt thông báo đẩy
                      </Button>
                    ) : (
                      <Button onClick={handleDisablePush} variant="outline" className="flex-1 h-11 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/5 font-bold text-xs">
                        Tắt thông báo đẩy
                      </Button>
                    )}
                  </div>
                  {pushStatus === 'denied' && (
                    <p className="text-[10px] text-destructive font-bold text-center mt-2">
                      ⚠️ Trình duyệt đang chặn thông báo. Bạn cần vào cài đặt trình duyệt để cho phép lại.
                    </p>
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'audit' && (
              <Card className="shadow-lg glass-card overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border px-6 py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-md font-bold">Nhật ký hệ thống</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-8 bg-card text-xs font-bold" onClick={fetchAuditLogs}>
                      Làm mới
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 text-destructive text-xs font-bold" onClick={clearAuditLogs}>
                      Xóa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader className="bg-muted/50">
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
                              <TableCell className="px-6 py-4"><div className="h-3 w-24 bg-muted/50 animate-pulse rounded" /></TableCell>
                              <TableCell className="py-4"><div className="h-3 w-16 bg-muted/50 animate-pulse rounded" /></TableCell>
                              <TableCell className="py-4"><div className="h-3 w-40 bg-muted/50 animate-pulse rounded" /></TableCell>
                            </TableRow>
                          ))
                        ) : auditLogs.length > 0 ? (
                          auditLogs.map((log, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30 transition-colors border-border">
                              <TableCell className="px-6 py-2 text-[10px] font-bold text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="font-bold text-foreground text-[11px] py-2">{log.userFullName}</TableCell>
                              <TableCell className="text-[11px] font-bold text-muted-foreground py-2">{log.action}</TableCell>
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
                <Card className="shadow-lg glass-card p-6 space-y-4">
                  <div className="flex items-center gap-2 text-success font-bold text-sm">
                    <Database className="size-4" /> Xuất dữ liệu
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Tải về toàn bộ dữ liệu dưới định dạng CSV.</p>
                  <Button className="w-full h-11 rounded-lg bg-success hover:bg-success/90 font-bold text-xs">
                    <Download className="size-3.5 mr-1.5" /> Tải về CSV
                  </Button>
                </Card>
                
                <Card className="shadow-lg glass-card p-6 space-y-4 border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <Trash2 className="size-4" /> Nguy hiểm
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Dọn dẹp tệp tin rác và dữ liệu cũ ({" > "}1 năm).</p>
                  <Button variant="outline" className="w-full h-11 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/5 font-bold text-xs">
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
