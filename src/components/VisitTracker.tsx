import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordVisit } from '../lib/visits';

/* Ghi lượt xem mỗi khi chuyển trang công khai — không hiển thị gì, không chặn
   trang. Đặt trong BrowserRouter (cạnh ScrollToTop) để thấy mọi đường dẫn. */
export function VisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    void recordVisit(pathname);
  }, [pathname]);
  return null;
}
