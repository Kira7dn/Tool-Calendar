import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  UserPlus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ShieldCheck,
  User,
  Users as UsersIcon,
  Loader2,
  X,
  Lock,
  Mail,
  Phone,
  Building2,
  Check
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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
    } catch (e) {}
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
        departmentId: user.departmentId?.toString() || ''
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
        departmentId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.fullName || (!editingUser && !formData.username) || (!editingUser && !formData.password)) {
      alert('Vui lòng nhập đầy đủ thông tin bắt buộc');
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
        departmentId: formData.departmentId ? parseInt(formData.departmentId) : null
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
        fetchUsers();
      } else {
        const err = await response.json();
        alert(err.message || 'Lỗi khi lưu người dùng');
      }
    } catch (error) {
      console.error('Submit user failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.username === 'admin') {
      alert('Không thể xóa tài khoản Quản trị cấp cao (admin)');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa người dùng "${user.fullName}"?`)) return;

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        fetchUsers();
      }
    } catch (e) {}
  };

  const getRoleBadge = (role) => {
    let color = 'bg-muted/50 text-muted-foreground';
    if (role === 'Admin') color = 'bg-info/15 text-info border-info/30';
    else if (role === 'LanhDao') color = 'bg-secondary/15 text-secondary border-secondary/30';
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

  return (
    <div className="space-y-[var(--space-page)] animate-in fade-in duration-[var(--duration-smooth)]">
      <div className="flex flex-col gap-0 border-l-4 border-secondary pl-3 py-0.5">
        <h2 className="text-xl">Quản lý người dùng</h2>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Access Control & Staff Management</p>
      </div>

      <Card className="glass-card shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between p-8 border-b border-border gap-4 bg-muted/20">
          <div className="flex items-center gap-6">
            <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
              <UsersIcon className="size-6" />
            </div>
          </div>

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
              className="h-11 px-6 rounded-2xl bg-secondary hover:bg-sidebar-mid text-secondary-foreground font-bold shadow-lg shadow-secondary/20"
              onClick={() => handleOpenModal()}
            >
              <Plus className="size-4 mr-2" /> Thêm tài khoản
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-center w-16">STT</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Người dùng</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Liên hệ</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Phòng ban</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Vai trò</TableHead>
                  <TableHead className="px-8 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-8 py-6 text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="px-8 py-6 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => (
                    <TableRow key={user.id} className="group transition-colors">
                      <TableCell className="px-8 py-5 text-center text-muted-foreground font-bold text-xs">{index + 1}</TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-2xl bg-secondary/5 flex items-center justify-center text-secondary font-black group-hover:bg-secondary group-hover:text-secondary-foreground transition-all">
                            {user.fullName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-black text-foreground text-sm">{user.fullName}</div>
                            <div className="text-xs text-muted-foreground font-bold">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                             <Mail className="size-3 text-muted-foreground/30" /> {user.email || '-'}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                             <Phone className="size-3 text-muted-foreground/30" /> {user.phoneNumber || '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground font-bold text-[10px]">
                          {user.departmentName || 'Chưa phân phòng'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-9 rounded-xl text-info hover:bg-info/10"
                            onClick={() => handleOpenModal(user)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-9 rounded-xl text-destructive hover:bg-destructive/10"
                            disabled={user.username === 'admin'}
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center opacity-20">
                         <UserPlus className="size-16 mb-4" />
                         <p className="text-xl font-black">Không có dữ liệu người dùng</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl glass-card">
          <DialogHeader className="p-8 bg-secondary text-secondary-foreground">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary-foreground/10">
                {editingUser ? <Edit className="size-5" /> : <UserPlus className="size-5" />}
              </div>
              {editingUser ? 'Cập nhật tài khoản' : 'Tạo tài khoản mới'}
            </DialogTitle>
            <DialogDescription className="text-secondary-foreground/60 font-medium">
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
                    onChange={e => setFormData({...formData, username: e.target.value})}
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
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="pl-10 rounded-xl bg-muted/50 border-none h-11 font-bold"
                 />
              </div>
            </div>

            <div className="space-y-2 col-span-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Họ và tên</Label>
               <Input 
                  placeholder="Nguyễn Văn A"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
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
                    onChange={e => setFormData({...formData, email: e.target.value})}
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
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                    className="pl-10 rounded-xl bg-muted/50 border-none h-11 font-medium"
                  />
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phòng ban</Label>
               <Select value={formData.departmentId} onValueChange={v => setFormData({...formData, departmentId: v})}>
                  <SelectTrigger className="rounded-xl bg-muted/50 border-none h-11 font-bold">
                    <SelectValue placeholder="Chọn phòng ban" />
                  </SelectTrigger>
                  <SelectContent className="glass-card shadow-2xl">
                    <SelectItem value="0" disabled>Chọn đơn vị</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vai trò</Label>
               <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                  <SelectTrigger className="rounded-xl bg-muted/50 border-none h-11 font-bold">
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent className="glass-card shadow-2xl">
                    <SelectItem value="CanBo">Cán bộ xử lý</SelectItem>
                    <SelectItem value="VanThu">Văn thư</SelectItem>
                    <SelectItem value="LanhDao">Lãnh đạo</SelectItem>
                    <SelectItem value="Admin">Quản trị viên</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/50 gap-3">
             <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold">Hủy bỏ</Button>
             <Button 
                className="rounded-xl bg-secondary hover:bg-sidebar-mid font-black px-10 shadow-lg shadow-secondary/20"
                onClick={handleSubmit}
                disabled={isSubmitting}
             >
               {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
               {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
