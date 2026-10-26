import { useState } from 'react';
import { CheckCircle2, Clock3, ImagePlus, Lock, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image';
import { Button } from '../components/Button';

/* Trang nộp kết quả chạy — công khai, KHÔNG bị khóa chung với tra cứu/thư
   viện ảnh: trong và sau lúc diễn ra giải, các bạn vẫn cần gửi được kết quả.
   Ảnh và thông tin gửi lên chỉ Ban tổ chức xem được (bảng chỉ cho admin đọc). */
const RESULTS_BUCKET = 'race-results';

/* Lỗi Supabase trả về là object thường, không phải Error — đọc message trực tiếp */
const supaMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Đã có lỗi xảy ra.';
};

export function SubmitResult() {
  const [fullName, setFullName] = useState('');
  const [team, setTeam] = useState('');
  const [className, setClassName] = useState('');
  const [resultTime, setResultTime] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Chỉ gửi file ảnh thôi nhé.');
      return;
    }
    setError('');
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  };

  const resetForm = () => {
    setFullName('');
    setTeam('');
    setClassName('');
    setResultTime('');
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError('');
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Nhập họ tên của bạn.');
      return;
    }
    if (!team.trim()) {
      setError('Nhập tên đội của bạn.');
      return;
    }
    if (!file) {
      setError('Chọn ảnh chụp màn hình kết quả.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.includes('.')
        ? compressed.name.split('.').pop()!.toLowerCase()
        : 'jpg';
      const path = `ket-qua/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(RESULTS_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
      if (uploadError) {
        setError(
          `Không gửi được ảnh lên: ${supaMsg(uploadError)}. Kho lưu trữ chưa sẵn sàng — Ban tổ chức đang hoàn tất cài đặt, bạn quay lại sau ít phút nhé!`,
        );
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from(RESULTS_BUCKET).getPublicUrl(path);
      /* Insert thuần (không xin lại dữ liệu) — bảng chỉ cho khách INSERT nên
         xin lại dữ liệu sẽ bị chặn, giống hòm thư góp ý. */
      const { error: insertError } = await supabase.from('race_result_submissions').insert({
        full_name: fullName.trim(),
        team: team.trim(),
        class_name: className.trim() || null,
        result_time: resultTime.trim() || null,
        screenshot_url: pub.publicUrl,
        screenshot_path: path,
      });
      if (insertError) {
        setError(`Không gửi được kết quả: ${supaMsg(insertError)}. Bạn thử lại sau ít phút nhé!`);
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Không gửi được kết quả. Bạn thử lại sau ít phút nhé!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Tiêu đề trang */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
          <Trophy className="h-3.5 w-3.5" />
          Nộp kết quả chạy
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Nộp kết quả chạy</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Bạn vừa về đích? Gửi ảnh chụp màn hình kết quả (Strava hoặc đồng hồ chạy)
          kèm thông tin bên dưới để Ban tổ chức ghi nhận thành tích của bạn.
        </p>
      </div>

      {/* Cam kết riêng tư — kết quả chỉ BTC xem, không công khai */}
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm leading-relaxed text-slate-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Ảnh và thông tin bạn gửi <strong className="text-slate-900">chỉ Ban tổ chức xem được</strong>,
          không hiển thị công khai. Bạn chỉ cần gửi 1 lần cho mỗi lượt chạy.
        </span>
      </div>

      {submitted ? (
        <div className="card mt-6 p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Đã gửi thành công!</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
            Ban tổ chức sẽ kiểm tra ảnh và ghi nhận kết quả của bạn.
            Cảm ơn bạn đã tham gia GEOENV RUN 2026!
          </p>
          <Button variant="outline" className="mt-5" onClick={resetForm}>
            Gửi thêm kết quả khác
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card mt-6 p-5 sm:p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="kq-name" className="mb-1.5 block text-sm font-semibold text-slate-900">
                Họ tên <span className="text-red-500">*</span>
              </label>
              <input
                id="kq-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="kq-team" className="mb-1.5 block text-sm font-semibold text-slate-900">
                Đội <span className="text-red-500">*</span>
              </label>
              <input
                id="kq-team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="VD: Rùa Bò (đội 78)"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="kq-class" className="mb-1.5 block text-sm font-semibold text-slate-900">
                  Lớp <span className="font-normal text-slate-500">(không bắt buộc)</span>
                </label>
                <input
                  id="kq-class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: QLTNMT K71A"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="kq-time" className="mb-1.5 block text-sm font-semibold text-slate-900">
                  Thành tích <span className="font-normal text-slate-500">(không bắt buộc)</span>
                </label>
                <input
                  id="kq-time"
                  value={resultTime}
                  onChange={(e) => setResultTime(e.target.value)}
                  placeholder="VD: 12:34"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-900">
                Ảnh chụp màn hình kết quả <span className="text-red-500">*</span>
              </span>
              {preview ? (
                <div>
                  <img
                    src={preview}
                    alt="Xem trước ảnh kết quả"
                    className="max-h-72 w-full rounded-2xl border border-slate-200 object-contain bg-slate-50"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-geoenv-400 hover:text-geoenv-700">
                      Đổi ảnh khác
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files?.[0])}
                      />
                    </label>
                    <span className="truncate text-xs text-slate-500">{file?.name}</span>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition-colors hover:border-geoenv-400 hover:bg-geoenv-50/50">
                  <ImagePlus className="h-8 w-8 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Bấm để chọn ảnh chụp màn hình</span>
                  <span className="text-xs text-slate-500">
                    Ảnh Strava hoặc đồng hồ chạy, thấy rõ quãng đường và thời gian
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                Ảnh bắt buộc — Ban tổ chức đối chiếu thành tích qua ảnh bạn gửi.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="mt-5 w-full text-base" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi kết quả'}
          </Button>
        </form>
      )}
    </div>
  );
}
