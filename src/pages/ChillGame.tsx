import { Link } from 'react-router-dom';
import { Gamepad2, Footprints, Lock, ArrowRight } from 'lucide-react';
import { useGameLock } from '../lib/siteLock';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

/* Trang Minigame giờ chỉ là TRANG CHỦ của 2 trò chơi — 2 thẻ, mỗi thẻ nhảy
   sang 1 trang riêng. Không tải sẵn code quiz lẫn code game như kiểu tab cũ,
   nên mở trang nào cũng nhẹ hơn: mỗi trang chỉ tải code của chính nó. */

export function ChillGame() {
  const { checked, locked, isAdmin } = useGameLock();
  const showGameBadge = checked && locked;
  useRevealOnScroll();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
          <Gamepad2 className="h-7 w-7 text-violet-600" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Minigame</h1>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/minigame/do-vui"
          className="card reveal-on-scroll group block p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-geoenv-200"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
            <Gamepad2 className="h-6 w-6 text-violet-600" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Đố vui</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            15 câu hỏi về GEOENV RUN, không tính giờ.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-geoenv-700">
            Chơi ngay
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          to="/minigame/chay-vo-tan"
          className="card reveal-on-scroll group block p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-geoenv-200"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
            <Footprints className="h-6 w-6 text-emerald-600" />
          </span>
          <span className="mt-4 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Chạy vô tận</h2>
            {showGameBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                <Lock className="h-3 w-3" />
                {isAdmin ? 'Đang khóa' : 'Tạm khóa'}
              </span>
            )}
          </span>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Nhảy, trượt, nhặt vật phẩm, phá kỷ lục.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-geoenv-700">
            Chơi ngay
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
