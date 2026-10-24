import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';

/* Hộp góp ý nổi — mở từ nút nổi góc màn hình, phủ lên trên trang người dùng đang
   đọc mà KHÔNG chuyển trang, nên đóng hộp lại là đúng chỗ đang đọc dở (không mất
   dấu). Trên điện thoại hộp trượt lên từ dưới dạng bảng chọn (bottom sheet), trên
   máy tính hiện ở giữa màn hình. Mở hộp thì khóa cuộn trang nền; đóng hộp (nút X,
   bấm ra nền mờ, phím Escape) thì trả lại cuộn bình thường. */
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  /* Khóa cuộn trang nền + đóng bằng phím Escape trong lúc hộp mở */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      {/* Nền mờ — bấm vào là đóng hộp */}
      <button
        type="button"
        aria-label="Đóng hộp góp ý"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
      />
      {/* Panel hộp — bảng chọn dưới đáy trên điện thoại, hộp giữa màn hình trên máy tính */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Góp ý và phản ánh"
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
      >
        {/* Đầu hộp — cố định, luôn thấy nút đóng kể cả khi cuộn form */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">Góp ý &amp; phản ánh</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thân hộp — cuộn bên trong, trang nền đứng yên */}
        <div className="overflow-y-auto px-5 py-4 sm:px-6">
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-geoenv-100 bg-geoenv-50/70 p-3.5 text-sm leading-relaxed text-slate-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-geoenv-600" />
            <span>
              Nội dung bạn gửi <strong className="text-slate-900">chỉ Ban tổ chức xem được</strong>,
              không hiển thị công khai. Bạn có thể gửi ẩn danh bằng cách bỏ trống họ tên.
            </span>
          </div>

          <FeedbackForm />

          <p className="mt-4 pb-1 text-center text-sm">
            <Link to="/gop-y" onClick={onClose} className="font-medium text-geoenv-700 underline">
              Mở trang góp ý đầy đủ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
