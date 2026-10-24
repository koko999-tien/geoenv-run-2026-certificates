import { Lock } from 'lucide-react';

/* Thông báo tạm khóa dùng chung cho trang tra cứu và thư viện ảnh khi khu vực
   công khai đang khóa. Nội dung do BTC duyệt — sửa chữ tại đây nếu BTC đổi ý. */
export function PublicLockNotice() {
  return (
    <div className="card mt-8 p-8 text-center sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
        <Lock className="h-7 w-7 text-amber-600" />
      </span>
      <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
        Khu vực này đang tạm khóa
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
        Tra cứu giấy chứng nhận và thư viện ảnh đang tạm khóa để Ban tổ chức hoàn thiện dữ liệu
        sau giải chạy. Ban tổ chức sẽ thông báo khi mở lại — bạn quay lại sau nhé!
      </p>
    </div>
  );
}
