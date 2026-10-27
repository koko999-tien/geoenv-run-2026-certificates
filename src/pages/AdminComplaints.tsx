import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/* Trang quản trị khiếu nại giấy bị khóa — Ban tổ chức xem khiếu nại gửi từ
   thẻ bị khóa trong trang tra cứu (kèm ảnh minh chứng), đánh dấu đã xử lý
   hoặc xóa. Chỉ admin đã đăng nhập mới đọc được danh sách này.
   Ảnh nằm trong bucket riêng tư nên trang tự tạo link ký riêng (hết hạn sau
   1 giờ) cho từng ảnh khi tải danh sách. */
const COMPLAINT_BUCKET = 'complaint-evidence';

/* Lỗi Supabase trả về là object thường, không phải Error — đọc message trực tiếp */
const supaMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Đã có lỗi xảy ra.';
};

interface Complaint {
  id: number;
  created_at: string;
  record_id: number;
  full_name: string;
  class_name: string | null;
  lock_reason: string | null;
  message: string;
  photo_url: string | null;
  photo_path: string | null;
  status: string;
}

type Tab = 'all' | 'pending' | 'resolved';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export function AdminComplaints() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  /* Link ký riêng từng ảnh (id khiếu nại -> link), tạo mới mỗi lần tải danh sách */
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('certificate_complaints')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(
        `Không tải được danh sách khiếu nại: ${supaMsg(error)}. Nếu bảng chưa được tạo, chạy file SQL tạo bảng khiếu nại rồi tải lại trang.`,
      );
      setItems([]);
      setSignedUrls({});
    } else {
      const list = (data ?? []) as Complaint[];
      setItems(list);
      /* Tạo link ký riêng cho từng ảnh có đường dẫn (link hết hạn sau 1 giờ) */
      const urls: Record<number, string> = {};
      await Promise.all(
        list
          .filter((it) => it.photo_path)
          .map(async (it) => {
            const { data: signed } = await supabase.storage
              .from(COMPLAINT_BUCKET)
              .createSignedUrl(it.photo_path!, 3600);
            if (signed?.signedUrl) urls[it.id] = signed.signedUrl;
          }),
      );
      setSignedUrls(urls);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const toggleResolved = async (item: Complaint) => {
    const next = item.status === 'resolved' ? 'pending' : 'resolved';
    setActingId(item.id);
    const { error } = await supabase
      .from('certificate_complaints')
      .update({ status: next })
      .eq('id', item.id);
    if (error) {
      setError(`Không đổi được trạng thái: ${supaMsg(error)}`);
    } else {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: next } : it)));
    }
    setActingId(null);
  };

  const deleteItem = async (item: Complaint) => {
    setActingId(item.id);
    const { error } = await supabase.from('certificate_complaints').delete().eq('id', item.id);
    if (error) {
      setError(`Không xóa được khiếu nại: ${supaMsg(error)}`);
      setActingId(null);
      return;
    }
    /* Xóa luôn ảnh trong bucket cho khỏi tốn dung lượng (lỗi thì bỏ qua) */
    if (item.photo_path) {
      await supabase.storage.from(COMPLAINT_BUCKET).remove([item.photo_path]);
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setConfirmDeleteId(null);
    setActingId(null);
  };

  const filtered = items.filter((it) =>
    tab === 'all' ? true : tab === 'pending' ? it.status !== 'resolved' : it.status === 'resolved',
  );
  const pendingCount = items.filter((it) => it.status !== 'resolved').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Khiếu nại giấy bị khóa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Khiếu nại gửi từ thẻ bị khóa trong trang tra cứu, kèm ảnh minh chứng nếu có.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => setTab('all')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-geoenv-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả ({items.length})
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-geoenv-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Chờ xử lý ({pendingCount})
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'resolved' ? 'bg-geoenv-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Đã xử lý ({items.length - pendingCount})
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {loading && <p className="mt-6 text-sm text-slate-500">Đang tải...</p>}

      {!loading && filtered.length === 0 && (
        <p className="mt-6 rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Chưa có khiếu nại nào trong mục này.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {filtered.map((it) => (
          <div key={it.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{it.full_name}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {it.class_name ? `Lớp ${it.class_name}` : 'Không rõ lớp'}
                  {it.lock_reason ? ` — Lý do khóa: ${it.lock_reason}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{fmtTime(it.created_at)}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  it.status === 'resolved'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}
              >
                {it.status === 'resolved' ? 'Đã xử lý' : 'Chờ xử lý'}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{it.message}</p>
            {it.photo_path && signedUrls[it.id] && (
              <a href={signedUrls[it.id]} target="_blank" rel="noreferrer" className="mt-3 block">
                <img
                  src={signedUrls[it.id]}
                  alt="Ảnh minh chứng khiếu nại"
                  className="max-h-64 rounded-xl object-contain ring-1 ring-slate-200"
                />
              </a>
            )}
            {it.photo_path && !signedUrls[it.id] && (
              <p className="mt-3 text-xs text-slate-500">Không tạo được link xem ảnh, thử tải lại trang.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void toggleResolved(it)}
                disabled={actingId === it.id}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50 disabled:opacity-60"
              >
                {it.status === 'resolved' ? 'Mở lại' : 'Đánh dấu đã xử lý'}
              </button>
              {confirmDeleteId === it.id ? (
                <>
                  <button
                    onClick={() => void deleteItem(it)}
                    disabled={actingId === it.id}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    Giữ lại
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(it.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
