import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import './styles/globals.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKickedBanner, setShowKickedBanner] = useState(false);

  useEffect(() => {
    document.body.classList.add('login-page');

    if (sessionStorage.getItem('kicked_out') === '1') {
      setShowKickedBanner(true);
      sessionStorage.removeItem('kicked_out');
    }

    if (localStorage.getItem('auth_token')) {
      window.location.href = 'index.html';
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_name', data.username);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_id', data.userId);
        window.location.href = 'index.html';
        return;
      }

      const err = await res.json();
      setError(err.message || 'Đăng nhập thất bại.');
    } catch {
      setError('Lỗi kết nối máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <Card className="login-card gap-0 border-t-[5px] border-t-destructive py-0">
        <img
          src="/assets/LINK STRATEGY.png"
          alt="Logo"
          className="login-logo"
          onError={(event) => {
            event.currentTarget.src = 'https://via.placeholder.com/64';
          }}
        />
        <CardHeader className="px-0 pb-0">
          <CardTitle className="text-[1.45rem] font-extrabold text-secondary">Chào mừng trở lại</CardTitle>
          <CardDescription>Vui lòng đăng nhập để quản lý công văn</CardDescription>
        </CardHeader>

        <CardContent className="px-0">
          {showKickedBanner && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left">
              <div className="flex items-center gap-2.5">
                <TriangleAlert className="size-5 text-destructive" />
                <div>
                  <div className="text-sm font-semibold text-destructive">
                    Phiên đăng nhập đã bị chấm dứt
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Tài khoản của bạn đã đăng nhập từ một thiết bị khác.
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
          <div className="form-group">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              type="text"
              id="username"
              placeholder="admin"
              required
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="form-group">
            <Label htmlFor="password">Mật khẩu</Label>
            <div style={{ position: 'relative' }}>
              <Input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                required
                style={{ paddingRight: 40 }}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="btn btn-primary login-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập ngay'}
          </Button>
          {error && <div className="error-msg">{error}</div>}
        </form>
        </CardContent>
      </Card>
    </>
  );
}

createRoot(document.getElementById('root')).render(<LoginPage />);
