/* eslint-disable */
import React from 'react'
import { Activity, User, CalendarDays } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function ActivityRow({ log }) {
  return (
    <div className="flex gap-3">
      <div className="size-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
        <User className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug">
          <span className="font-black text-foreground">{log.userFullName || 'Cán bộ'}</span>
          <span className="ml-1 text-muted-foreground">{log.action}</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70">
          <CalendarDays className="size-3" />
          {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : 'Không rõ thời gian'}
        </div>
      </div>
    </div>
  )
}

export function EventLogCard({ className, activities, isLoading }) {
  return (
    <Card
      className={cn(
        'glass-card border-border/60 shadow-subtle rounded-xl overflow-hidden',
        className
      )}
    >
      <CardHeader className="pb-2 py-3">
        <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          Nhật ký hoạt động
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[280px] xl:h-[calc(100vh-430px)] xl:min-h-[220px] overflow-y-auto p-3 space-y-3 scrollbar-none">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))
          ) : activities.length > 0 ? (
            activities.map((log) => <ActivityRow key={log.id} log={log} />)
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Chưa có hoạt động nào
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
