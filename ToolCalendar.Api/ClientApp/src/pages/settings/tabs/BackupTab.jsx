import React from 'react';
import { Database, Trash2, Download, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function BackupTab() {
  return (
    <Card className="shadow-xl shadow-black/5 glass-card overflow-hidden border-none ring-1 ring-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Database className="size-5 text-primary" />
          <div>
            <CardTitle>Dữ liệu & Sao lưu</CardTitle>
            <CardDescription>Quản lý sao lưu dữ liệu và bảo trì hệ thống</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Section */}
          <div className="border rounded-lg p-6 space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <Download className="size-5 text-success" />
              <h3 className="font-semibold text-sm uppercase tracking-tight">Xuất toàn bộ dữ liệu</h3>
            </div>
            <p className="text-xs text-muted-foreground flex-1">Tải về bản sao lưu toàn bộ thông tin văn bản dưới định dạng CSV.</p>
            <Button variant="secondary" className="w-full">
              <Download className="size-4 mr-2" /> Tải về dữ liệu (.csv)
            </Button>
          </div>

          {/* Cleanup Section */}
          <div className="border rounded-lg p-6 space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <RefreshCcw className="size-5 text-destructive" />
              <h3 className="font-semibold text-sm uppercase tracking-tight">Dọn dẹp hệ thống</h3>
            </div>
            <p className="text-xs text-muted-foreground flex-1">Dọn dẹp các tệp tin tạm và dữ liệu cũ để tối ưu dung lượng.</p>
            <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4 mr-2" /> Tiến hành dọn dẹp
            </Button>
          </div>
        </div>
        
        <div className="bg-primary/5 border rounded-lg p-4 flex items-start gap-3">
          <ShieldCheck className="size-5 text-primary shrink-0" />
          <p className="text-xs text-primary/80 font-medium leading-relaxed">
            Khuyến nghị: Hãy thực hiện sao lưu dữ liệu hàng tuần để đảm bảo an toàn thông tin trước khi thực hiện các thao tác dọn dẹp hệ thống.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
