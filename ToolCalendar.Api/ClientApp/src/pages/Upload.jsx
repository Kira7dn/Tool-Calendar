import React, { useState, useRef, useEffect } from "react";
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Clock,
  Calendar,
  FileText,
  User,
  Building2,
  AlertCircle,
  Edit,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Send,
  Loader2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Trash2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── tiny icon helper ── */
const Svg = ({ children, size = 20, cls = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" className={cls}>{children}</svg>
);

const UploadCloudIcon = () => <Svg size={40} cls="text-blue-400"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></Svg>;
const FileIcon = () => <Svg size={14}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></Svg>;
const FolderIcon = () => <Svg size={14}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Svg>;
const TrashIcon = () => <Svg size={13}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></Svg>;
const EyeIcon = () => <Svg size={13}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>;
const EditIcon2 = () => <Svg size={13}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Svg>;
const ChipIcon = () => <Svg size={16}><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /><rect x="3" y="3" width="18" height="18" rx="2" /></Svg>;
const CheckCircleIcon = () => <Svg size={14} cls="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Svg>;
const ClockIcon = () => <Svg size={14} cls="text-blue-500"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>;
const XCircleIcon = () => <Svg size={14} cls="text-slate-400"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Svg>;

/* ── status badge ── */
function StatusBadge({ status }) {
  if (status === "processing") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
      <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />Đang OCR
    </span>
  );
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />Đã lưu
    </span>
  );
  if (status === "ready") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
      Sẵn sàng
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
      Lỗi
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
      Chờ rà soát
    </span>
  );
}

/* ── progress ring ── */
function Ring({ pct }) {
  const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle cx={28} cy={28} r={r} fill="none" stroke="#3b82f6" strokeWidth={4}
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1e293b">{Math.round(pct)}%</text>
    </svg>
  );
}

/* ── main ── */
export function Upload({ onTabChange }) {
  const [isDragging, setIsDragging] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const inputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/admin/departments', { headers }),
        fetch('/api/users', { headers })
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData.filter(u => u.role === 'CanBo' || u.role === 'Admin'));
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    }
  };

  const handleFileUpload = async (fileList) => {
    if (!fileList.length) return;
    setIsProcessing(true);
    setOverallProgress(0);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setCurrentFileName(file.name);
      setOverallProgress(((i) / fileList.length) * 100);

      const tempId = `temp-${Date.now()}-${i}`;
      const newItem = {
        id: tempId,
        fileName: file.name,
        soVanBan: '',
        trichYeu: '',
        coQuanChuQuan: '',
        thoiHan: '',
        departmentIds: [],
        assignedToIds: [],
        status: 'processing',
      };

      setBatchItems(prev => [newItem, ...prev]);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: formData
        });

        if (response.ok) {
          const doc = await response.json();
          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            id: doc.id,
            soVanBan: doc.soVanBan || '',
            trichYeu: doc.trichYeu || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            filePath: doc.filePath || '',
            status: 'ready'
          } : item));
        } else {
          setBatchItems(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
        }
      } catch (error) {
        setBatchItems(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
      }
    }

    setOverallProgress(100);
    setTimeout(() => {
      setIsProcessing(false);
      setCurrentFileName('');
    }, 1000);
  };

  const updateItem = (id, field, value) => {
    setBatchItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSaveAll = async () => {
    const targets = batchItems.filter(item => item.status === 'ready' || item.status === 'review');
    if (targets.length === 0) return;

    setIsProcessing(true);
    for (const item of targets) {
      try {
        const response = await fetch(`/api/documents/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: item.id,
            soVanBan: item.soVanBan,
            trichYeu: item.trichYeu,
            coQuanChuQuan: item.coQuanChuQuan,
            thoiHan: item.thoiHan ? `${item.thoiHan}T00:00:00` : null,
            filePath: item.filePath,
            status: 'Chưa xử lý',
            departmentId: item.departmentIds?.[0] || null,
            assignedTo: item.assignedToIds?.[0] || null,
            assignedDepartmentIds: JSON.stringify(item.departmentIds || []),
            assignedUserIds: JSON.stringify(item.assignedToIds || [])
          })
        });

        if (response.ok) {
          setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success' } : i));
        }
      } catch (e) {
        console.error(e);
      }
    }
    setIsProcessing(false);
    toast.success('Đã lưu tất cả văn bản');
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearBatch = async () => {
    setShowClearConfirm(true);
  };

  const executeClearBatch = async () => {
    setBatchItems([]);
    setShowClearConfirm(false);
  };

  const statCounts = {
    ocr: batchItems.filter(f => f.status === "processing").length,
    saved: batchItems.filter(f => f.status === "success").length,
    pending: batchItems.filter(f => f.status === "ready").length,
  };

  return (
    <div className="h-full bg-slate-100 flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Page title bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
            <ChipIcon />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Số hóa tài liệu</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">PDF OCR Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearBatch}
            className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-all"
          >
            HỦY ĐỢT TẢI
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isProcessing || batchItems.length === 0}
            className="px-6 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            LƯU & PHÂN CÔNG TẤT CẢ
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">

        {/* LEFT: upload + status */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">

          {/* Upload dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
              handleFileUpload(files);
            }}
            className={cn(
              "rounded-xl border-2 border-dashed p-5 flex flex-col items-center gap-3 cursor-pointer transition-all",
              isDragging ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50/40"
            )}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(Array.from(e.target.files))}
            />
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              isDragging ? "bg-blue-100" : "bg-slate-50"
            )}>
              <UploadCloudIcon />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700">Tải tệp tin lên</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Kéo thả tệp PDF vào đây<br />hoặc nhấn để chọn file</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-1">
              <button
                onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
              >
                <FileIcon /> Chọn tệp tin
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition-colors"
              >
                <FolderIcon /> Tải cả thư mục
              </button>
              <input
                type="file"
                ref={folderInputRef}
                className="hidden"
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={(e) => handleFileUpload(Array.from(e.target.files))}
              />
            </div>
          </div>

          {/* OCR progress */}
          {isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đang xử lý OCR</p>
              </div>
              <div className="flex items-center gap-3">
                <Ring pct={overallProgress} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentFileName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Đang nhận diện văn bản...</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Batch status */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trạng thái đợt tải</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: "Đang OCR", count: statCounts.ocr, color: "blue", icon: <ClockIcon /> },
                { label: "Đã lưu", count: statCounts.saved, color: "emerald", icon: <CheckCircleIcon /> },
                { label: "Chờ rà soát", count: statCounts.pending, color: "slate", icon: <XCircleIcon /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.icon}
                    <span className="text-xs font-medium text-slate-600">{row.label}</span>
                  </div>
                  <span className={`min-w-[24px] h-6 px-2 flex items-center justify-center rounded-full text-xs font-bold
                    ${row.color === "blue" ? "bg-blue-50 text-blue-700" :
                      row.color === "emerald" ? "bg-emerald-50 text-emerald-700" :
                        "bg-slate-100 text-slate-500"}`}>
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: document list */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-w-0">
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  {["Tên tệp", "Số hiệu", "Thời hạn", "Đơn vị", "Cán bộ", "Trạng thái", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchItems.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-black text-red-500 uppercase">PDF</span>
                        </div>
                        <span className="font-semibold text-slate-800 truncate max-w-[120px]">{row.fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        value={row.soVanBan}
                        onChange={(e) => updateItem(row.id, 'soVanBan', e.target.value)}
                        placeholder="Số hiệu..."
                        className="w-24 text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white placeholder-slate-300 transition-all font-bold text-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="date"
                        value={row.thoiHan}
                        onChange={(e) => updateItem(row.id, 'thoiHan', e.target.value)}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={row.departmentIds[0] || ''}
                        onChange={(e) => updateItem(row.id, 'departmentIds', [parseInt(e.target.value)])}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold"
                      >
                        <option value="">Chọn đơn vị</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={row.assignedToIds[0] || ''}
                        onChange={(e) => updateItem(row.id, 'assignedToIds', [parseInt(e.target.value)])}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold"
                      >
                        <option value="">Chọn cán bộ</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setBatchItems(prev => prev.filter(i => i.id !== row.id))}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Empty state when no files */}
            {batchItems.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <UploadCloudIcon />
                </div>
                <p className="text-sm font-bold text-slate-600">Chưa có tệp nào</p>
                <p className="text-xs text-slate-400 mt-1.5">Tải tệp PDF lên từ panel bên trái để bắt đầu bóc tách</p>
              </div>
            )}
          </div>

          {/* Table footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
            <p className="text-[10px] text-slate-400 font-medium">Hiển thị {batchItems.length} tệp</p>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 rounded text-[10px] font-bold bg-blue-600 text-white">1</button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-[400px] rounded-3xl border-none shadow-2xl overflow-hidden p-0">
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Hủy đợt tải?</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
                Bạn có chắc chắn muốn hủy đợt bóc tách này? Tất cả dữ liệu chưa lưu sẽ bị xóa vĩnh viễn.
              </p>
            </div>
          </div>
          <div className="p-5 bg-slate-50 flex items-center gap-3">
            <Button
              variant="ghost"
              className="flex-1 rounded-xl font-bold text-slate-400"
              onClick={() => setShowClearConfirm(false)}
            >
              QUAY LẠI
            </Button>
            <Button
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest shadow-lg shadow-amber-100"
              onClick={executeClearBatch}
            >
              XÁC NHẬN HỦY
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
