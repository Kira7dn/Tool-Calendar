import React, { useEffect, useState } from 'react';
import {
  Plus,
  UserPlus,
  Search,
  Edit,
  Trash2,
  User,
  Loader2,
  Lock,
  Mail,
  Phone,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

export function Users() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    role: 'CanBo',
    departmentId: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        setDepartments(await response.json());
      }
    } catch (e) { }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username || '',
        password: '', // Leave blank for edit
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role || 'CanBo',
        departmentId: user.departmentId ? user.departmentId.toString() : "0"
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        role: 'CanBo',
        departmentId: "0"
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.fullName || (!editingUser && !formData.username) || (!editingUser && !formData.password)) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        departmentId: (formData.departmentId && formData.departmentId !== "0") ? parseInt(formData.departmentId) : null
      };

      if (!editingUser) {
        payload.username = formData.username;
        payload.passwordHash = formData.password;
      } else if (formData.password) {
        payload.passwordHash = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsModalOpen(false);
        toast.success(editingUser ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản thành công');
        fetchUsers();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Lỗi khi lưu người dùng');
      }
    } catch (error) {
      console.error('Submit user failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, user: null });

  const handleDeleteUser = async (user) => {
    if (user.username === 'admin') {
      toast.error('Không thể xóa tài khoản Quản trị cấp cao (admin)');
      return;
    }
    setDeleteConfirm({ open: true, user });
  };

  const executeDelete = async () => {
    const user = deleteConfirm.user;
    if (!user) return;

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        toast.success(`Đã xóa người dùng ${user.fullName}`);
        fetchUsers();
      }
    } catch (e) {
      toast.error('Có lỗi xảy ra khi xóa');
    } finally {
      setDeleteConfirm({ open: false, user: null });
    }
  };

  const getRoleBadge = (role) => {
    let color = 'bg-muted/50 text-muted-foreground';
    if (role === 'Admin') color = 'bg-info/15 text-info border-info/30';
    else if (role === 'LanhDao') color = 'bg-primary/15 text-primary border-primary/30';
    else if (role === 'VanThu') color = 'bg-warning/15 text-warning border-warning/30';
    else if (role === 'CanBo') color = 'bg-success/15 text-success border-success/30';

    return (
      <Badge variant="outline" className={cn("font-bold text-[10px] uppercase tracking-tighter", color)}>
        {role === 'Admin' ? 'Quản trị viên' :
          role === 'LanhDao' ? 'Lãnh đạo' :
            role === 'VanThu' ? 'Văn thư' : 'Cán bộ'}
      </Badge>
    );
  };

  const filteredUsers = users.filter(user =>
    user.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    user.username?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-[var(--space-page)] flex flex-col h-full animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <div className="flex flex-col gap-0 border-l-4 border-primary pl-3 py-0.5">
        <h2 className="text-xl">Quản lý người dùng</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Access Control & Staff Management</p>
      </div>

      <Card className="glass-card shadow-2xl flex-1 flex flex-col overflow-hidden gap-2 px-2 py-0">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between p-8 border-b border-border gap-4 bg-muted/20">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, email..."
                className="pl-9 h-11 bg-muted/50 focus:bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              className="h-11 px-6 rounded-2xl bg-primary hover:bg-sidebar-mid text-primary-foreground font-bold shadow-lg shadow-primary/20"
              onClick={() => handleOpenModal()}
            >
              <Plus className="size-4 mr-2" /> Thêm tài khoản
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 overflow-auto pt-px">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="px-8 py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground text-center w-16">STT</TableHead>
                  <TableHead className="py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground">Người dùng</TableHead>
                  <TableHead className="py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground w-48">Liên hệ</TableHead>
                  <TableHead className="py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground w-40">Phòng ban</TableHead>
                  <TableHead className="py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground w-32">Vai trò</TableHead>
                  <TableHead className="px-8 py-3.5 font-black text-[10px] uppercase tracking-widest text-foreground text-right w-32">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-[64px]">
                      <TableCell className="px-8 py-3 text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3"><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell className="py-3"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="py-3"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="px-8 py-3 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user, index) => (
                    <TableRow key={user.id} className="group transition-colors h-[64px]">
                      <TableCell className="px-8 py-3 text-center text-muted-foreground font-bold text-xs">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            {user.fullName?.charAt(0) || 'U'}
                          </div>
                          <div className="truncate">
                            <div className="font-black text-foreground text-sm truncate">{user.fullName}</div>
                            <div className="text-xs text-muted-foreground font-bold">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 truncate">
                        <div className="flex flex-col gap-1 truncate">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground truncate">
                            <Mail className="size-3 text-muted-foreground/30 shrink-0" /> <span className="truncate">{user.email || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground truncate">
                            <Phone className="size-3 text-muted-foreground/30 shrink-0" /> <span className="truncate">{user.phoneNumber || '-'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 truncate">
                        <Badge variant="default" className="bg-muted/50 text-muted-foreground font-bold text-[10px] truncate max-w-full">
                          {user.departmentName || 'Chưa phân phòng'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="px-8 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg text-info hover:bg-info/10"
                            onClick={() => handleOpenModal(user)}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                            disabled={user.username === 'admin'}
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-[320px] text-center p-0 align-middle">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <UserPlus className="size-16 mb-4" />
                        <p className="text-xl font-black">Không có dữ liệu người dùng</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-border flex items-center justify-between bg-card/50">
            <p className="text-xs text-muted-foreground font-medium">
              Trang <span className="text-foreground">{currentPage}</span> / <span className="text-foreground">{totalPages || 1}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-8 text-xs font-semibold px-3"
              >
                <ChevronLeft className="size-4 mr-1" /> Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-8 text-xs font-semibold px-3"
              >
                Tiếp <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl p-0 border-none shadow-2xl glass-card">
          <DialogHeader className="p-8 bg-red-600 text-white relative">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                {editingUser ? <Edit className="size-5 text-white" /> : <UserPlus className="size-5 text-white" />}
              </div>
              <span className="drop-shadow-sm">{editingUser ? 'Cập nhật tài khoản' : 'Tạo tài khoản mới'}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 font-medium mt-2">
              Thiết lập thông tin đăng nhập và vai trò cho cán bộ
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 grid grid-cols-2 gap-6">
            {!editingUser && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tên đăng nhập</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="vd: canbo.dv"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="pl-10 rounded-xl bg-muted/50 border-none h-11 font-bold"
                  />
                </div>
              </div>
            )}

            <div className={cn("space-y-2", editingUser && "col-span-2")}>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {editingUser ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type={showModalPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 rounded-xl bg-muted/50 border-none h-11 font-bold"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowModalPassword(!showModalPassword)}
                >
                  {showModalPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Họ và tên</Label>
              <Input
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="rounded-xl bg-muted/50 border-none h-11 font-black text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="email@vidu.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-muted/50 h-11 font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Số điện thoại</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="09xx..."
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="pl-10 rounded-xl bg-muted/50 border-none h-11 font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phòng ban</Label>
              <select
                value={formData.departmentId}
                onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-4 h-11 rounded-xl bg-muted/50 border-none text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
              >
                <option value="0">Chưa phân phòng</option>
                {departments.map(d => <option key={d.id} value={d.id.toString()}>{d.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vai trò</Label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 h-11 rounded-xl bg-muted/50 border-none text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
              >
                <option value="CanBo">Cán bộ xử lý</option>
                <option value="VanThu">Văn thư</option>
                <option value="LanhDao">Lãnh đạo</option>
                <option value="Admin">Quản trị viên</option>
              </select>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/50 gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold">Hủy bỏ</Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black px-10 shadow-lg shadow-red-100 transition-all"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
              {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Xác nhận xóa?"
        description={`Bạn có chắc chắn muốn xóa tài khoản "${deleteConfirm.user?.fullName}"? Thao tác này không thể hoàn tác.`}
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />
    </div>
  );
}
