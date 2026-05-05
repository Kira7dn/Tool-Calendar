import { Settings as SettingsIcon, Monitor, Clock, Loader2, Save, Send, Play, Scan, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export function GeneralTab({
  config,
  setConfig,
  isSaving,
  onSave,
  pushStatus,
  isTesting,
  onTriggerScan,
  onTestNotification,
  onEnablePush,
  onDisablePush
}) {
  return (
    <Card className="shadow-xl shadow-black/5 glass-card overflow-hidden border-none ring-1 ring-border/50">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center gap-3">
          <SettingsIcon className="size-5 text-primary" />
          <div>
            <CardTitle>Cấu hình chung & Thông báo</CardTitle>
            <CardDescription>Cài đặt cơ bản và quản lý thông báo hệ thống</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Thời gian quét định kỳ
            </Label>
            <div className="flex flex-col items-start gap-1">
              <Input
                type="time"
                value={config.notificationScanTime}
                onChange={e => setConfig({ ...config, notificationScanTime: e.target.value })}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground italic">Hệ thống sẽ quét vào giờ này hàng ngày</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              Thông báo trình duyệt
            </Label>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Badge variant={pushStatus === 'granted' ? 'success' : pushStatus === 'denied' ? 'destructive' : 'outline'}>
                  {pushStatus === 'granted' ? 'ON' : pushStatus === 'denied' ? 'BLOCKED' : 'OFF'}
                </Badge>
                <span className="text-sm font-medium">Nhận tin báo đẩy</span>
              </div>
              <Switch
                checked={pushStatus === 'granted'}
                onCheckedChange={(checked) => checked ? onEnablePush() : onDisablePush()}
                disabled={pushStatus === 'denied'}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={onTestNotification}
            disabled={isTesting || pushStatus !== 'granted'}
            variant="secondary"
          >
            {isTesting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
            Gửi thông báo thử nghiệm
          </Button>

          <Button
            onClick={onTriggerScan}
            disabled={isTesting}
            variant="secondary"
          >
            {isTesting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2" />}
            Kích hoạt quét ngay
          </Button>
        </div>

        <div className="pt-4 flex justify-end">
          <Button
            onClick={onSave}
            disabled={isSaving}
            size="lg"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Lưu cấu hình
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
