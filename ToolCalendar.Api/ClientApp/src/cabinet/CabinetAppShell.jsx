/* eslint-disable */
import React, { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { LayoutDashboard, Calendar, FileText, ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CabinetAppShell() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [meetings, setMeetings] = useState([])

  useEffect(() => {
    fetch('/api/phonghopkhonggiayto/meetings/schedule', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const events = json.data.map((m) => ({
            id: m.id,
            title: m.title,
            start: m.startTime,
            end: m.endTime,
            extendedProps: { room: m.roomName, status: m.status },
          }))
          setMeetings(events)
        }
      })
      .catch((err) => console.error('Error fetching meetings:', err))
  }, [])

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-4 bg-slate-950 text-white font-black text-lg tracking-tight flex flex-col">
          <span>iCPV Cabinet</span>
          <span className="text-xs text-slate-400 font-bold uppercase mt-1">
            Phòng họp không giấy tờ
          </span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard className="mr-2 size-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === 'calendar' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            onClick={() => setActiveTab('calendar')}
          >
            <Calendar className="mr-2 size-4" />
            Lịch họp
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === 'documents' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText className="mr-2 size-4" />
            Tài liệu cuộc họp
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === 'voting' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            onClick={() => setActiveTab('voting')}
          >
            <Users className="mr-2 size-4" />
            Biểu quyết & Xin ý kiến
          </Button>
        </nav>
        <div className="p-4">
          <Button
            variant="outline"
            className="w-full bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
            onClick={() => (window.location.href = '/')}
          >
            <ArrowLeft className="mr-2 size-4" />
            Về hệ thống chính
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6">
          <h1 className="text-xl font-bold text-slate-800">
            {activeTab === 'calendar'
              ? 'Lịch Họp Cơ Quan'
              : activeTab === 'dashboard'
                ? 'Tổng Quan'
                : activeTab === 'documents'
                  ? 'Tài Liệu Cuộc Họp'
                  : 'Biểu Quyết'}
          </h1>
        </header>

        <div className="p-6 flex-1">
          {activeTab === 'calendar' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={meetings}
                locale="vi"
                height="100%"
                eventContent={(arg) => {
                  return (
                    <div className="p-1 text-xs whitespace-normal truncate">
                      <div className="font-bold">{arg.timeText}</div>
                      <div className="font-semibold">{arg.event.title}</div>
                      <div className="text-[10px] text-blue-100">
                        {arg.event.extendedProps.room}
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          )}

          {activeTab !== 'calendar' && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <h3 className="text-xl font-bold mb-2">Đang phát triển</h3>
              <p className="text-sm">
                Tính năng {activeTab} sẽ được cập nhật trong các phiên bản tới.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
