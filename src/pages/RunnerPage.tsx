import { Link } from 'react-router-dom';
import { Footprints, Lock } from 'lucide-react';
import { useGameLock } from '../lib/siteLock';
import { RunnerGame } from './RunnerGame';

/* Trang Chạy vô tận riêng — tách khỏi hub Minigame để chỉ tải code game,
   không tải code quiz. Khung game rộng hết cỡ: máy tính tối đa 1024px, điện
   thoại full chiều ngang, canvas tự co giãn giữ đúng tỉ lệ 3:1.
   Khóa game giữ nguyên: khách chỉ thấy thông báo tạm khóa, quản trị viên
   đăng nhập mới chơi được. */

export function RunnerPage() {
  const { checked, locked, isAdmin } = useGameLock();

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
      <Link to="/minigame" className="text-sm font-semibold text-geoenv-700 hover:text-geoenv-800">
        ← Minigame
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
          <Footprints className="h-6 w-6 text-emerald-600" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Chạy vô tận</h1>
      </div>

      <div className="mt-6">
        {!checked ? (
          <p className="py-10 text-center text-sm text-slate-500">Đang tải…</p>
        ) : locked && !isAdmin ? (
          <div className="card p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
              <Lock className="h-7 w-7 text-amber-600" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Trò chơi đang tạm khóa</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              Chỉ quản trị viên chơi được lúc này. Ban tổ chức sẽ thông báo khi mở cho mọi người.
            </p>
          </div>
        ) : (
          <div>
            {locked && (
              <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                Bạn đang chơi với quyền quản trị viên — trò chơi đang khóa với khách.
              </div>
            )}
            <RunnerGame />
          </div>
        )}
      </div>
    </div>
  );
}
