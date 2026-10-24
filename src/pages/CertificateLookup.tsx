import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, AlertCircle, CheckCircle, Search, Info, Lightbulb } from 'lucide-react';
import { Button } from '../components/Button';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface SearchResult {
  found: boolean;
  unique: boolean;
  fullName: string | null;
  className: string | null;
  message: string;
  certificateUrl: string | null;
}

export function CertificateLookup() {
  const [form, setForm] = useState({ fullName: '', className: '' });
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalize = (text: string) =>
    text.trim().toLowerCase().replace(/\s+/g, ' ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const nameNorm = normalize(form.fullName);
      const classNorm = normalize(form.className);

      if (!nameNorm || !classNorm) {
        setError('Vui lòng nhập đầy đủ họ tên và lớp.');
        setLoading(false);
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('certificate_records')
        .select('*')
        .ilike('full_name', form.fullName.trim())
        .ilike('class_name', form.className.trim());

      if (supabaseError) throw supabaseError;

      if (!data || data.length === 0) {
        setResult({
          found: false,
          unique: false,
          fullName: null,
          className: null,
          message: 'Chúng tôi chưa tìm thấy giấy chứng nhận khớp với họ tên và lớp bạn nhập.',
          certificateUrl: null,
        });
        setLoading(false);
        return;
      }

      const exactMatches = data.filter(
        (r) => normalize(r.full_name) === nameNorm && normalize(r.class_name) === classNorm
      );

      if (exactMatches.length === 0) {
        setResult({
          found: false,
          unique: false,
          fullName: null,
          className: null,
          message: 'Chúng tôi chưa tìm thấy giấy chứng nhận khớp với họ tên và lớp bạn nhập.',
          certificateUrl: null,
        });
      } else if (exactMatches.length > 1) {
        setResult({
          found: true,
          unique: false,
          fullName: exactMatches[0].full_name,
          className: exactMatches[0].class_name,
          message:
            'Hệ thống thấy nhiều bản ghi trùng họ tên và lớp. Vui lòng liên hệ ban tổ chức để xác minh nhé.',
          certificateUrl: null,
        });
      } else {
        const record = exactMatches[0];
        /* ✏️ Link giấy chứng nhận là cột "certificate_url" trong bảng Supabase */
        const certUrl = record.certificate_url ?? null;
        if (!record.is_eligible) {
          setResult({
            found: true,
            unique: true,
            fullName: record.full_name,
            className: record.class_name,
            message: 'Bạn đã tham gia giải chạy nhưng hiện chưa đủ điều kiện nhận giấy chứng nhận.',
            certificateUrl: null,
          });
        } else {
          setResult({
            found: true,
            unique: true,
            fullName: record.full_name,
            className: record.class_name,
            message: 'Tìm thấy giấy chứng nhận của bạn rồi! 🎉',
            certificateUrl: certUrl,
          });
        }
      }
    } catch {
      setError('Có lỗi xảy ra khi tra cứu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  /* Mở link giấy chứng nhận ở tab mới — tương thích mọi loại link */
  const handleOpenCertificate = () => {
    if (!result?.certificateUrl) return;
    window.open(result.certificateUrl, '_blank', 'noopener');
  };

  const notFoundTips = [
    'Kiểm tra lại chính tả — nhớ đủ các dấu.',
    'Nhập đúng họ tên đầy đủ như khi đăng ký (có chữ đệm).',
    'Tên lớp phải khớp tên BTC lưu (ví dụ: "Du lịch địa chất K68").',
    'Vẫn không thấy? Liên hệ BTC qua thông tin ở cuối trang nhé.',
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      {/* Phần đầu — ✏️ sửa tiêu đề/mô tả tại đây */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-geoenv-600"
      >
        <span aria-hidden>←</span> Về trang chủ
      </Link>

      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-geoenv-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-geoenv-700 ring-1 ring-geoenv-100 sm:text-sm">
          🏅 Giấy chứng nhận
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          Tra cứu giấy chứng nhận
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Nhập <strong className="text-slate-900">họ tên</strong> và{' '}
          <strong className="text-slate-900">lớp</strong> để tìm và tải giấy chứng nhận tham gia
          GEOENV RUN 2026.
        </p>
      </div>

      {/* Form tra cứu — thẻ trắng chuẩn học thuật */}
      <form
        onSubmit={handleSubmit}
        className="card mt-8 p-5 shadow-md sm:p-7"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoFocus
              className="input-field"
              // ✏️ Sửa ví dụ gợi ý tại đây
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="className" className="block text-sm font-medium text-slate-700">
              Lớp <span className="text-red-500">*</span>
            </label>
            <input
              id="className"
              type="text"
              required
              className="input-field"
              // ✏️ Sửa ví dụ gợi ý tại đây
              placeholder="Du lịch địa chất K68"
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
              autoComplete="off"
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="mt-5 w-full text-base" disabled={loading}>
          {loading ? (
            <>
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Đang tìm kiếm...
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              Tìm giấy chứng nhận
            </>
          )}
        </Button>
      </form>

      {/* Báo lỗi hệ thống */}
      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Kết quả tra cứu */}
      {result && (
        <div
          className={cn(
            'mt-5 rounded-2xl border p-5',
            result.found && result.unique
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          )}
        >
          <div className="flex items-start gap-3">
            {result.found && result.unique ? (
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            ) : (
              <Info className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-base font-semibold sm:text-lg',
                  result.found && result.unique ? 'text-emerald-800' : 'text-amber-800'
                )}
              >
                {result.message}
              </p>

              {(result.fullName || result.className) && (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-bold text-slate-900">{result.fullName}</span>
                  {result.className && <span> • Lớp {result.className}</span>}
                </p>
              )}

              {/* Trạng thái đủ điều kiện */}
              {result.found && result.unique && (
                <div className="mt-4">
                  {result.certificateUrl ? (
                    <Button variant="primary" className="text-sm" onClick={handleOpenCertificate}>
                      <Download className="h-4 w-4" />
                      Tải giấy chứng nhận
                    </Button>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Giấy chứng nhận của bạn đã được lưu trong hệ thống. Ban tổ chức đang gắn
                        đường link file — bạn quay lại tra cứu sau ít phút nhé!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gợi ý khi không tìm thấy */}
      {result && !result.found && (
        <div className="card mt-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lightbulb className="h-5 w-5 text-geoenv-600" />
            Gợi ý khi không tìm thấy:
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {notFoundTips.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-geoenv-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
