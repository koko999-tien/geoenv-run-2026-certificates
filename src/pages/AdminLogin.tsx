import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components/Button';

export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  /* Nhớ trang quản trị mà bạn định vào trước khi bị bắt đăng nhập
     (ví dụ đang vào /quan-tri/chung-nhan → đăng nhập xong quay lại đúng trang đó) */
  const intendedPath = (useLocation().state as { from?: string } | null)?.from ?? '/quan-tri';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!email || !password) {
        setError('Vui lòng nhập email và mật khẩu.');
        setLoading(false);
        return;
      }

      /* ✏️ Tài khoản quản trị BTC — đổi email/mật khẩu tại đây */
      if (email === 'geovnvrun@gmail.com' && password === 'Geoenv@2026') {
        onLogin();
        navigate(intendedPath, { replace: true });
      } else {
        setError('Email hoặc mật khẩu không chính xác.');
      }
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Thẻ trắng chuẩn học thuật — ✏️ sửa tên/mô tả tại đây */}
        <div className="card p-8 shadow-lg sm:px-12 sm:py-10">
          <div className="text-center">
            <img
              src="/favicon.png"
              alt="Logo GEOENV RUN 2026"
              className="mx-auto mb-5 h-14 w-14 rounded-full ring-2 ring-geoenv-100"
            />
            <h1 className="text-2xl font-bold text-slate-900">Đăng nhập quản trị</h1>
            <p className="mt-2 text-sm text-slate-600">
              Chỉ ban tổ chức được quyền truy cập khu vực này.
            </p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="input-field"
                placeholder="geovnvrun@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
