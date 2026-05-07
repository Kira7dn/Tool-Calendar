import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Scan,
  Database,
  History
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  unsubscribeUserFromPush
} from '@/lib/push-notifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import Tab Components from components/settings
import {
  GeneralTab,
  AuditTab,
  BackupTab
} from '@/components/settings';

export function Settings() {
  const [config, setConfig] = useState({
    maxPagesToScan: 5,
    deadlineKeywords: '',
    deadlineExcludeKeywords: '',
    minDeadlineDays: 0,
    notificationScanTime: '08:30',
    statusList: []
  });
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pushStatus, setPushStatus] = useState('loading');

  useEffect(() => {
    fetchSettings();
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const status = await getNotificationPermission();
    setPushStatus(status);
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/stats/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/stats/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (response.ok) toast.success('Đã lưu cấu hình hệ thống thành công!');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerScan = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/notification/trigger-scan', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) toast.success('Đã bắt đầu quét thời hạn văn bản!');
    } catch (e) {
    } finally {
      setIsTesting(false);
    }
  };

  const testNotification = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/notification/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) toast.success('Đã gửi thông báo thử nghiệm thành công!');
    } catch (e) {
    } finally {
      setIsTesting(false);
    }
  };

  const tabs = [
    {
      id: 'general',
      label: 'Cấu hình chung',
      icon: <SettingsIcon className="size-4" />,
      desc: 'Cài đặt OCR & Thông báo'
    },
    {
      id: 'audit',
      label: 'Nhật ký hệ thống',
      icon: <History className="size-4" />,
      desc: 'Theo dõi hoạt động bảo mật'
    },
    {
      id: 'backup',
      label: 'Dữ liệu & Sao lưu',
      icon: <Database className="size-4" />,
      desc: 'Bảo trì & Lưu trữ dữ liệu'
    },
  ];

  return (
    <div className="flex h-full bg-slate-50/50 -m-6 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-6 pt-8 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-1.5 h-7 rounded-full bg-red-600 shadow-lg shadow-red-200"></span>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Cấu hình hệ thống</h1>
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black pl-4">Thiết lập vận hành & Bảo mật</p>
        </div>

        <nav className="flex flex-col gap-1.5 p-4 flex-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold text-left transition-all duration-300",
                activeTab === tab.id
                  ? "bg-red-600 text-white shadow-xl shadow-red-100 scale-[1.02]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className={cn(
                "transition-colors duration-300",
                activeTab === tab.id ? "text-red-100" : "text-slate-400 group-hover:text-red-500"
              )}>
                {tab.icon}
              </span>
              <div className="flex flex-col">
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] font-medium leading-tight mt-0.5",
                  activeTab === tab.id ? "text-red-200/80" : "text-slate-400"
                )}>
                  {tab.desc}
                </span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-red-50 to-white border border-red-100 shadow-sm">
          <p className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-1">Phiên bản hệ thống</p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-red-400/80">v2.4.1</p>
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-200" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 px-8 py-8">
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div key={activeTab} className="animate-in fade-in slide-in-from-right-8 duration-700 fill-mode-both">
              {activeTab === 'general' && (
                <GeneralTab
                  config={config}
                  setConfig={setConfig}
                  isSaving={isSaving}
                  onSave={handleSaveSettings}
                  pushStatus={pushStatus}
                  isTesting={isTesting}
                  onTriggerScan={triggerScan}
                  onTestNotification={testNotification}
                />
              )}
              {activeTab === 'audit' && <AuditTab />}
              {activeTab === 'backup' && <BackupTab />}
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
