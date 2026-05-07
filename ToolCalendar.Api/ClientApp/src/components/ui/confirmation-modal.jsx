import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Info, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";

export function ConfirmationModal({ 
  open, 
  onOpenChange, 
  title = "Xác nhận hành động",
  description = "Bạn có chắc chắn muốn thực hiện hành động này? Thao tác này có thể không thể hoàn tác.",
  onConfirm,
  confirmLabel = "XÁC NHẬN",
  cancelLabel = "HỦY BỎ",
  variant = "destructive", // destructive, warning, info, success
  isLoading = false,
  icon
}) {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          icon: <Trash2 size={32} strokeWidth={2.5} />,
          iconBg: "bg-red-50 text-red-600",
          confirmBtn: "bg-red-600 hover:bg-red-700 shadow-red-100",
          titleColor: "text-slate-900"
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={32} strokeWidth={2.5} />,
          iconBg: "bg-amber-50 text-amber-600",
          confirmBtn: "bg-amber-600 hover:bg-amber-700 shadow-amber-100",
          titleColor: "text-slate-900"
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={32} strokeWidth={2.5} />,
          iconBg: "bg-emerald-50 text-emerald-600",
          confirmBtn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
          titleColor: "text-slate-900"
        };
      default: // info
        return {
          icon: <Info size={32} strokeWidth={2.5} />,
          iconBg: "bg-blue-50 text-blue-600",
          confirmBtn: "bg-blue-600 hover:bg-blue-700 shadow-blue-100",
          titleColor: "text-slate-900"
        };
    }
  };

  const styles = getVariantStyles();
  const activeIcon = icon || styles.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-none shadow-2xl overflow-hidden p-0 gap-0">
        <div className="p-8 flex flex-col items-center text-center gap-4">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-2", styles.iconBg)}>
            {activeIcon}
          </div>
          <div className="space-y-2">
            <h3 className={cn("text-xl font-black tracking-tight", styles.titleColor)}>{title}</h3>
            <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
              {description}
            </p>
          </div>
        </div>
        <div className="p-5 bg-slate-50 flex items-center gap-3 border-t border-slate-100">
          <Button 
            variant="ghost" 
            className="flex-1 rounded-xl font-bold text-slate-400 hover:bg-slate-200"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button 
            className={cn(
              "flex-1 rounded-xl text-white font-black uppercase tracking-widest shadow-lg transition-all active:scale-95",
              styles.confirmBtn
            )}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "ĐANG XỬ LÝ..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
