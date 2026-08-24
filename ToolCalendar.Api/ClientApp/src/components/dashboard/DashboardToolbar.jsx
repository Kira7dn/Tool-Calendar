/* eslint-disable */
import React from 'react'
import { Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function DashboardToolbar({ searchQuery, setSearchQuery, onSearch, canUpload, onUpload }) {
  return (
    <div className="flex flex-col gap-3 px-1 shrink-0">
      {/* Title Row */}
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5">
        <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-foreground">
          Bảng điều hành văn bản
        </h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider leading-snug">
          Giám sát xử lý, quá hạn và thời hạn văn bản trong hệ thống
        </p>
      </div>

      {/* Search + Action Row */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSearch()}
            placeholder="Truy vấn số hiệu hoặc trích yếu..."
            className="h-9 pl-9 pr-3 bg-card w-full"
          />
        </div>
        <Button variant="outline" className="h-9 shrink-0 font-bold" onClick={onSearch}>
          Tìm
        </Button>
        {canUpload && (
          <Button className="h-9 shrink-0 font-bold hidden sm:flex" onClick={onUpload}>
            <Upload className="size-3.5 mr-1" />
            Tải văn bản
          </Button>
        )}
        {canUpload && (
          <Button className="h-9 w-9 shrink-0 sm:hidden p-0" onClick={onUpload} title="Tải văn bản">
            <Upload className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
