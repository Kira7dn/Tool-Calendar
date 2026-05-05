import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, FileText } from 'lucide-react';
import {
  DashboardToolbar,
  KpiCard,
  DeadlineBarChart,
  EventLogCard,
} from '@/components/dashboard';

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
  const [kpiLists, setKpiLists] = useState({
    processing: [],
    overdue: [],
    today: [],
  });
  const [activities, setActivities] = useState([]);
  const [deadlineSeries, setDeadlineSeries] = useState([]);
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
      const [statsRes, activitiesRes, deadlineSeriesRes, processingRes, overdueRes, todayRes] = await Promise.all([
        fetch('/api/stats', { headers }),
        fetch('/api/stats/activities', { headers }),
        fetch('/api/stats/deadline-series?days=14', { headers }),
        fetch('/api/documents?page=1&size=3&sort=deadline_asc', { headers }),
        fetch('/api/documents?page=1&size=3&status=overdue&sort=deadline_asc', { headers }),
        fetch('/api/documents?page=1&size=3&status=today&sort=deadline_asc', { headers }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (activitiesRes.ok) {
        setActivities((await activitiesRes.json()) || []);
      }

      if (deadlineSeriesRes.ok) {
        setDeadlineSeries((await deadlineSeriesRes.json()) || []);
      }

      const nextLists = { processing: [], overdue: [], today: [] };
      if (processingRes.ok) {
        const data = await processingRes.json();
        nextLists.processing = data.data || [];
      }
      if (overdueRes.ok) {
        const data = await overdueRes.json();
        nextLists.overdue = data.data || [];
      }
      if (todayRes.ok) {
        const data = await todayRes.json();
        nextLists.today = data.data || [];
      }
      setKpiLists(nextLists);
    } catch (error) {
      console.error('Dashboard Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const role = localStorage.getItem('user_role') || 'CanBo';
  const canUpload = role === 'Admin' || role === 'VanThu';
  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query) onTabChange('documents', { search: query });
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-3 pb-2 overflow-visible animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <DashboardToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        canUpload={canUpload}
        onUpload={() => onTabChange('upload')}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
        <KpiCard
          title="Đang xử lý"
          description="Chưa hoàn thành"
          value={stats.total}
          icon={FileText}
          tone="info"
          isLoading={isLoading}
          items={kpiLists.processing}
          emptyText="Chưa có dữ liệu danh sách đang xử lý"
          onClick={() => onTabChange('documents')}
        />
        <KpiCard
          title="Quá hạn"
          description="Ưu tiên ngay"
          value={stats.overdue}
          icon={AlertTriangle}
          tone="danger"
          isLoading={isLoading}
          items={kpiLists.overdue}
          emptyText="Không có văn bản quá hạn"
          onClick={() => onTabChange('documents', { status: 'overdue' })}
        />
        <KpiCard
          title="Hạn hôm nay"
          description="Trong ngày"
          value={stats.today}
          icon={Clock}
          tone="warning"
          isLoading={isLoading}
          items={kpiLists.today}
          emptyText="Không có văn bản đến hạn hôm nay"
          onClick={() => onTabChange('documents', { status: 'today' })}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-0 flex-1">
        <DeadlineBarChart className="xl:col-span-8" data={deadlineSeries} isLoading={isLoading} />
        <EventLogCard className="xl:col-span-4" activities={activities} isLoading={isLoading} />
      </section>
    </div>
  );
}

