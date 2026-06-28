/* eslint-disable */
import React, { useState } from 'react'
import { Clock, Bell, Loader2, Send, Play, Scan, Plus, X, Zap, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function SectionCard({ icon, title, subtitle, children, isSaving }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden border">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 space-y-0">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-red-600">{icon}</span>
          <div>
            <CardTitle className="text-base font-bold text-slate-800 tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {subtitle}
            </CardDescription>
          </div>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-[10px] font-black text-red-600 animate-pulse border border-red-100">
            <Loader2 className="size-3 animate-spin" />
            ĐANG LƯU...
          </div>
        )}
      </CardHeader>
      <CardContent className="p-8">{children}</CardContent>
    </Card>
  )
}

function Tag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-all group">
      {label}
      <button
        onClick={onRemove}
        className="text-slate-400 hover:text-red-500 transition-colors leading-none"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

export function GeneralTab({
  config,
  setConfig,
  isSaving,
  onSave,
  pushStatus,
  isTesting,
  onTriggerScan,
  onTestNotification,
}) {
  const [newKeyword, setNewKeyword] = useState('')
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('')

  const handleAddTag = (field, value, setter) => {
    if (!value.trim()) return
    const current = config[field] || ''
    const tags = current
      ? current
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    if (!tags.includes(value.trim())) {
      const newTags = [...tags, value.trim()].join(', ')
      setConfig((prev) => ({ ...prev, [field]: newTags }))
      setTimeout(() => onSave(), 0)
    }
    setter('')
  }

  const handleRemoveTag = (field, tagToRemove) => {
    const current = config[field] || ''
    const tags = current
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const newTags = tags.filter((t) => t !== tagToRemove).join(', ')
    setConfig((prev) => ({ ...prev, [field]: newTags }))
    setTimeout(() => onSave(), 0)
  }

  return (
    <SectionCard
      icon={<Zap className="size-5" />}
      title="Cấu hình chung & OCR"
      subtitle="Cài đặt cơ bản, nhận diện văn bản và thông báo"
      isSaving={isSaving}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {/* Thời gian quét */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <Clock className="size-3.5 text-red-500" />
            Thời gian quét định kỳ
          </Label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Input
              type="time"
              value={config.notificationScanTime || ''}
              onChange={(e) => setConfig({ ...config, notificationScanTime: e.target.value })}
              onBlur={onSave}
              className="w-36 h-11 px-4 rounded-2xl bg-slate-50 border-slate-100 font-bold text-slate-700 focus:border-red-300 focus:ring-red-50 shadow-none"
            />
            <div className="flex items-start gap-2 sm:max-w-[180px]">
              <Info className="size-3 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                Hệ thống tự động thực hiện quét vào khung giờ này hàng ngày
              </p>
            </div>
          </div>
        </div>

        {/* Thông báo trình duyệt */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <Bell className="size-3.5 text-red-500" />
            Thông báo trình duyệt
          </Label>
          <div className="flex items-center gap-2 px-5 py-3 h-11 rounded-2xl border border-red-100 bg-red-50/50 w-fit">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-200" />
            <span className="text-[11px] font-black text-red-700 uppercase tracking-widest leading-none">
              Hệ thống đang trực tuyến
            </span>
            <span className="ml-3 px-2 py-0.5 rounded-lg bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
              Active
            </span>
          </div>
        </div>

        {/* Từ khóa thời hạn */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <Scan className="size-3.5 text-red-500" />
            Từ khóa thời hạn (Deadline)
          </Label>
          <div className="flex items-center gap-2 group">
            <div className="relative flex-1">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleAddTag('deadlineKeywords', newKeyword, setNewKeyword)
                }
                placeholder="Nhập từ khóa và nhấn Enter..."
                className="w-full pl-4 pr-10 h-11 rounded-2xl bg-slate-50 border-slate-100 font-bold text-slate-700 focus:border-red-300 focus:ring-red-50 shadow-none placeholder:text-slate-300 placeholder:font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAddTag('deadlineKeywords', newKeyword, setNewKeyword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-red-500 transition-colors rounded-xl"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {config.deadlineKeywords
              ?.split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((tag, i) => (
                <Tag
                  key={i}
                  label={tag}
                  onRemove={() => handleRemoveTag('deadlineKeywords', tag)}
                />
              ))}
          </div>
        </div>

        {/* Từ khóa loại trừ */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <X className="size-3.5 text-slate-400" />
            Từ khóa loại trừ (Exclude)
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={newExcludeKeyword}
                onChange={(e) => setNewExcludeKeyword(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  handleAddTag('deadlineExcludeKeywords', newExcludeKeyword, setNewExcludeKeyword)
                }
                placeholder="Nhập từ khóa loại trừ..."
                className="w-full pl-4 pr-10 h-11 rounded-2xl bg-slate-50 border-slate-100 font-bold text-slate-700 focus:border-slate-300 focus:ring-slate-100 shadow-none placeholder:text-slate-300 placeholder:font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  handleAddTag('deadlineExcludeKeywords', newExcludeKeyword, setNewExcludeKeyword)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600 transition-colors rounded-xl"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {config.deadlineExcludeKeywords
              ?.split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((tag, i) => (
                <Tag
                  key={i}
                  label={tag}
                  onRemove={() => handleRemoveTag('deadlineExcludeKeywords', tag)}
                />
              ))}
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <Button
          onClick={onTriggerScan}
          disabled={isTesting}
          className="flex-1 sm:flex-none h-10 px-5 rounded-2xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-100 border-none"
        >
          {isTesting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5 fill-current mr-2" />
          )}
          Kích hoạt quét ngay
        </Button>
        <Button
          variant="outline"
          onClick={onTestNotification}
          disabled={isTesting || pushStatus !== 'granted'}
          className="flex-1 sm:flex-none h-10 px-5 rounded-2xl bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 border-slate-200 active:scale-95 transition-all shadow-sm"
        >
          {isTesting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5 mr-2" />
          )}
          Gửi thông báo thử nghiệm
        </Button>
      </div>
    </SectionCard>
  )
}
