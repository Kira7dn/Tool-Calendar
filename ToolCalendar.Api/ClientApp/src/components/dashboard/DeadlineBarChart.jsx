import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatDeadlineLabel(item) {
  if (item.date === 'overdue') return { short: 'Quá hạn', title: 'Quá hạn' };

  const parsedDate = new Date(`${item.date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return { short: item.label || '-', title: item.label || '-' };

  const dateLabel = parsedDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });

  if (item.todayCount > 0 || item.label === 'Hôm nay') {
    return { short: dateLabel, title: `Hôm nay (${dateLabel})` };
  }

  return { short: dateLabel, title: parsedDate.toLocaleDateString('vi-VN') };
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  );
}

export function DeadlineBarChart({ className, data, isLoading }) {
  const chartData = data || [];
  const maxCount = Math.max(...chartData.map((item) => item.count || 0), 1);
  const yTicks = [maxCount, Math.ceil(maxCount / 2), 0].filter((value, index, values) => values.indexOf(value) === index);
  const hasData = chartData.some((item) => (item.count || 0) > 0);

  return (
    <Card className={cn('glass-card border-border/60 shadow-subtle rounded-xl min-h-0 h-full overflow-hidden', className)}>
      <CardHeader className="pb-2 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-black tracking-tight">Biểu đồ thời hạn văn bản</CardTitle>
          </div>
          <Badge variant="outline" className="rounded-full font-bold px-3 py-1">
            14 NGÀY
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-72px)] pb-3">
        <div className="flex h-full flex-col">
          <div className="flex-1 px-1 py-3 relative">
            {/* Legend Overlay */}
            <div className="absolute top-2 right-4 flex gap-4 text-[10px] font-black text-muted-foreground/70 z-20">
              <LegendDot color="bg-destructive" label="QUÁ HẠN" />
              <LegendDot color="bg-warning" label="HÔM NAY" />
              <LegendDot color="bg-info" label="SẮP ĐẾN HẠN" />
            </div>

            {isLoading ? (
              <div className="grid h-full grid-cols-[30px_minmax(0,1fr)] gap-3">
                <div className="flex flex-col justify-between py-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-3 w-5" />
                  ))}
                </div>
                <div className="flex h-full items-end gap-2 border-b border-l border-border/70 pl-3 pb-6">
                {Array.from({ length: 15 }).map((_, index) => (
                  <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <Skeleton className="w-full max-w-9 rounded-t-md" style={{ height: `${24 + (index % 5) * 12}%` }} />
                  </div>
                ))}
                </div>
              </div>
            ) : hasData ? (
              <div className="grid h-full grid-cols-[30px_minmax(0,1fr)] gap-3">
                <div className="flex flex-col justify-between pb-8 pt-1 text-right text-[10px] font-bold text-muted-foreground">
                  {yTicks.map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>
                <div className="relative min-w-0 border-b border-border/70">
                  <div className="flex h-full gap-2 pl-3 pt-6">
                    {chartData.map((item) => {
                      const count = item.count || 0;
                      const height = count > 0 ? Math.max((count / maxCount) * 100, 10) : 2;
                      const label = formatDeadlineLabel(item);
                      const isOverdue = item.date === 'overdue';

                      return (
                        <div 
                          key={item.date} 
                          className={cn(
                            "flex h-full min-w-0 flex-col items-center gap-1",
                            isOverdue ? "flex-[1.5]" : "flex-1"
                          )}
                        >
                          <div className="relative flex min-h-0 w-full flex-1 items-end justify-center">
                            <div
                              className={cn(
                                'w-full transition-all shadow-sm relative flex items-center justify-center',
                                isOverdue ? 'max-w-[60px] rounded-t-lg' : 'max-w-10 rounded-t-md',
                                item.overdueCount > 0
                                  ? 'bg-destructive shadow-lg shadow-destructive/20'
                                  : item.todayCount > 0
                                    ? 'bg-warning shadow-lg shadow-warning/20'
                                    : 'bg-info shadow-lg shadow-info/10'
                              )}
                              style={{ height: `${height}%`, opacity: count > 0 ? 0.9 : 0.15 }}
                              title={`${label.title}: ${count} văn bản`}
                            >
                              {count > 0 && (
                                <span className={cn(
                                  "font-black text-foreground/90 drop-shadow-sm",
                                  isOverdue ? "text-xs" : "text-[10px]"
                                )}>
                                  {count}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="h-5 w-full text-center truncate text-[10px] font-bold leading-5 text-muted-foreground">
                            {label.short}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-muted-foreground">
                Không có văn bản đến hạn trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
