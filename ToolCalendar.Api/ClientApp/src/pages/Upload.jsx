import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Calendar,
  FileText,
  Building2,
  Edit,
  Save,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  // ── Bulk selection state ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);

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
        coQuanBanHanh: '',
        coQuanChuQuan: '',
        ngayBanHanh: '',
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
            coQuanBanHanh: doc.coQuanBanHanh || '',
            coQuanChuQuan: doc.coQuanChuQuan || '',
            ngayBanHanh: doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '',
            thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
            departmentIds: doc.departmentId ? [doc.departmentId] : [],
            assignedToIds: doc.assignedTo ? [doc.assignedTo] : [],
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
            coQuanBanHanh: item.coQuanBanHanh,
            coQuanChuQuan: item.coQuanChuQuan,
            ngayBanHanh: item.ngayBanHanh ? `${item.ngayBanHanh}T00:00:00` : null,
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
  const [deleteItemConfirm, setDeleteItemConfirm] = useState({ open: false, item: null });

  // ── Bulk selection handlers ──
  const selectableItems = batchItems.filter(i => typeof i.id === 'number');
  const isAllSelected = selectableItems.length > 0 && selectableItems.every(i => selectedIds.has(i.id));
  const isIndeterminate = !isAllSelected && selectableItems.some(i => selectedIds.has(i.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(i => i.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds).filter(id => typeof id === 'number');
      const response = await fetch('/api/documents/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ids)
      });
      if (response.ok) {
        setBatchItems(prev => prev.filter(i => !selectedIds.has(i.id)));
        setSelectedIds(new Set());
        toast.success(`Đã xóa ${ids.length} văn bản thành công.`);
      } else {
        toast.error('Xóa thất bại, vui lòng thử lại.');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi xóa.');
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

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
        <div className="w-56 md:w-64 flex-shrink-0 flex flex-col gap-3">

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
                  {/* Checkbox select-all */}
                  <th className="pl-4 pr-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                    />
                  </th>
                  {["Tên tệp", "Số hiệu", "Thời hạn", "Đơn vị", "Cán bộ", "Trạng thái", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchItems.map(row => {
                  const isRowSelected = selectedIds.has(row.id);
                  return (
                  <tr key={row.id} className={cn("transition-colors group", isRowSelected ? "bg-blue-50 hover:bg-blue-50/80" : "hover:bg-slate-50/60")}>
                    {/* Row checkbox */}
                    <td className="pl-4 pr-2 py-2">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleSelectOne(row.id)}
                        disabled={typeof row.id !== 'number'}
                        className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border", isRowSelected ? "bg-blue-100 border-blue-200" : "bg-red-50 border-red-100")}>
                          <span className={cn("text-[8px] font-black uppercase", isRowSelected ? "text-blue-600" : "text-red-500")}>PDF</span>
                        </div>
                        <span className="font-semibold text-slate-800 truncate max-w-[120px]">{row.fileName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.soVanBan}
                        onChange={(e) => updateItem(row.id, 'soVanBan', e.target.value)}
                        placeholder="Số hiệu..."
                        className="w-24 text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white placeholder-slate-300 transition-all font-bold text-slate-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.thoiHan}
                        onChange={(e) => updateItem(row.id, 'thoiHan', e.target.value)}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.departmentIds[0] || ''}
                        onChange={(e) => updateItem(row.id, 'departmentIds', [parseInt(e.target.value)])}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold"
                      >
                        <option value="">Chọn đơn vị</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.assignedToIds[0] || ''}
                        onChange={(e) => updateItem(row.id, 'assignedToIds', [parseInt(e.target.value)])}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all text-slate-700 font-semibold"
                      >
                        <option value="">Chọn cán bộ</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setReviewItem({ ...row });
                                  setIsReviewModalOpen(true);
                                  setPdfPage(1);
                                }}
                                className="p-1 rounded text-blue-500 hover:bg-blue-50 transition-colors"
                              >
                                <EyeIcon />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-900 text-white border-none font-bold text-[10px]">
                              Đối soát PDF
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteItemConfirm({ open: true, item: row })}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <TrashIcon />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-red-600 text-white border-none font-bold text-[10px]">
                              Xóa khỏi danh sách
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
            <p className="text-[10px] text-slate-400 font-medium">
              Hiển thị {batchItems.length} tệp
              {selectedIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-bold">· Đã chọn {selectedIds.size}</span>
              )}
            </p>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 rounded text-[10px] font-bold bg-blue-600 text-white">1</button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal: PDF Side-by-Side with Form (Ảnh 2 Design) */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="!max-w-[98vw] w-[98vw] h-[96vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white transition-all duration-500 rounded-3xl">
          {/* Header */}
          <div className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shadow-inner">
                <Edit size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Chỉnh sửa thông tin văn bản</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">Đối chiếu trực tiếp với bản gốc PDF</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Left side: PDF Viewer */}
            <div className="flex-1 bg-slate-100 flex flex-col relative border-r border-slate-100">
              <div className="flex-1 relative overflow-hidden bg-slate-200 m-4 rounded-2xl shadow-inner border border-slate-200">
                <iframe
                  key={`${reviewItem?.id}-${pdfPage}`}
                  src={reviewItem?.id ? `/api/documents/${reviewItem.id}/file#page=${pdfPage}&view=FitH` : ""}
                  className="w-full h-full border-none"
                  title="PDF Viewer"
                />
              </div>

              {/* PDF Toolbar (Compact) */}
              <div className="h-16 bg-slate-900 mx-4 mb-4 rounded-2xl flex items-center justify-between px-8 shadow-xl">
                <div className="flex items-center gap-3 text-slate-400">
                  <FileText size={18} className="text-blue-500" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Bản gốc PDF</span>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/50 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                    className="p-2 rounded-lg hover:bg-slate-700 text-white disabled:opacity-20 transition-all"
                  >
                    <ChevronLeft size={18} strokeWidth={3} />
                  </button>
                  <div className="flex items-center gap-3 px-4 border-x border-white/5">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Trang</span>
                    <span className="text-sm font-black text-white">{pdfPage}</span>
                  </div>
                  <button
                    onClick={() => setPdfPage(pdfPage + 1)}
                    className="p-2 rounded-lg hover:bg-slate-700 text-white transition-all"
                  >
                    <ChevronRight size={18} strokeWidth={3} />
                  </button>
                </div>

                <button
                  onClick={() => window.open(`/api/documents/${reviewItem?.id}/file`, '_blank')}
                  className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-blue-600 transition-all"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>

            {/* Right side: Edit Form (Styled like Ảnh 2) */}
            <div className="w-[520px] bg-white flex flex-col">
              <div className="flex-1 overflow-auto p-10 space-y-8">
                <div className="space-y-6">
                  {/* Số văn bản */}
                  <FormField
                    label="Số văn bản"
                    value={reviewItem?.soVanBan}
                    onChange={(val) => setReviewItem({ ...reviewItem, soVanBan: val })}
                    icon={FileText}
                  />

                  {/* Ngày & Thời hạn */}
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      label="Ngày ban hành"
                      type="date"
                      value={reviewItem?.ngayBanHanh}
                      onChange={(val) => setReviewItem({ ...reviewItem, ngayBanHanh: val })}
                      icon={Calendar}
                    />
                    <FormField
                      label="Thời hạn xử lý"
                      type="date"
                      value={reviewItem?.thoiHan}
                      onChange={(val) => setReviewItem({ ...reviewItem, thoiHan: val })}
                      icon={Clock}
                    />
                  </div>

                  {/* Cơ quan ban hành */}
                  <FormField
                    label="Cơ quan ban hành"
                    value={reviewItem?.coQuanBanHanh}
                    onChange={(val) => setReviewItem({ ...reviewItem, coQuanBanHanh: val })}
                    icon={Building2}
                  />

                  {/* Cơ quan chủ quản */}
                  <FormField
                    label="Cơ quan chủ quản"
                    value={reviewItem?.coQuanChuQuan}
                    onChange={(val) => setReviewItem({ ...reviewItem, coQuanChuQuan: val })}
                    icon={Building2}
                  />

                  {/* Trích yếu */}
                  <FormField
                    label="Trích yếu nội dung"
                    type="textarea"
                    value={reviewItem?.trichYeu}
                    onChange={(val) => setReviewItem({ ...reviewItem, trichYeu: val })}
                  />

                  {/* Thông tin nâng cao */}
                  <div className="pt-8 border-t border-slate-100 space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-blue-500 rounded-full" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thông tin nâng cao</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Đơn vị chủ trì</label>
                      <select
                        value={reviewItem?.departmentIds?.[0] || ''}
                        onChange={(e) => setReviewItem({ ...reviewItem, departmentIds: [parseInt(e.target.value)] })}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Chọn đơn vị...</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Cán bộ xử lý</label>
                      <select
                        value={reviewItem?.assignedToIds?.[0] || ''}
                        onChange={(e) => setReviewItem({ ...reviewItem, assignedToIds: [parseInt(e.target.value)] })}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Chọn cán bộ...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Ảnh 2 Style) */}
              <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
                <Button
                  variant="ghost"
                  className="px-8 rounded-xl font-bold text-slate-400 hover:text-red-500 transition-colors"
                  onClick={() => setIsReviewModalOpen(false)}
                >
                  HỦY BỎ
                </Button>
                <Button
                  className="px-10 h-12 rounded-2xl bg-[#1e293b] hover:bg-slate-800 text-white font-black uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center gap-3 transition-all active:scale-95"
                  onClick={() => {
                    setBatchItems(prev => prev.map(item => item.id === reviewItem.id ? reviewItem : item));
                    setIsReviewModalOpen(false);
                    toast.success('Đã cập nhật dữ liệu đối soát');
                  }}
                >
                  <Save size={18} />
                  LƯU THAY ĐỔI
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Floating bulk-action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3.5 rounded-2xl bg-slate-900 shadow-2xl shadow-slate-900/40 border border-white/10 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span className="text-sm font-bold text-white">Đã chọn <span className="text-blue-400">{selectedIds.size}</span> văn bản</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            Bỏ chọn
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={isBulkDeleting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-900/40"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            {isBulkDeleting ? 'Đang xóa...' : `Xóa ${selectedIds.size} văn bản`}
          </button>
        </div>
      )}

      <ConfirmationModal
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Hủy đợt tải?"
        description="Bạn có chắc chắn muốn hủy đợt bóc tách này? Tất cả dữ liệu chưa lưu sẽ bị xóa vĩnh viễn."
        confirmLabel="XÁC NHẬN HỦY"
        cancelLabel="QUAY LẠI"
        onConfirm={executeClearBatch}
        variant="warning"
      />

      <ConfirmationModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={`Xóa ${selectedIds.size} văn bản?`}
        description={`Bạn sắp xóa vĩnh viễn ${selectedIds.size} văn bản đã chọn cùng toàn bộ file đính kèm. Hành động này không thể hoàn tác.`}
        confirmLabel={`XÓA ${selectedIds.size} VĂN BẢN`}
        cancelLabel="QUAY LẠI"
        onConfirm={handleBulkDelete}
        variant="destructive"
      />

      <ConfirmationModal
        open={deleteItemConfirm.open}
        onOpenChange={(open) => setDeleteItemConfirm(prev => ({ ...prev, open }))}
        title="Xóa khỏi đợt tải?"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deleteItemConfirm.item?.fileName}"? Tài liệu này sẽ bị gỡ bỏ khỏi đợt xử lý hiện tại.`}
        confirmLabel="XÓA NGAY"
        onConfirm={() => {
          setBatchItems(prev => prev.filter(i => i.id !== deleteItemConfirm.item.id));
          setDeleteItemConfirm({ open: false, item: null });
          toast.success('Đã gỡ bỏ văn bản');
        }}
        variant="destructive"
      />
    </div>
  );
}

const FormField = ({ label, value, onChange, icon: Icon, type = "text" }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    <div className="relative group">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
          <Icon size={14} strokeWidth={2.5} />
        </div>
      )}
      {type === "textarea" ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all leading-relaxed resize-none"
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all",
            Icon ? "pl-11 pr-4" : "px-4"
          )}
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      )}
    </div>
  </div>
);
