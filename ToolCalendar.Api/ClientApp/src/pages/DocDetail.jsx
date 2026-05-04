import React, { useEffect, useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  FileText, 
  User, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  MessageSquare, 
  Paperclip, 
  Send,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ThumbsUp,
  Heart,
  Smile,
  Frown,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function DocDetail({ docId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (docId) {
      fetchData();
    }
  }, [docId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
      const [docRes, commentRes, deptRes, userRes] = await Promise.all([
        fetch(`/api/documents/${docId}`, { headers }),
        fetch(`/api/documents/${docId}/comments`, { headers }),
        fetch('/api/admin/departments', { headers }),
        fetch('/api/users', { headers })
      ]);

      if (docRes.ok) setDoc(await docRes.json());
      if (commentRes.ok) setComments(await commentRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch (error) {
      console.error('Failed to fetch document details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updatedData) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        setDoc(updatedData);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save document:', error);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() && selectedFiles.length === 0) return;
    setIsSubmittingComment(true);
    try {
      const formData = new FormData();
      formData.append('content', newComment);
      selectedFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`/api/documents/${docId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });
      if (response.ok) {
        setNewComment('');
        setSelectedFiles([]);
        const refreshRes = await fetch(`/api/documents/${docId}/comments`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (refreshRes.ok) setComments(await refreshRes.json());
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleReaction = async (commentId, reactionType) => {
    try {
      const response = await fetch(`/api/documents/${docId}/comments/${commentId}/react`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reactionType })
      });
      if (response.ok) {
        const data = await response.json();
        setComments(comments.map(c => c.id === commentId ? { ...c, reactions: data.reactions, userReaction: reactionType } : c));
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    try {
      const response = await fetch(`/api/documents/${docId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Đã hoàn thành': return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
      case 'Đã quá hạn': return { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle };
      case 'Đang xử lý': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock };
      default: return { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: History };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Đang tải chi tiết văn bản...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-4 rounded-full bg-slate-100">
          <FileText className="size-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold">Không tìm thấy văn bản</h3>
        <Button onClick={onBack} variant="outline" className="rounded-full">
          <ArrowLeft className="size-4 mr-2" /> Quay lại danh sách
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(doc.trangThai || doc.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-white shadow-sm border border-slate-100">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{doc.soVanBan}</h1>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <select 
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold"
                    value={doc.status}
                    onChange={(e) => setDoc({ ...doc, status: e.target.value })}
                  >
                    <option value="Chưa xử lý">Chưa xử lý</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Đã rà soát">Đã rà soát</option>
                    <option value="Đã hoàn thành">Đã hoàn thành</option>
                    <option value="Lỗi OCR">Lỗi OCR</option>
                    <option value="custom">Tùy chỉnh...</option>
                  </select>
                  {doc.status === 'custom' && (
                    <Input 
                      placeholder="Nhập trạng thái..." 
                      className="h-8 w-32 text-xs"
                      onBlur={(e) => setDoc({ ...doc, status: e.target.value })}
                    />
                  )}
                </div>
              ) : (
                <Badge variant="outline" className={cn("px-3 py-1 rounded-full font-bold uppercase text-[10px]", statusConfig.color)}>
                  <StatusIcon className="size-3 mr-1.5" />
                  {doc.trangThai || doc.status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1 truncate max-w-2xl">{doc.trichYeu}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="size-4 mr-2" /> {isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa'}
          </Button>
          <Button className="rounded-xl bg-[#c0392b] hover:bg-[#a93226] font-bold shadow-lg shadow-red-500/20">
            <ExternalLink className="size-4 mr-2" /> Xem PDF gốc
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-slate-100/50 p-1 rounded-2xl w-fit mb-4">
              <TabsTrigger value="overview" className="rounded-xl font-bold text-xs px-6">Tổng quan</TabsTrigger>
              <TabsTrigger value="content" className="rounded-xl font-bold text-xs px-6">Nội dung trích xuất</TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl font-bold text-xs px-6">Lịch sử xử lý</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-0 space-y-6">
              <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
                  <CardTitle className="text-lg font-bold">Thông tin chi tiết</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <DetailField label="Số văn bản" value={doc.soVanBan} icon={FileText} />
                    <DetailField label="Ngày ban hành" value={new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')} icon={Calendar} />
                    <DetailField label="Cơ quan ban hành" value={doc.coQuanBanHanh} icon={Building2} />
                    <DetailField label="Cơ quan chủ quản" value={doc.coQuanChuQuan} icon={Building2} />
                    <DetailField label="Thời hạn xử lý" value={new Date(doc.thoiHan).toLocaleDateString('vi-VN')} icon={Clock} highlight />
                    <DetailField label="Mức độ ưu tiên" value={doc.priority || 'Thường'} icon={AlertCircle} />
                    <DetailField label="Đơn vị chủ trì" value={departments.find(d => d.id === doc.departmentId)?.name || 'Chưa phân công'} icon={Building2} />
                    <DetailField label="Cán bộ xử lý" value={users.find(u => u.id === doc.assignedTo)?.fullName || 'Chưa phân công'} icon={User} />
                  </div>
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">Trích yếu nội dung</Label>
                    <p className="text-slate-700 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      {doc.trichYeu}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Bằng chứng xử lý (nếu có) */}
              {doc.evidencePaths && doc.evidencePaths !== '[]' && (
                <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-emerald-50/30 border-emerald-100">
                  <CardHeader className="px-8 py-6">
                    <CardTitle className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="size-5" /> Bằng chứng hoàn thành
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-8 pb-8 space-y-4">
                    {doc.evidenceNotes && <p className="text-emerald-700 text-sm font-medium">{doc.evidenceNotes}</p>}
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(doc.evidencePaths).map((path, i) => (
                        <Button 
                          key={i}
                          variant="outline" 
                          size="sm" 
                          className="bg-white border-emerald-200 text-emerald-700 rounded-xl font-bold"
                          onClick={() => window.open(`/api/documents/${docId}/evidence/${i}`, '_blank')}
                        >
                          <Paperclip className="size-3.5 mr-2" /> 
                          {path.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'} Bằng chứng {i + 1}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="content" className="mt-0">
              <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden min-h-[500px]">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Nội dung văn bản</CardTitle>
                    <CardDescription>Xem trực tiếp file PDF và dữ liệu OCR</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => window.open(`/api/documents/${docId}/file`, '_blank')}>
                    <Maximize2 className="size-4 mr-2" /> Mở toàn màn hình
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex flex-col md:flex-row h-[600px]">
                  {/* Embedded PDF Viewer Placeholder/Logic */}
                  <div className="flex-1 bg-slate-100 border-r border-slate-200 relative overflow-hidden">
                     <iframe 
                        src={`/api/documents/${docId}/file`} 
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                     />
                  </div>
                  <div className="w-full md:w-80 bg-slate-900 p-6 overflow-auto">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Dữ liệu OCR</Label>
                    <div className="text-slate-300 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {doc.fullText || 'Không có dữ liệu OCR cho văn bản này.'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
               <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden min-h-[400px]">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
                  <CardTitle className="text-lg font-bold">Nhật ký xử lý</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100">
                    <HistoryItem 
                      title="Văn bản được tạo" 
                      time={new Date(doc.ngayThem).toLocaleString('vi-VN')} 
                      user="Hệ thống AI" 
                      active 
                    />
                    {doc.assignedTo && (
                       <HistoryItem 
                        title="Đã phân công xử lý" 
                        time={new Date(doc.ngayThem).toLocaleString('vi-VN')} 
                        user={users.find(u => u.id === doc.assignedTo)?.fullName} 
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Comments & Collaboration */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-xl rounded-3xl flex flex-col h-[calc(100vh-200px)] sticky top-24 bg-white/80 backdrop-blur-md">
            <CardHeader className="px-6 py-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <MessageSquare className="size-5" />
                </div>
                <CardTitle className="text-lg font-bold">Thảo luận</CardTitle>
              </div>
              <Badge className="bg-blue-600 text-white font-bold">{comments.length}</Badge>
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {comments.length > 0 ? comments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  )) : (
                    <div className="text-center py-20 opacity-30 flex flex-col items-center">
                      <MessageSquare className="size-12 mb-2" />
                      <p className="font-bold">Chưa có bình luận nào</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100 space-y-4">
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {selectedFiles.map((file, i) => (
                      <Badge key={i} variant="secondary" className="bg-white group">
                        {file.name}
                        <X className="size-3 ml-1 cursor-pointer" onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))} />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Textarea 
                    placeholder="Nhập ý kiến chỉ đạo hoặc thảo luận..." 
                    className="min-h-[100px] rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-600/20 resize-none py-4 px-5 font-medium"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <input 
                      id="comment-file-input"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8 text-slate-400 hover:text-blue-600"
                      onClick={() => document.getElementById('comment-file-input').click()}
                    >
                      <Paperclip className="size-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-4"
                      onClick={handlePostComment}
                      disabled={isSubmittingComment || (!newComment.trim() && selectedFiles.length === 0)}
                    >
                      {isSubmittingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-tighter">Nhấn Shift + Enter để xuống dòng</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, icon: Icon, highlight }) {
  return (
    <div className="space-y-1.5 group">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">{label}</Label>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl border border-slate-100 shadow-sm", highlight ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-white text-slate-400")}>
          <Icon className="size-4" />
        </div>
        <span className={cn("text-sm font-bold", highlight ? "text-amber-800" : "text-slate-800")}>
          {value || '---'}
        </span>
      </div>
    </div>
  );
}

  const CommentCard = ({ comment }) => (
    <div className="group space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 border-2 border-white shadow-sm">
            <AvatarFallback className="bg-blue-600 text-white text-[10px] font-bold">
              {comment.username.substring(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-bold text-slate-900">{comment.username}</p>
            <p className="text-[10px] text-slate-400 font-medium">{new Date(comment.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="size-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteComment(comment.id)}>
              <Trash2 className="size-4 mr-2" /> Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="bg-slate-50/80 p-4 rounded-2xl rounded-tl-none border border-slate-100">
        <p className="text-sm text-slate-700 font-medium leading-relaxed">{comment.content}</p>
        {comment.attachmentPaths && (
          <div className="mt-3 flex flex-wrap gap-2">
            {JSON.parse(comment.attachmentPaths).map((path, i) => (
              <a key={i} href={path} target="_blank" className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 hover:bg-blue-100">
                📎 File {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 pl-1">
         <ReactionButton icon={ThumbsUp} count={comment.reactions?.like?.count || 0} active={comment.userReaction === 'like'} onClick={() => handleToggleReaction(comment.id, 'like')} />
         <ReactionButton icon={Heart} count={comment.reactions?.love?.count || 0} active={comment.userReaction === 'love'} onClick={() => handleToggleReaction(comment.id, 'love')} />
         <ReactionButton icon={Smile} count={comment.reactions?.hate?.count || 0} active={comment.userReaction === 'hate'} onClick={() => handleToggleReaction(comment.id, 'hate')} />
         <ReactionButton icon={Frown} count={comment.reactions?.dislike?.count || 0} active={comment.userReaction === 'dislike'} onClick={() => handleToggleReaction(comment.id, 'dislike')} />
      </div>
    </div>
  );

function ReactionButton({ icon: Icon, count, active, onClick }) {
  if (count === 0 && !active) return null;
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all border",
        active ? "bg-blue-50 text-blue-600 border-blue-100 shadow-sm" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
      )}
    >
      <Icon className="size-3" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function HistoryItem({ title, time, user, active }) {
  return (
    <div className="relative pl-10">
      <div className={cn(
        "absolute left-0 mt-1 size-5 rounded-full border-4 border-white shadow-md z-10",
        active ? "bg-blue-600 scale-125" : "bg-slate-200"
      )} />
      <div className="space-y-1">
        <p className={cn("text-sm font-bold", active ? "text-blue-900" : "text-slate-800")}>{title}</p>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
          <span className="flex items-center gap-1"><Clock className="size-3" /> {time}</span>
          <span className="flex items-center gap-1"><User className="size-3" /> {user}</span>
        </div>
      </div>
    </div>
  );
}
