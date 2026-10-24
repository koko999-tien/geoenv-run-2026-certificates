import { useEffect, useState } from 'react';
import { Users, Image as ImageIcon, ShieldCheck, Loader2, ListChecks, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isPublicLocked } from '../lib/siteLock';

interface Stats {
  totalCertificates: number;
  eligibleCount: number;
  totalAlbums: number;
  totalPhotos: number;
  loading: boolean;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCertificates: 0,
    eligibleCount: 0,
    totalAlbums: 0,
    totalPhotos: 0,
    loading: true,
  });
  /* Trạng thái khóa khu vực công khai: null = chưa đọc được (bảng cài đặt chưa có) */
  const [siteLocked, setSiteLocked] = useState<boolean | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  /* Lấy số liệu THẬT từ Supabase */
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [totalRes, eligibleRes, albumsRes, photosRes, locked] = await Promise.all([
          supabase.from('certificate_records').select('*', { count: 'exact', head: true }),
          supabase
            .from('certificate_records')
            .select('*', { count: 'exact', head: true })
            .eq('is_eligible', true),
          supabase.from('albums').select('*', { count: 'exact', head: true }),
          supabase.from('photos').select('*', { count: 'exact', head: true }),
          isPublicLocked(),
        ]);
        setStats((s) => ({
          ...s,
          totalCertificates: totalRes.count ?? 0,
          eligibleCount: eligibleRes.count ?? 0,
          totalAlbums: albumsRes.count ?? 0,
          totalPhotos: photosRes.count ?? 0,
          loading: false,
        }));
        setSiteLocked(locked);
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    };
    loadStats();
  }, []);

  /* Bật/tắt khóa khu vực công khai — bấm 1 lần để xác nhận, bấm lần 2 mới đổi */
  const handleToggleLock = async () => {
    if (!confirmToggle) {
      setConfirmToggle(true);
      return;
    }
    setConfirmToggle(false);
    if (siteLocked === null) return;
    setToggling(true);
    const next = !siteLocked;
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'public_locked', value: next ? 'true' : 'false', updated_at: new Date().toISOString() });
    if (error) {
      setLockNotice(
        `Không đổi được trạng thái khóa: ${(error as { message?: string }).message ?? 'Có lỗi xảy ra.'} Nếu bảng cài đặt chưa có, chạy file SQL tạo bảng rồi thử lại.`,
      );
    } else {
      setSiteLocked(next);
      setLockNotice(
        next
          ? 'Đã khóa khu vực công khai: khách vào trang tra cứu/thư viện chỉ thấy thông báo tạm khóa.'
          : 'Đã mở lại khu vực công khai: mọi người vào tra cứu/thư viện bình thường.',
      );
    }
    setToggling(false);
  };

  const statCards = [
    { title: 'Tổng hồ sơ chứng nhận', value: stats.totalCertificates, icon: Users, tone: 'bg-geoenv-50 text-geoenv-600 ring-geoenv-100' },
    { title: 'Đủ điều kiện nhận', value: stats.eligibleCount, icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { title: 'Album ảnh', value: stats.totalAlbums, icon: ImageIcon, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
    { title: 'Tổng ảnh', value: stats.totalPhotos, icon: ImageIcon, tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tổng quan</h1>
        <p className="mt-1 text-sm text-slate-600">Bức tranh tổng thể sự kiện GEOENV RUN 2026</p>
      </div>

      {/* 4 ô thống kê — số thật từ Supabase */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.title} className="card flex items-center justify-between p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.title}</p>
              {stats.loading ? (
                <Loader2 className="mt-2 h-6 w-6 animate-spin text-geoenv-600" />
              ) : (
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{card.value}</p>
              )}
            </div>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </span>
          </div>
        ))}
      </div>

      {/* Công tắc khóa khu vực công khai */}
      <div className="card mt-6 p-6 sm:p-7">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          <Lock className="h-5 w-5 text-amber-600" />
          Khóa khu vực công khai
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Khi khóa: khách chưa đăng nhập vào trang tra cứu giấy chứng nhận hoặc thư viện ảnh chỉ
          thấy thông báo tạm khóa; quản trị viên đã đăng nhập vẫn dùng bình thường để nhập và kiểm
          tra dữ liệu.
        </p>
        {siteLocked === null ? (
          <p className="mt-4 text-sm text-slate-500">
            Chưa đọc được trạng thái khóa — chạy file SQL tạo bảng cài đặt rồi tải lại trang.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                siteLocked
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              }`}
            >
              {siteLocked ? 'Đang khóa' : 'Đang mở'}
            </span>
            <button
              onClick={() => void handleToggleLock()}
              disabled={toggling}
              className="rounded-xl bg-geoenv-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700 disabled:opacity-60"
            >
              {toggling
                ? 'Đang đổi...'
                : confirmToggle
                  ? 'Chắc chắn đổi?'
                  : siteLocked
                    ? 'Mở lại khu vực công khai'
                    : 'Khóa khu vực công khai'}
            </button>
          </div>
        )}
        {lockNotice && <p className="mt-3 text-sm text-slate-700">{lockNotice}</p>}
      </div>

      {/* Hai khu thao tác nhanh — ✏️ sửa tên nút tại đây */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ActionCard
          title="Quản lý chứng nhận"
          icon={<Users className="h-5 w-5 text-geoenv-600" />}
          items={[
            { to: '/quan-tri/chung-nhan', label: 'Vào quản lý chứng nhận', icon: ListChecks },
          ]}
        />
        <ActionCard
          title="Quản lý thư viện ảnh"
          icon={<ImageIcon className="h-5 w-5 text-emerald-600" />}
          items={[
            { to: '/quan-tri/anh', label: 'Vào thư viện ảnh', icon: ImageIcon },
          ]}
        />
      </div>
    </div>
  );
}

function ActionCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="card p-6 sm:p-7">
      <h3 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-slate-900">
        {icon}
        {title}
      </h3>
      <div className="space-y-2.5">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-700 transition-all hover:border-geoenv-300 hover:bg-geoenv-50 hover:text-geoenv-700"
          >
            <item.icon className="h-4 w-4 shrink-0 text-geoenv-600" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
