import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image';

/* Form khiếu nại đặt ngay dưới lý do khóa trên thẻ bị khóa — thay cho liên hệ mail.
   Người bị khóa mô tả rõ vấn đề + gửi ảnh minh chứng (không bắt buộc);
   Ban tổ chức xem và xử lý trong trang quản trị khiếu nại. */
const COMPLAINT_BUCKET = 'complaint-evidence';

/* Lỗi Supabase trả về là object thường, không phải Error — đọc message trực tiếp */
const supaMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Đã có lỗi xảy ra.';
};

interface ComplaintFormProps {
  recordId: number;
  fullName: string;
  className: string | null;
  lockReason: string | null;
}

export function ComplaintForm({ recordId, fullName, className, lockReason }: ComplaintFormProps) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Vui lòng mô tả rõ vấn đề của bạn.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      let photoPath: string | null = null;
      if (file) {
        const compressed = await compressImage(file);
        const ext = compressed.name.includes('.')
          ? compressed.name.split('.').pop()!.toLowerCase()
          : 'jpg';
        const path = `khieu-nai/${recordId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(COMPLAINT_BUCKET)
          .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
        if (uploadError) {
          setError(
            `Không gửi được ảnh lên: ${supaMsg(uploadError)}. Kho lưu trữ chưa sẵn sàng — bạn thử lại sau ít phút nhé!`,
          );
          setSubmitting(false);
          return;
        }
        const { data: pub } = supabase.storage.from(COMPLAINT_BUCKET).getPublicUrl(path);
        photoUrl = pub.publicUrl;
        photoPath = path;
      }
      /* Insert thuần (không xin lại dữ liệu) — bảng chỉ cho khách INSERT nên
         xin lại dữ liệu sẽ bị chặn, giống hòm thư góp ý và nộp kết quả. */
      const { error: insertError } = await supabase.from('certificate_complaints').insert({
        record_id: recordId,
        full_name: fullName,
        class_name: className,
        lock_reason: lockReason,
        message: message.trim(),
        photo_url: photoUrl,
        photo_path: photoPath,
        status: 'pending',
      });
      if (insertError) {
        setError(`Không gửi được khiếu nại: ${supaMsg(insertError)}. Bạn thử lại sau ít phút nhé!`);
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Không gửi được khiếu nại. Bạn thử lại sau ít phút nhé!');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Đã gửi khiếu nại.</p>
        <p className="mt-1">Ban tổ chức sẽ xem xét và phản hồi. Bạn không cần gửi lại.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Gửi khiếu nại</p>
      <div>
        <label htmlFor="complaint-message" className="mb-1 block text-xs font-medium text-slate-600">
          Mô tả rõ vấn đề của bạn
        </label>
        <textarea
          id="complaint-message"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          placeholder="Ví dụ: Tôi đã tham gia giải chạy ngày 25/10 nhưng hệ thống báo không tham gia..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Ảnh minh chứng (không bắt buộc)</p>
        {file ? (
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-geoenv-400 hover:text-geoenv-700">
              Đổi ảnh khác
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="truncate text-xs text-slate-500">{file.name}</span>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition-colors hover:border-geoenv-400 hover:bg-geoenv-50/50">
            <ImagePlus className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Ấn vào để tải ảnh lên</span>
            <span className="text-xs text-slate-500">Ảnh chụp màn hình, ảnh tham gia giải chạy...</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-geoenv-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-geoenv-700 disabled:opacity-60"
      >
        {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
      </button>
    </form>
  );
}
