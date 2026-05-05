import React from 'react';
import { Scan, Monitor, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export function OCRTab({ config, setConfig, isSaving, onSave }) {
  return (
    <Card className="shadow-xl shadow-black/5 glass-card overflow-hidden border-none ring-1 ring-border/50">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center gap-3">
          <Scan className="size-5 text-primary" />
          <div>
            <CardTitle>Cấu hình thuật toán OCR</CardTitle>
            <CardDescription>Điều chỉnh các thông số nhận diện văn bản</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Monitor className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Giới hạn trang quét</p>
              <p className="text-xs text-muted-foreground">Số trang tối đa OCR sẽ xử lý trong mỗi tệp tin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.maxPagesToScan}
              onChange={e => setConfig({ ...config, maxPagesToScan: parseInt(e.target.value) || 0 })}
              className="w-20 text-center"
            />
            <span className="text-xs font-medium text-muted-foreground">Trang</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Từ khóa thời hạn</Label>
            <Textarea
              value={config.deadlineKeywords}
              onChange={e => setConfig({ ...config, deadlineKeywords: e.target.value })}
              placeholder="Ví dụ: hạn cuối, trước ngày..."
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Từ khóa loại trừ</Label>
            <Textarea
              value={config.deadlineExcludeKeywords}
              onChange={e => setConfig({ ...config, deadlineExcludeKeywords: e.target.value })}
              placeholder="Ví dụ: ngày ký, ngày ban hành..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            size="lg"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Lưu thông số OCR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
