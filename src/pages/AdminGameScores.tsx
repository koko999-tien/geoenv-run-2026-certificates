import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* Quản trị điểm trò chơi chạy vô tận: xem top điểm, xóa điểm nghi ngờ
   (điểm ảo do gửi tay). Chỉ tài khoản đã đăng nhập mới vào được trang này. */

interface ScoreRow {
  id: number;
  player_name: string;
  team_name: string | null;
  score: number;
  created_at: string;
}

export function AdminGameScores() {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScoreRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('game_scores')
      .select('id, player_name, team_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);
    if (err) {
      setError('Chưa tải được bảng điểm — chạy file SQL tạo bảng điểm rồi tải lại trang.');
      return;
    }
    setError(null);
    setRows((data ?? []) as ScoreRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error: err } = await supabase.from('game_scores').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (err) {
      setError('Không xóa được điểm, thử lại sau.');
      return;
    }
    setPendingDelete(null);
    void load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 sm:text-3xl">
        <Trophy className="h-7 w-7 text-amber-500" />
        Điểm trò chơi
      </h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {rows === null && !error ? (
        <Loader2 className="mt-6 h-6 w-6 animate-spin text-geoenv-600" />
      ) : rows && rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chưa có điểm nào.</p>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Hạng</th>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Đội</th>
                <th className="px-4 py-3 font-medium">Điểm</th>
                <th className="px-4 py-3 font-medium">Ngày gửi</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.player_name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.team_name ?? '—'}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-geoenv-700">{row.score}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.created_at).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setPendingDelete(row)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Chắc chắn xóa?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Xóa điểm {pendingDelete.score} của {pendingDelete.player_name}
              {pendingDelete.team_name ? ` (${pendingDelete.team_name})` : ''}. Không khôi phục được.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Đang xóa...' : 'Xóa điểm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
