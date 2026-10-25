import { supabase } from './supabase';

/* Đếm lượt truy cập — chỉ ghi, không hiển thị gì cho khách xem web:
   - Mỗi trình duyệt có 1 mã ngẫu nhiên lưu trong localStorage (không phải tên,
     không phải địa chỉ IP, không định danh được người thật).
   - Mỗi người mỗi trang mỗi ngày tính 1 lượt (tải lại trang trong ngày không
     tính thêm) — nhờ ràng buộc duy nhất ở bảng site_visits.
   - Quản trị viên đã đăng nhập và các trang /quan-tri/* không được đếm.
   - Ghi lỗi thì im lặng: bảng chưa có (chưa chạy SQL) cũng không làm web lỗi. */
const VISITOR_KEY = 'geoenv_visitor_id';

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `v-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

/* Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (khớp với hàm visit_stats). */
export function getVnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/* Ghi lượt xem — dùng INSERT thường, KHÔNG dùng upsert:
   upsert (INSERT ... ON CONFLICT) bị luật bảo mật dòng (RLS) chặn với tài
   khoản khách, vì nó đòi thêm quyền đọc bảng mới kiểm tra được trùng lặp —
   mà cấp quyền đọc cho khách thì lộ số liệu. INSERT thường chỉ cần quyền
   ghi nên chạy được; tải lại trang cùng ngày bị trùng khóa duy nhất thì
   lỗi được nuốt im lặng bên dưới, số liệu không sai. */
export async function recordVisit(path: string): Promise<void> {
  try {
    if (path.startsWith('/quan-tri')) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) return; // quản trị viên không tính vào số chung
    await supabase.from('site_visits').insert({
      visitor_id: getVisitorId(),
      path,
      visited_date: getVnToday(),
    });
  } catch {
    /* Im lặng: đếm là tính năng phụ, không được làm phiền người xem */
  }
}
