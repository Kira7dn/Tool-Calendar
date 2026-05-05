import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock,
  FileText,
  Search,
  Upload,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const emptyStats = {
  total: 0,
  urgent: 0,
  overdue: 0,
  today: 0,
  topUrgent: [],
  byDepartment: {},
};

export function Dashboard({ onTabChange }) {
  const [stats, setStats] = useState(emptyStats);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
    const handleUpdate = () => fetchData();
    document.addEventListener('realtime:document_updated', handleUpdate);
    return () => document.removeEventListener('realtime:document_updated', handleUpdate);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token')}` };
      const [statsRes, activitiesRes] = await Promise.all([
        fetch('/api/stats', { headers }),
        fetch('/api/stats/activities', { headers }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (activitiesRes.ok) {
        setActivities((await activitiesRes.json()) || []);
      }
    } catch (error) {
      console.error('Dashboard Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const role = localStorage.getItem('user_role') || 'CanBo';
  const canUpload = role === 'Admin' || role === 'VanThu';
  const focusItems = stats.topUrgent || [];

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query) onTabChange('documents', { search: query });
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-5 pb-6 animate-in fade-in duration-500">
      <DashboardToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        canUpload={canUpload}
        onUpload={() => onTabChange('upload')}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <KpiCard
          title="Đang xử lý"
          description="Văn bản chưa hoàn thành"
          value={stats.total}
          icon={FileText}
          tone="info"
          isLoading={isLoading}
          items={focusItems}
          emptyText="Chưa có dữ liệu danh sách đang xử lý"
          onClick={() => onTabChange('documents')}
        />
        <KpiCard
          title="Quá hạn"
          description="Cần ưu tiên xử lý ngay"
          value={stats.overdue}
          icon={AlertTriangle}
          tone="danger"
          isLoading={isLoading}
          items={focusItems}
          emptyText="Không có văn bản quá hạn"
          onClick={() => onTabChange('documents', { status: 'overdue' })}
        />
        <KpiCard
          title="Đến hạn hôm nay"
          description="Cần hoàn tất trong ngày"
          value={stats.today}
          icon={Clock}
          tone="warning"
          isLoading={isLoading}
          items={focusItems}
          emptyText="Không có văn bản đến hạn hôm nay"
          onClick={() => onTabChange('documents', { status: 'today' })}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-0 flex-1">
        <DeadlineChartPlaceholder className="xl:col-span-8" />
        <EventLogCard className="xl:col-span-4" activities={activities} isLoading={isLoading} />
      </section>
    </div>
  );
}

function DashboardToolbar({ searchQuery, setSearchQuery, onSearch, canUpload, onUpload }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-foreground">Bảng điều hành công văn</h2>
        <p className="text-xs font-semibold text-muted-foreground">
          Theo dõi xử lý, quá hạn và lịch đến hạn của văn bản
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSearch()}
            placeholder="Truy vấn số hiệu hoặc trích yếu..."
            className="h-10 pl-9 pr-3 bg-card"
          />
        </div>
        <Button variant="outline" className="h-10 shrink-0 font-bold" onClick={onSearch}>
          Tìm
        </Button>
        {canUpload && (
          <Button className="h-10 shrink-0 font-bold" onClick={onUpload}>
            <Upload className="size-4 mr-2" />
            Tải tài liệu
          </Button>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, description, value, icon: Icon, tone, isLoading, items, emptyText, onClick }) {
  const toneClasses = {
    info: 'text-info bg-info/10 border-info/20',
    danger: 'text-destructive bg-destructive/10 border-destructive/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
  };

  return (
    <Card className="glass-card border-border/60 shadow-subtle rounded-xl overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              {title}
            </CardTitle>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>
          </div>
          <div className={cn('size-10 rounded-lg border flex items-center justify-center', toneClasses[tone])}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <button type="button" onClick={onClick} className="group flex items-end gap-3 text-left">
          {isLoading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <span className="text-4xl font-black tracking-tight text-foreground">{value || 0}</span>
          )}
          <span className="mb-1.5 inline-flex items-center text-xs font-bold text-muted-foreground group-hover:text-primary">
            Xem danh sách <ArrowRight className="ml-1 size-3" />
          </span>
        </button>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-9 w-full rounded-lg" />)
          ) : items?.length > 0 ? (
            items.slice(0, 3).map((doc) => <MiniDocumentRow key={`${title}-${doc.id}`} doc={doc} />)
          ) : (
            <div className="h-[108px] rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center px-4 text-center text-xs font-semibold text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniDocumentRow({ doc }) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors"
      onClick={() => window.app?.services?.openDocDetail?.(doc.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-black text-foreground">{doc.soVanBan || 'Chưa có số hiệu'}</span>
        <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
          {doc.thoiHan ? new Date(doc.thoiHan).toLocaleDateString('vi-VN') : 'Chưa hạn'}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted-foreground">
        {doc.trichYeu || doc.tenCongVan || 'Không có trích yếu'}
      </p>
    </button>
  );
}

function DeadlineChartPlaceholder({ className }) {
  const bars = [28, 44, 34, 68, 52, 38, 74, 46, 30, 58, 42, 24, 36, 50];

  return (
    <Card className={cn('glass-card border-border/60 shadow-subtle rounded-xl min-h-[420px]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-black">Biểu đồ deadline theo thời gian</CardTitle>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Placeholder: cần API trả số văn bản đến hạn theo ngày và bộ lọc phòng ban
            </p>
          </div>
          <Badge variant="outline" className="rounded-full font-bold">
            14 ngày
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="h-[330px]">
        <div className="flex h-full flex-col">
          <div className="flex-1 rounded-xl border border-dashed border-border bg-background/60 p-4">
            <div className="flex h-full items-end gap-2">
              {bars.map((height, index) => (
                <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-all',
                      index === 0 ? 'bg-destructive/70' : index === 1 ? 'bg-warning/80' : 'bg-primary/45'
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {index === 0 ? 'QH' : index === 1 ? 'HN' : `+${index - 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-muted-foreground">
            <LegendDot color="bg-destructive/70" label="Quá hạn" />
            <LegendDot color="bg-warning/80" label="Hôm nay" />
            <LegendDot color="bg-primary/45" label="Sắp đến hạn" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventLogCard({ className, activities, isLoading }) {
  return (
    <Card className={cn('glass-card border-border/60 shadow-subtle rounded-xl min-h-[420px] overflow-hidden', className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-black flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          Event log cán bộ
        </CardTitle>
        <p className="text-xs font-semibold text-muted-foreground">Hoạt động mới nhất từ hệ thống</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[340px] overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full rounded-lg" />)
          ) : activities.length > 0 ? (
            activities.map((log) => <ActivityRow key={log.id} log={log} />)
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              Chưa có event log
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ log }) {
  return (
    <div className="flex gap-3">
      <div className="size-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
        <User className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug">
          <span className="font-black text-foreground">{log.userFullName || 'Hệ thống'}</span>
          <span className="ml-1 text-muted-foreground">{log.action}</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70">
          <CalendarClock className="size-3" />
          {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : 'Không rõ thời gian'}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  );
}
