import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';

/* Đăng nhập quản trị bằng Supabase Auth — không còn mật khẩu ghi sẵn trong code.
   Form "Tạo tài khoản" đang mở tạm để ban tổ chức tạo lại tài khoản mới;
   ngay khi tạo xong, form này sẽ được gỡ để người lạ không tự tạo tài khoản. */
export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const navigate = useNavigate();
  /* Nhớ trang quản trị mà bạn định vào trước khi bị bắt đăng nhập
     (ví dụ đang vào /quan-tri/chung-nhan → đăng nhập xong quay lại đúng trang đó) */
  const intendedPath = (useLocation().state as { from?: string } | null)?.from ?? '/quan-tri';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (!email || !password) {
        setError('Vui lòng nhập email và mật khẩu.');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (password.length < 6) {
          setError('Mật khẩu cần ít nhất 6 ký tự.');
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(
            /already registered|already exists/i.test(signUpError.message)
              ? 'Email này đã có tài khoản, hãy chuyển sang đăng nhập.'
              : signUpError.message,
          );
          setLoading(false);
          return;
        }
        if (data.session) {
          onLogin();
          navigate(intendedPath, { replace: true });
        } else {
          setNotice(
            'Đã gửi email xác nhận tới hộp thư của bạn. Hãy mở email và bấm link xác nhận, sau đó quay lại đăng nhập.',
          );
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Email hoặc mật khẩu không chính xác.');
      } else {
        onLogin();
        navigate(intendedPath, { replace: true });
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
        <div className="card p-8 shadow-lg sm:px-12 sm:py-10">
          <div className="text-center">
            <img
              src="/favicon.png"
              alt="Logo GEOENV RUN 2026"
              className="mx-auto mb-5 h-14 w-14 rounded-full ring-2 ring-geoenv-100"
            />
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === 'login' ? 'Đăng nhập quản trị' : 'Tạo tài khoản quản trị'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {mode === 'login'
                ? 'Chỉ ban tổ chức được quyền truy cập khu vực này.'
                : 'Tạo tài khoản một lần duy nhất cho ban tổ chức, dùng email mà bạn mở được hộp thư.'}
            </p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {notice && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{notice}</p>
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
                placeholder="email của bạn"
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading
                ? 'Đang kiểm tra...'
                : mode === 'login'
                  ? 'Đăng nhập'
                  : 'Tạo tài khoản'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            {mode === 'login' ? (
              <>
                Chưa có tài khoản quản trị?{' '}
                <button
                  type="button"
                  className="font-semibold text-geoenv-700 hover:underline"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setNotice('');
                  }}
                >
                  Tạo tài khoản
                </button>
              </>
            ) : (
              <>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  className="font-semibold text-geoenv-700 hover:underline"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setNotice('');
                  }}
                >
                  Đăng nhập
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
