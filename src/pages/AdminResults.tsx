import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Trash2, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

/* Trang quản trị kết quả chạy — chỉ Ban tổ chức xem được.
   Danh sách bài nộp mới nhất trước, lọc theo trạng thái duyệt, xóa 2 bước. */
const RESULTS_BUCKET = 'race-results';

const supaMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Đã có lỗi xảy ra.';
};

interface Submission {
  id: number;
  created_at: string;
  full_name: string;
  team: string;
  class_name: string | null;
  result_time: string | null;
  screenshot_url: string;
  screenshot_path: string;
  is_verified: boolean;
}

type Tab = 'all' | 'pending' | 'verified';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export function AdminResults() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('race_result_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(
        `Không tải được danh sách kết quả: ${supaMsg(error)}. Nếu bảng chưa được tạo, chạy file SQL tạo bảng nộp kết quả rồi tải lại trang.`,
      );
      setItems([]);
    } else {
      setItems((data ?? []) as Submission[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const toggleVerified = async (item: Submission) => {
    setActingId(item.id);
    const { error } = await supabase
      .from('race_result_submissions')
      .update({ is_verified: !item.is_verified })
      .eq('id', item.id);
    if (error) {
      setError(`Không đổi được trạng thái: ${supaMsg(error)}`);
    } else {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, is_verified: !it.is_verified } : it)));
    }
    setActingId(null);
  };

  const deleteItem = async (item: Submission) => {
    setActingId(item.id);
    const { error } = await supabase.from('race_result_submissions').delete().eq('id', item.id);
    if (error) {
      setError(`Không xóa được bài nộp: ${supaMsg(error)}`);
      setActingId(null);
      return;
    }
    /* Xóa luôn ảnh trong bucket cho khỏi tốn dung lượng (lỗi thì bỏ qua) */
    await supabase.storage.from(RESULTS_BUCKET).remove([item.screenshot_path]);
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setConfirmDeleteId(null);
    setActingId(null);
  };

  const filtered = items.filter((it) =>
    tab === 'all' ? true : tab === 'pending' ? !it.is_verified : it.is_verified,
  );
  const pendingCount = items.filter((it) => !it.is_verified).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/quan-tri"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-geoenv-600"
      >
        <span aria-hidden>←</span> Về tổng quan
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 sm:text-3xl">
          <Trophy className="h-7 w-7 text-amber-500" />
          Kết quả chạy
        </h1>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {pendingCount} chờ duyệt
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Ảnh chụp màn hình kết quả do VĐV gửi từ trang Nộp kết quả — mới nhất trước.
      </p>

      {/* Tabs lọc */}
      <div className="mt-6 flex gap-2">
        {(
          [
            { key: 'all', label: `Tất cả (${items.length})` },
            { key: 'pending', label: `Chờ duyệt (${pendingCount})` },
            { key: 'verified', label: `Đã duyệt (${items.length - pendingCount})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'bg-geoenv-600 text-white shadow'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-geoenv-300 hover:text-geoenv-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-center text-sm text-slate-500">Đang tải danh sách...</p>
      ) : filtered.length === 0 ? (
        <div className="card mt-6 py-14 text-center">
          <Trophy className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <p className="text-base font-semibold text-slate-900">
            {tab === 'all' ? 'Chưa có bài nộp nào' : tab === 'pending' ? 'Không còn bài nào chờ duyệt' : 'Chưa có bài nào được duyệt'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            VĐV gửi kết quả từ trang Nộp kết quả thì bài sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {filtered.map((it) => (
            <li key={it.id} className="card overflow-hidden">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                <a
                  href={it.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Bấm để xem ảnh lớn"
                  className="shrink-0"
                >
                  <img
                    src={it.screenshot_url}
                    alt={`Ảnh kết quả của ${it.full_name}`}
                    className="h-40 w-full rounded-xl border border-slate-200 object-contain bg-slate-50 sm:h-32 sm:w-48"
                  />
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{it.full_name}</p>
                    {it.is_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Đã duyệt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        <Clock3 className="h-3.5 w-3.5" /> Chờ duyệt
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Đội <strong className="text-slate-900">{it.team}</strong>
                    {it.class_name ? <> · Lớp {it.class_name}</> : null}
                    {it.result_time ? <> · Thành tích {it.result_time}</> : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Gửi lúc {fmtTime(it.created_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void toggleVerified(it)}
                      disabled={actingId === it.id}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-geoenv-400 hover:text-geoenv-700 disabled:opacity-60"
                    >
                      {it.is_verified ? 'Bỏ duyệt' : 'Duyệt kết quả'}
                    </button>
                    {confirmDeleteId === it.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          onClick={() => void deleteItem(it)}
                          disabled={actingId === it.id}
                          className="rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          Xóa thật
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                        >
                          Hủy
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(it.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-red-300 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" /> Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
