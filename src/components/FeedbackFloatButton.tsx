import { Link, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

/* Nút góp ý nổi — hiện ở mọi trang công khai, KỂ CẢ trang đang khóa (vì hòm thư
   luôn mở trong lúc diễn ra giải, nên nút này chính là cánh cửa vẫn mở đó).
   Ẩn ở chính trang góp ý (đang ở đó rồi thì thừa). Khu vực quản trị không có nút
   này vì nút chỉ gắn trong Layout công khai, không gắn trong AdminLayout.
   Tối ưu cho điện thoại: cao 44px (vừa tầm ngón tay), góc dưới bên phải, cộng
   thêm khoảng an toàn của điện thoại (safe-area) để không bị thanh điều hướng
   hệ thống che mất. */
export function FeedbackFloatButton() {
  const { pathname } = useLocation();
  if (pathname === '/gop-y') return null;

  return (
    <Link
      to="/gop-y"
      aria-label="Gửi góp ý và phản ánh cho Ban tổ chức"
      className="fixed bottom-5 right-4 z-50 mb-[env(safe-area-inset-bottom)] flex h-11 items-center gap-2 rounded-full bg-geoenv-600 px-4 text-sm font-semibold text-white shadow-xl transition hover:bg-geoenv-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geoenv-600 focus-visible:ring-offset-2 sm:right-5"
    >
      <MessageSquare className="h-5 w-5" />
      Góp ý
    </Link>
  );
}
