import { Inbox, Lock } from 'lucide-react';
import { FeedbackForm } from '../components/FeedbackForm';

/* Hòm thư góp ý & phản ánh — trang công khai, KHÔNG bị khóa chung với tra cứu/thư
   viện ảnh: trong lúc diễn ra giải, các bạn vẫn cần gửi được góp ý và phản ánh. */
export function Feedback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Tiêu đề trang */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-geoenv-50 px-3 py-1 text-xs font-semibold text-geoenv-700 ring-1 ring-geoenv-100">
          <Inbox className="h-3.5 w-3.5" />
          Hòm thư Ban tổ chức
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Góp ý &amp; phản ánh</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Trong lúc tham gia giải chạy, bạn có góp ý cho Ban tổ chức hoặc phát hiện điều chưa
          đúng (ví dụ chạy sai đường, gian lận, sự cố trên đường chạy) thì gửi vào đây nhé.
        </p>
      </div>

      {/* Cam kết riêng tư — quan trọng để các bạn dám tố cáo */}
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-geoenv-100 bg-geoenv-50/70 p-4 text-sm leading-relaxed text-slate-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-geoenv-600" />
        <span>
          Nội dung bạn gửi <strong className="text-slate-900">chỉ Ban tổ chức xem được</strong>,
          không hiển thị công khai. Bạn có thể gửi ẩn danh bằng cách bỏ trống họ tên.
        </span>
      </div>

      <div className="card mt-6 p-5 sm:p-6">
        <FeedbackForm />
      </div>
    </div>
  );
}
