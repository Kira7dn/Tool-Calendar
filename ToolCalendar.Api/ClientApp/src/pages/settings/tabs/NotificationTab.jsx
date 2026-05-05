import React from 'react';
import { Bell, Scan, Play, Send, Monitor, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export function NotificationTab({ 
  pushStatus, 
  isTesting, 
  onTriggerScan, 
  onTestNotification, 
  onEnablePush, 
  onDisablePush 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
      {/* Scan Card */}
      <Card className="shadow-xl shadow-black/5 glass-card border-none ring-1 ring-border/50 p-6 flex flex-col group hover:ring-warning/30 transition-all">
        <div className="size-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
          <Scan className="size-5" />
        </div>
        <div className="flex-1 mb-6">
          <h3 className="font-black text-foreground uppercase tracking-tight text-sm mb-1.5">Quét thời hạn ngay lập tức</h3>
          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Hệ thống sẽ duyệt qua toàn bộ văn bản để cập nhật trạng thái hạn xử lý.</p>
        </div>
        <Button onClick={onTriggerScan} disabled={isTesting} className="w-full h-10 rounded-lg bg-warning hover:bg-warning/90 font-black text-xs shadow-lg shadow-warning/20 shrink-0">
          {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Play className="size-3.5 mr-2" />}
          KÍCH HOẠT QUÉT HỆ THỐNG
        </Button>
      </Card>

      {/* Push Card */}
      <Card className="shadow-xl shadow-black/5 glass-card border-none ring-1 ring-border/50 p-6 flex flex-col group hover:ring-primary/30 transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Monitor className="size-5" />
          </div>
          <Switch 
            checked={pushStatus === 'granted'} 
            onCheckedChange={(checked) => checked ? onEnablePush() : onDisablePush()}
            disabled={pushStatus === 'denied'}
          />
        </div>

        <div className="flex-1 mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-black text-foreground uppercase tracking-tight text-sm">Thông báo trình duyệt</h3>
            <Badge variant={pushStatus === 'granted' ? 'success' : pushStatus === 'denied' ? 'destructive' : 'outline'} className="rounded-full font-black uppercase text-[8px] px-2 py-0">
              {pushStatus === 'granted' ? 'ON' : pushStatus === 'denied' ? 'BLOCKED' : 'OFF'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Nhận thông báo ngay lập tức trên máy tính hoặc điện thoại.</p>
          {pushStatus === 'denied' && (
            <p className="text-[9px] text-destructive font-bold mt-1.5 flex items-center gap-1">
              ⚠️ Quyền bị trình duyệt chặn
            </p>
          )}
        </div>
        
        <Button 
          onClick={onTestNotification} 
          disabled={isTesting || pushStatus !== 'granted'} 
          className="w-full h-10 rounded-lg bg-info hover:bg-info/90 font-black text-xs shadow-lg shadow-info/20 shrink-0"
        >
          {isTesting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Send className="size-3.5 mr-2" />}
          GỬI THÔNG BÁO THỬ NGHIỆM
        </Button>
      </Card>
    </div>
  );
}
