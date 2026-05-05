import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Clock,
  Bell,
  Loader2,
  Send,
  Play,
  Scan,
  Monitor,
  X,
  Plus,
  Hash
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function GeneralTab({
  config,
  setConfig,
  isSaving,
  onSave,
  pushStatus,
  isTesting,
  onTriggerScan,
  onTestNotification
}) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');

  const handleAddTag = (field, value, setter) => {
    if (!value.trim()) return;
    const current = config[field] || '';
    const tags = current ? current.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (!tags.includes(value.trim())) {
      const newTags = [...tags, value.trim()].join(', ');
      setConfig(prev => ({ ...prev, [field]: newTags }));
      setTimeout(() => onSave(), 0);
    }
    setter('');
  };

  const handleRemoveTag = (field, tagToRemove) => {
    const current = config[field] || '';
    const tags = current.split(',').map(t => t.trim()).filter(Boolean);
    const newTags = tags.filter(t => t !== tagToRemove).join(', ');
    setConfig(prev => ({ ...prev, [field]: newTags }));
    setTimeout(() => onSave(), 0);
  };

  const renderTags = (field, value) => {
    if (!value) return null;
    const tags = value.split(',').map(t => t.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {tags.map((tag, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="pl-2 pr-1 py-0.5 flex items-center gap-1 group bg-primary/5 hover:bg-primary/10 border-primary/20 transition-all"
          >
            <span className="text-[11px] font-bold text-primary/80">{tag}</span>
            <button
              onClick={() => handleRemoveTag(field, tag)}
              className="p-0.5 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Card className="shadow-xl shadow-black/5 glass-card overflow-hidden border-none ring-1 ring-border/50">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="size-5 text-primary" />
            <div>
              <CardTitle>Cấu hình chung & OCR</CardTitle>
              <CardDescription>Cài đặt cơ bản, nhận diện văn bản và thông báo</CardDescription>
            </div>
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              ĐANG LƯU...
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {/* Hàng 1: Thời gian và Thông báo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Thời gian quét định kỳ
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={config.notificationScanTime}
                onChange={e => setConfig({ ...config, notificationScanTime: e.target.value })}
                onBlur={onSave}
                className="w-40 font-bold focus:ring-primary/20"
              />
              <span className="text-xs text-muted-foreground italic leading-none">
                Hệ thống sẽ quét vào giờ này hàng ngày
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              Thông báo trình duyệt
            </Label>
            <div className="flex h-10 items-center justify-between rounded-md border border-input bg-primary/5 px-3 py-2 text-sm ring-offset-background transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                <span className="text-xs font-black text-primary uppercase tracking-tight leading-none">
                  Hệ thống đang trực tuyến
                </span>
              </div>
              <Badge variant="success" className="rounded-sm px-1.5 py-0.5 font-black text-[9px] leading-none border-none shadow-sm h-4 flex items-center">
                ACTIVE
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Hàng 2: Cấu hình OCR nâng cao */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Monitor className="size-4 text-primary" />
              Giới hạn trang quét OCR
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.maxPagesToScan}
                onChange={e => setConfig({ ...config, maxPagesToScan: parseInt(e.target.value) || 0 })}
                onBlur={onSave}
                className="w-24 font-bold text-center"
              />
              <span className="text-xs text-muted-foreground italic">Trang/tệp tin</span>
            </div>
          </div>
        </div> */}

        {/* Từ khóa OCR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Scan className="size-4 text-primary" />
              Từ khóa thời hạn (Deadline)
            </Label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag('deadlineKeywords', newKeyword, setNewKeyword)}
                  placeholder="Nhập từ khóa và nhấn Enter..."
                  className="pr-10 h-10 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-10 w-10 text-primary hover:bg-primary/10"
                  onClick={() => handleAddTag('deadlineKeywords', newKeyword, setNewKeyword)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {renderTags('deadlineKeywords', config.deadlineKeywords)}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <X className="size-4 text-destructive" />
              Từ khóa loại trừ (Exclude)
            </Label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={newExcludeKeyword}
                  onChange={e => setNewExcludeKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag('deadlineExcludeKeywords', newExcludeKeyword, setNewExcludeKeyword)}
                  placeholder="Nhập từ khóa loại trừ..."
                  className="pr-10 h-10 text-sm border-destructive/20 focus:ring-destructive/10"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-10 w-10 text-destructive hover:bg-destructive/10"
                  onClick={() => handleAddTag('deadlineExcludeKeywords', newExcludeKeyword, setNewExcludeKeyword)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {renderTags('deadlineExcludeKeywords', config.deadlineExcludeKeywords)}
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Nút hành động chính */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={onTriggerScan}
            disabled={isTesting}
            variant="outline"
            className="w-full h-10 text-xs font-black border-dashed hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-all uppercase tracking-tight"
          >
            {isTesting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Play className="size-4 mr-2" />}
            Kích hoạt quét ngay
          </Button>

          <Button
            onClick={onTestNotification}
            disabled={isTesting || pushStatus !== 'granted'}
            variant="outline"
            className="w-full h-10 text-xs font-black border-dashed hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-all uppercase tracking-tight"
          >
            {isTesting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
            Gửi thông báo thử nghiệm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
