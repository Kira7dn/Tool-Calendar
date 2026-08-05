/* eslint-disable */
import React from 'react'
import {
  FileText,
  Calendar,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Image,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const InfoRow = ({ icon: Icon, label, value, highlight }) => (
  <div className="flex flex-col gap-0.5 group">
    <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase group-hover:text-red-500 transition-colors">
      {label}
    </span>
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg border transition-all',
          highlight
            ? 'bg-amber-50 text-amber-500 border-amber-200 shadow-sm'
            : 'bg-slate-50 text-slate-400 border-slate-100'
        )}
      >
        <Icon size={12} strokeWidth={2.5} />
      </div>
      <span
        className={cn(
          'text-sm font-bold transition-colors leading-tight',
          highlight ? 'text-amber-700' : 'text-slate-900'
        )}
      >
        {value || '---'}
      </span>
    </div>
  </div>
)

export function DocOverviewTab({ doc, departments, users, handleViewEvidence }) {
  return null
}
