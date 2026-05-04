import React, { useEffect, useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  FileEdit, 
  Trash2, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export function Documents({ onTabChange }) {
  const [documents, setDocuments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  
  const searchTimeout = useRef(null);

  useEffect(() => {
    fetchDocuments();
    
    const handleUpdate = () => fetchDocuments();
    document.addEventListener('realtime:document_updated', handleUpdate);
    return () => document.removeEventListener('realtime:document_updated', handleUpdate);
  }, [page, status, sort]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const url = `/api/documents?page=${page}&size=10&search=${encodeURIComponent(search)}&status=${status}&sort=${sort}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchDocuments();
    }, 500);
  };

  const getStatusBadge = (doc) => {
    const statusText = doc.trangThai || doc.status;
    const daysLeft = doc.soNgayConLai;
    
    let color = 'bg-slate-100 text-slate-600';
    if (statusText === 'Đã hoàn thành') color = 'bg-green-100 text-green-700 border-green-200';
    else if (statusText === 'Đã quá hạn' || daysLeft < 0) color = 'bg-red-100 text-red-700 border-red-200';
    else if (statusText === 'Đã rà soát') color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    else if (statusText === 'Lỗi OCR') color = 'bg-rose-100 text-rose-700 border-rose-200';
    else if (daysLeft <= 3) color = 'bg-orange-100 text-orange-700 border-orange-200';
    else if (daysLeft <= 7) color = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    else if (statusText === 'Đang xử lý') color = 'bg-blue-100 text-blue-700 border-blue-200';

    return (
      <Badge variant="outline" className={cn("font-medium", color)}>
        {statusText || 'Chưa xử lý'}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    } catch { return dateStr; }
  };

  const handleAction = (action, doc) => {
    if (window.app?.services) {
      if (action === 'view') window.app.services.openDocDetail(doc.id);
      if (action === 'edit') window.app.services.openDocDetail(doc.id, 'edit');
      if (action === 'pdf') window.app.services.openPdfPreview(doc.id, doc.soVanBan);
      if (action === 'delete') {
        // Implement delete logic or bridge to legacy
        if (confirm('Bạn có chắc chắn muốn xóa văn bản này?')) {
          fetch(`/api/documents/${doc.id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          }).then(res => {
            if (res.ok) fetchDocuments();
          });
        }
      }
    }
  };

  return (
    <Card className="shadow-sm border-white/10 bg-white/80 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
        <div className="flex items-center gap-4">
          <CardTitle className="text-xl font-bold text-slate-800">Danh sách văn bản</CardTitle>
          <Button 
            size="sm" 
            className="rounded-full bg-[#c0392b] hover:bg-[#a93226] text-white"
            onClick={() => onTabChange('upload')}
          >
            <Plus className="size-4 mr-1" /> Thêm mới
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64 max-md:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input 
              placeholder="Tìm số hiệu, nội dung..." 
              className="pl-9 h-9"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <select 
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Chưa xử lý">⏳ Chưa xử lý</option>
            <option value="Đang xử lý">⚙️ Đang xử lý</option>
            <option value="Đã rà soát">🔍 Đã rà soát</option>
            <option value="Đã hoàn thành">✅ Đã hoàn thành</option>
            <option value="Lỗi OCR">❌ Lỗi OCR</option>
            <option value="overdue">🛑 Quá hạn</option>
            <option value="urgent">🕒 Sắp hết hạn</option>
          </select>
          <select 
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm max-md:hidden"
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            <option value="newest">📅 Mới nhất</option>
            <option value="oldest">📅 Cũ nhất</option>
            <option value="deadline_asc">⏳ Hạn gần nhất</option>
          </select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
        <div className="relative flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold text-center w-12">STT</th>
                <th className="px-4 py-3 font-bold">Số văn bản</th>
                <th className="px-4 py-3 font-bold">Ngày ban hành</th>
                <th className="px-4 py-3 font-bold">Trích yếu</th>
                <th className="px-4 py-3 font-bold">Tham mưu</th>
                <th className="px-4 py-3 font-bold">Thời hạn</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4 text-center"><div className="h-4 bg-slate-200 rounded mx-auto w-6"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-64"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-6 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-8 bg-slate-200 rounded mx-auto w-24"></div></td>
                  </tr>
                ))
              ) : documents.length > 0 ? (
                documents.map((doc, idx) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-4 text-center text-slate-400 font-medium">{(page-1)*10 + idx + 1}</td>
                    <td 
                      className="px-4 py-4 font-bold text-[#1a3a6e] cursor-pointer hover:underline"
                      onClick={() => handleAction('view', doc)}
                    >
                      {doc.soVanBan || '-'}
                    </td>
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{formatDate(doc.ngayBanHanh)}</td>
                    <td className="px-4 py-4 text-slate-600 max-w-[300px] truncate" title={doc.trichYeu}>
                      {doc.trichYeu || '-'}
                    </td>
                    <td className="px-4 py-4 text-slate-500">{doc.coQuanChuQuan || '-'}</td>
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{formatDate(doc.thoiHan)}</td>
                    <td className="px-4 py-4">{getStatusBadge(doc)}</td>
                    <td className="px-4 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleAction('view', doc)}>
                            <Eye className="size-4 mr-2" /> Chi tiết
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('pdf', doc)}>
                            <FileText className="size-4 mr-2" /> Xem PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('edit', doc)}>
                            <FileEdit className="size-4 mr-2" /> Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => handleAction('delete', doc)}>
                            <Trash2 className="size-4 mr-2" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                        <Search className="size-6 text-slate-200" />
                      </div>
                      <p className="font-medium">Không tìm thấy văn bản nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
          <p className="text-xs text-slate-500 font-medium">
            Trang <span className="text-slate-800">{page}</span> / <span className="text-slate-800">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1} 
              onClick={() => setPage(page - 1)}
              className="h-8 text-xs font-semibold"
            >
              <ChevronLeft className="size-4 mr-1" /> Trước
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= totalPages} 
              onClick={() => setPage(page + 1)}
              className="h-8 text-xs font-semibold"
            >
              Sau <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
