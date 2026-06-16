import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function KpiCard({ title, description, value, icon: Icon, tone, isLoading, items, emptyText, onClick }) {
  const toneClasses = {
    info: 'text-info bg-info/10 border-info/20',
    danger: 'text-destructive bg-destructive/10 border-destructive/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
  };

  return (
    <Card className="glass-card border-border/60 shadow-subtle rounded-xl overflow-hidden py-4 gap-0">
      <CardContent className="px-4">
        <div className="group w-full text-left">
          <div className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1.3fr)] items-center gap-2">
            <div 
              className="flex flex-col min-w-0 border-r border-border/70 pr-3 gap-1.5 cursor-pointer"
              onClick={onClick}
            >
              {/* Row 1: Title */}
              <h3 className="truncate text-base font-black tracking-tight text-foreground" title={title}>
                {title}
              </h3>

              {/* Row 2: Icon + Value + Arrow */}
              <div className="flex items-center gap-2.5">
                <div className={cn('size-8 rounded-md border flex items-center justify-center shrink-0', toneClasses[tone])}>
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <div className="flex items-end gap-1">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <span className="text-3xl font-black tracking-tighter leading-none text-foreground">
                      {value || 0}
                    </span>
                  )}
                  <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                </div>
              </div>
            </div>

            <div className="min-w-0 h-[68px] flex flex-col justify-start gap-1">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-5 w-full rounded-md" />)
              ) : items?.length > 0 ? (
                items.slice(0, 3).map((doc) => (
                  <button
                    key={`${title}-${doc.id}`}
                    type="button"
                    className="block w-full text-left truncate py-0.5 text-[10px] font-bold leading-4 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    title={doc.trichYeu || doc.tenCongVan || doc.soVanBan}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.app?.services?.openDocDetail) {
                        window.app.services.openDocDetail(doc.id);
                      }
                    }}
                  >
                    {doc.tenCongVan || doc.trichYeu || doc.soVanBan || 'Chưa có tên văn bản'}
                  </button>
                ))
              ) : (
                <span className="block truncate py-0.5 text-[10px] font-bold leading-4 text-muted-foreground opacity-60">
                  {emptyText}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
