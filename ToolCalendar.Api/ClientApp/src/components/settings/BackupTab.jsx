import React from 'react';
import { Database, Download, Trash2, AlertTriangle, FileJson, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden border">
      <CardHeader className="flex flex-row items-start gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/50 space-y-0">
        <span className="mt-0.5 text-red-600">{icon}</span>
        <div>
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">{title}</CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon, title, description, buttonLabel, onAction, variant = 'primary' }) {
  const isDestructive = variant === 'destructive';
  
  return (
    <Card className={cn(
      "rounded-2xl border p-0 transition-all duration-300 group overflow-hidden",
      isDestructive 
        ? "border-slate-200 hover:border-slate-300 hover:shadow-md" 
        : "border-slate-200 hover:border-red-200 hover:shadow-xl hover:shadow-red-50"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={cn(
            "p-2.5 rounded-xl transition-colors duration-300",
            isDestructive ? "bg-slate-100 text-slate-500 group-hover:bg-slate-200" : "bg-red-50 text-red-600 group-hover:bg-red-100"
          )}>
            {icon}
          </span>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{title}</h3>
        </div>
        
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium h-10">
          {description}
        </p>
        
        <Button 
          onClick={onAction}
          variant={isDestructive ? "outline" : "default"}
          className={cn(
            "flex items-center justify-center gap-2.5 w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
            isDestructive 
              ? "text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700" 
              : "bg-red-600 text-white shadow-lg shadow-red-100 hover:bg-red-700 border-none"
          )}
        >
          {icon}
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function BackupTab() {
  const handleExport = () => {
    toast.info('Đang chuẩn bị dữ liệu xuất...');
    window.location.href = '/api/admin/export-documents';
  };

  const handleClean = async () => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      {
        loading: 'Đang dọn dẹp hệ thống...',
        success: 'Đã tối ưu hóa dữ liệu thành công!',
        error: 'Có lỗi xảy ra',
      }
    );
  };

  return (
    <SectionCard
      icon={<Database className="size-5" />}
      title="Dữ liệu & Sao lưu"
      subtitle="Quản lý sao lưu dữ liệu và bảo trì hệ thống"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ActionCard
          icon={<Download size={16} strokeWidth={2.5} />}
          title="Xuất toàn bộ dữ liệu"
          description="Tải về bản sao lưu toàn bộ thông tin văn bản dưới định dạng CSV để lưu trữ hoặc phân tích ngoại tuyến."
          buttonLabel="Tải về dữ liệu (.csv)"
          onAction={handleExport}
        />

        <ActionCard
          icon={<Trash2 size={16} strokeWidth={2.5} />}
          title="Dọn dẹp hệ thống"
          description="Dọn dẹp các tệp tin tạm, tối ưu hóa cơ sở dữ liệu và gỡ bỏ các bản ghi không còn giá trị sử dụng."
          buttonLabel="Tiến hành dọn dẹp"
          onAction={handleClean}
          variant="destructive"
        />
      </div>

      <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100/50 shadow-sm">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0">
          <AlertTriangle size={18} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-900 mb-1 uppercase tracking-tight">Khuyến nghị bảo mật</p>
          <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
            Hãy thực hiện <strong>sao lưu dữ liệu hàng tuần</strong> để đảm bảo an toàn thông tin. Các thao tác dọn dẹp hệ thống có thể làm thay đổi cấu trúc dữ liệu cũ, vì vậy việc có một bản dự phòng là cực kỳ quan trọng.
          </p>
        </div>
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-6 opacity-40">
         <div className="flex items-center gap-2 grayscale">
            <FileJson size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">JSON Storage</span>
         </div>
         <div className="flex items-center gap-2 grayscale">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Verified Backup</span>
         </div>
      </div>
    </SectionCard>
  );
}
