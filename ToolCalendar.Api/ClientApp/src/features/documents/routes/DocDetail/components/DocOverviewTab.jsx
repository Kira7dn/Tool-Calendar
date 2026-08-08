/* eslint-disable */
import React from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
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
  User,
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
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-auto lg:h-full animate-in fade-in slide-in-from-left-4 duration-400">
      <div className="px-6 py-3 border-b border-slate-50 bg-slate-50/30 shrink-0">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
          THÔNG TIN CHI TIẾT VĂN BẢN
        </h2>
      </div>
      <div className="flex-1 lg:overflow-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow icon={FileText} label="Số văn bản" value={doc.soVanBan} />
          <InfoRow
            icon={Calendar}
            label="Ngày ban hành"
            value={new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')}
          />
          <InfoRow icon={Building2} label="Cơ quan ban hành" value={doc.coQuanBanHanh} />
          <InfoRow icon={Building2} label="Cơ quan chủ quản" value={doc.coQuanChuQuan} />
          <InfoRow
            icon={Clock}
            label="Thời hạn xử lý"
            value={new Date(doc.thoiHan).toLocaleDateString('vi-VN')}
            highlight
          />
          <InfoRow icon={AlertCircle} label="Mức độ ưu tiên" value={doc.priority || 'THƯỜNG'} />
          <InfoRow
            icon={Building2}
            label="Đơn vị chủ trì"
            value={departments.find((d) => d.id === doc.departmentId)?.name || 'CHƯA PHÂN CÔNG'}
          />
          <InfoRow
            icon={User}
            label="Cán bộ xử lý"
            value={users.find((u) => u.id === doc.assignedTo)?.fullName || 'CHƯA PHÂN CÔNG'}
          />
        </div>
        <div className="mt-8 pt-8 border-t border-slate-50">
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">
            TRÍCH YẾU NỘI DUNG
          </p>
          <p className="text-sm font-bold text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-100 p-6 rounded-2xl shadow-inner min-h-[140px]">
            {doc.trichYeu}
          </p>
        </div>

        {/* Phần kết quả xử lý dành cho Admin/Lãnh đạo kiểm tra */}
        {(doc.status === DOCUMENT_STATUS.HOAN_THANH || doc.evidenceNotes || doc.evidencePaths) && (
          <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-green-50 text-green-600 shadow-sm border border-green-100">
                <CheckCircle2 size={18} strokeWidth={2.5} />
              </div>
              <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">
                KẾT QUẢ XỬ LÝ & BẰNG CHỨNG
              </h2>
            </div>

            <div className="bg-white border-2 border-green-100 rounded-2xl p-4 md:p-6 shadow-xl shadow-green-50/50 relative overflow-hidden">
              {/* Badge hoàn thành */}
              <div className="absolute top-0 right-0 px-4 py-1.5 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl">
                CONFIRMED
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MessageSquare size={12} /> NỘI DUNG GIẢI TRÌNH
                  </p>
                  <div className="text-sm font-bold text-slate-700 leading-relaxed pl-4 border-l-4 border-green-200">
                    {doc.evidenceNotes || 'Không có ghi chú bổ sung.'}
                  </div>
                </div>

                {doc.evidencePaths && (
                  <div className="pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Paperclip size={12} /> DANH SÁCH FILE BẰNG CHỨNG (
                      {JSON.parse(doc.evidencePaths || '[]').length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(() => {
                        try {
                          const paths = JSON.parse(doc.evidencePaths || '[]')
                          return paths.map((path, idx) => {
                            const fileName =
                              path.split('/').pop().split('_').slice(1).join('_') || 'Attachment'
                            const isImg = /\.(jpg|jpeg|png|gif)$/i.test(path)
                            return (
                              <button
                                key={idx}
                                onClick={() => handleViewEvidence(path)}
                                className="group flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-green-400 hover:shadow-lg transition-all duration-300 w-full text-left"
                              >
                                <div className="size-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-green-500 transition-colors shadow-sm">
                                  {isImg ? <Image size={18} /> : <FileText size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                                    {fileName}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    Click để xem chi tiết
                                  </p>
                                </div>
                                <ExternalLink
                                  size={14}
                                  className="text-slate-300 group-hover:text-green-500"
                                />
                              </button>
                            )
                          })
                        } catch (e) {
                          return null
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
