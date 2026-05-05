import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getStatusConfig } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Dashboard({ onTabChange }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    total: 0,
    urgent: 0,
    overdue: 0,
    today: 0
  });
  const [recentDocs, setRecentDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentDocs();
    
    const handleUpdate = () => {
      fetchStats();
      fetchRecentDocs();
    };
    document.addEventListener('realtime:document_updated', handleUpdate);
    
    return () => {
      document.removeEventListener('realtime:document_updated', handleUpdate);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        renderChart(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRecentDocs = async () => {
    try {
      const response = await fetch('/api/documents?page=1&size=4', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecentDocs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (statsData) => {
    const canvas = document.getElementById('dashboardChart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    const existingChart = window.Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: [t('overdue_docs'), t('urgent_docs'), t('processing')],
        datasets: [{
          data: [
            statsData.overdue || 0,
            statsData.urgent || 0,
            Math.max((statsData.total || 0) - (statsData.overdue || 0) - (statsData.urgent || 0), 0)
          ],
          backgroundColor: [
            'hsl(0 84.2% 60.2%)', // destructive
            'hsl(37.9 90.2% 50%)', // warning
            'hsl(142.1 70.6% 45.3%)' // success
          ],
          borderWidth: 0,
          offset: 10
        }]
      },
      options: {
        plugins: {
          legend: { display: false }
        },
        cutout: '80%',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });
  };

  const getStatusBadge = (doc) => {
    const status = doc.trangThai || doc.status;
    const daysLeft = doc.soNgayConLai;
    const config = getStatusConfig(status, daysLeft);
    
    return (
      <Badge variant={config.variant} className="px-2 py-0 rounded-full font-bold text-[9px] uppercase">
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const handleStatClick = (type) => {
    if (onTabChange) {
      const filters = {};
      if (type === 'overdue') {
        filters.status = 'overdue';
        filters.sort = 'deadline_asc';
      } else if (type === 'urgent') {
        filters.status = 'urgent'; 
        filters.sort = 'deadline_asc';
      } else if (type === 'today') {
        filters.status = 'today'; 
        filters.sort = 'deadline_asc';
      }
      onTabChange('documents', filters);
    }
  };

  const completionPercentage = stats.total > 0 
    ? Math.round(((stats.total - stats.overdue) / stats.total) * 100) 
    : 0;

  return (
    <div className="w-full flex flex-col space-y-[var(--space-page)] animate-in fade-in duration-[var(--duration-smooth)] pb-2">
      <div className="flex flex-col gap-0 border-l-4 border-secondary pl-3 py-0.5">
        <h2 className="text-xl">{t('dashboard')}</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Real-time surveillance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-card shadow-sm h-24 overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4 h-full">
                <Skeleton className="size-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard 
              label={t('total_docs')} 
              value={stats.total} 
              icon={FileText} 
              iconColor="text-info bg-info/10"
              onClick={() => handleStatClick('total')}
            />
            <StatCard 
              label={t('urgent_docs')} 
              value={stats.urgent} 
              icon={Clock} 
              iconColor="text-warning bg-warning/10"
              onClick={() => handleStatClick('urgent')}
            />
            <StatCard 
              label={t('overdue_docs')} 
              value={stats.overdue} 
              icon={AlertTriangle} 
              iconColor="text-destructive bg-destructive/10"
              onClick={() => handleStatClick('overdue')}
            />
            <StatCard 
              label={t('today_docs')} 
              value={stats.today} 
              icon={CheckCircle2} 
              iconColor="text-success bg-success/10"
              onClick={() => handleStatClick('today')}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-sm overflow-hidden glass-card">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b border-border">
            <h3 className="text-md">{t('recent_activity')}</h3>
            <Button variant="ghost" size="sm" className="h-7 text-info font-bold hover:text-info/90 text-[11px]" onClick={() => handleStatClick('all')}>
              {t('view_all')} <ArrowRight className="ml-1 size-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-10 font-black text-[10px] uppercase text-muted-foreground px-5 py-2">STT</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-muted-foreground py-2">Số văn bản</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-muted-foreground py-2">Trích yếu</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-muted-foreground py-2">Thời hạn</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-muted-foreground py-2 text-right px-5">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-5"><Skeleton className="h-3 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                      <TableCell className="px-5"><Skeleton className="h-4 w-16 ml-auto rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : recentDocs.length > 0 ? (
                  recentDocs.map((doc, index) => (
                    <TableRow 
                      key={doc.id} 
                      className="cursor-pointer group hover:bg-muted/50 border-border"
                      onClick={() => window.app?.services?.openDocDetail?.(doc.id)}
                    >
                      <TableCell className="text-muted-foreground/30 font-black text-[10px] px-5 py-2.5">{index + 1}</TableCell>
                      <TableCell className="font-black text-secondary text-xs py-2.5">{doc.soVanBan}</TableCell>
                      <TableCell className="max-w-[250px] truncate text-muted-foreground font-bold text-xs py-2.5" title={doc.trichYeu}>
                        {doc.trichYeu || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-bold text-[11px] py-2.5">{formatDate(doc.thoiHan)}</TableCell>
                      <TableCell className="text-right px-5 py-2.5">{getStatusBadge(doc)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground/30 font-bold text-xs">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm overflow-hidden flex flex-col glass-card">
          <CardHeader className="py-3 px-5 border-b border-border">
            <h3 className="text-md">{t('performance')}</h3>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="relative h-32 flex items-center justify-center">
              <canvas id="dashboardChart"></canvas>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-1">
                <span className="text-2xl font-black text-foreground leading-none">{completionPercentage}%</span>
                <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest mt-1">{t('completion_rate')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <ProgressRow label={t('status_overdue')} count={stats.overdue} total={stats.total} color="bg-destructive" />
              <ProgressRow label={t('status_urgent')} count={stats.urgent} total={stats.total} color="bg-warning" />
              <ProgressRow label={t('processing')} count={Math.max(stats.total - stats.overdue - stats.urgent, 0)} total={stats.total} color="bg-success" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconColor, onClick }) {
  return (
    <Card 
      className="shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden glass-card"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110 duration-300", iconColor)}>
          <Icon className="size-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">{label}</p>
          <h3 className="text-xl font-black text-foreground tracking-tight leading-none">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-black">
        <span className="text-muted-foreground uppercase tracking-tighter">{label}</span>
        <span className="text-foreground">{count}</span>
      </div>
      <Progress value={percentage} indicatorClassName={color} className="h-1 bg-muted" />
    </div>
  );
}
