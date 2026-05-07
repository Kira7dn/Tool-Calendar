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

  const navigation = [
    { id: 'general', label: 'Cấu hình chung', icon: SettingsIcon },
    { id: 'audit', label: 'Nhật ký hệ thống', icon: History },
    { id: 'backup', label: 'Dữ liệu & Sao lưu', icon: Database },
  ];

  return (
    <div className="space-y-(--space-page) flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both pb-4">
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5 shrink-0">
        <h2 className="text-xl font-bold tracking-tight">Cấu hình hệ thống</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Thiết lập vận hành & Thông báo</p>
      </div>

      <div className="flex flex-col md:flex-row gap-(--space-page) flex-1 min-h-0">
        <aside className="w-full md:w-[260px] flex flex-col gap-6 shrink-0">
          <nav className="flex flex-col gap-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div key={activeTab} className="space-y-6 px-4 pb-10 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
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
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
