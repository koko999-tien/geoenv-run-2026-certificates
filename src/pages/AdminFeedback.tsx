import { useEffect, useState } from 'react';
import { Inbox, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

const supaMsg = (e: unknown): string =>
  (e as { message?: string })?.message ?? 'Có lỗi xảy ra.';

interface Report {
  id: number;
  created_at: string;
  category: string;
  name: string | null;
  team: string | null;
  contact: string | null;
  content: string;
  is_read: boolean;
}

/* Màu huy hiệu theo loại phản ánh */
const CATEGORY_TONE: Record<string, string> = {
  'Góp ý tổ chức': 'bg-geoenv-50 text-geoenv-700 ring-geoenv-200',
  'Phản ánh vi phạm': 'bg-red-50 text-red-700 ring-red-200',
  'Sự cố cần hỗ trợ': 'bg-amber-50 text-amber-700 ring-amber-200',
  Khác: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/* Trang quản trị hòm thư — CHỈ Ban tổ chức xem được (bảng cấm khách đọc). */
export function AdminFeedback() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    const { data, error: supabaseError } = await supabase
      .from('feedback_reports')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (supabaseError) {
      setError(
        `Không tải được danh sách phản ánh: ${supaMsg(supabaseError)} Nếu bảng chưa được tạo, chạy file SQL tạo bảng hòm thư rồi tải lại trang.`,
      );
      return;
    }
    setReports((data as Report[]) || []);
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRead = async (report: Report) => {
    setActionMsg(null);
    const { error: supabaseError } = await supabase
      .from('feedback_reports')
      .update({ is_read: !report.is_read })
      .eq('id', report.id);
    if (supabaseError) {
      setActionMsg(`Không đổi được trạng thái: ${supaMsg(supabaseError)}`);
      return;
    }
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, is_read: !r.is_read } : r)),
    );
  };

  const deleteReport = async (id: number) => {
    setActionMsg(null);
    const { error: supabaseError } = await supabase.from('feedback_reports').delete().eq('id', id);
    setConfirmDeleteId(null);
    if (supabaseError) {
      setActionMsg(`Không xóa được: ${supaMsg(supabaseError)}`);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
    setActionMsg('Đã xóa phản ánh.');
  };

  const visible = tab === 'unread' ? reports.filter((r) => !r.is_read) : reports;
  const unreadCount = reports.filter((r) => !r.is_read).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 sm:text-3xl">
            <Inbox className="h-7 w-7 text-geoenv-600" />
            Góp ý &amp; phản ánh
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {reports.length} phản ánh, {unreadCount} chưa đọc — chỉ Ban tổ chức xem được.
          </p>
        </div>
      </div>

      {/* 2 tab: tất cả / chưa đọc */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'all'
              ? 'bg-geoenv-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả ({reports.length})
        </button>
        <button
          onClick={() => setTab('unread')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'unread'
              ? 'bg-geoenv-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      {actionMsg && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {actionMsg}
        </p>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-geoenv-600" />
        </div>
      ) : error ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : visible.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-sm text-slate-500">
          {tab === 'unread' ? 'Không còn phản ánh chưa đọc nào.' : 'Chưa có phản ánh nào.'}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((report) => (
            <article key={report.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                    CATEGORY_TONE[report.category] ?? CATEGORY_TONE['Khác']
                  }`}
                >
                  {report.category}
                </span>
                {!report.is_read && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-white">
                    Mới
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">{fmtTime(report.created_at)}</span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {report.content}
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Người gửi: {report.name || 'Ẩn danh'}
                {report.team ? ` • ${report.team}` : ''}
                {report.contact ? ` • Liên hệ: ${report.contact}` : ''}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void toggleRead(report)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {report.is_read ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Đánh dấu chưa đọc
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Đánh dấu đã đọc
                    </>
                  )}
                </button>
                {confirmDeleteId === report.id ? (
                  <>
                    <button
                      onClick={() => void deleteReport(report.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Chắc chắn xóa?
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(report.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
