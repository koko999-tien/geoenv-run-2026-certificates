import { useEffect, useState } from 'react';
import { Users, Image as ImageIcon, ShieldCheck, Loader2, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
    /* Thư viện ảnh thật chưa được ghép vào nên để 0 cho khớp với trang công khai,
       không lấy số mẫu như trước nữa */
    totalAlbums: 0,
    totalPhotos: 0,
    loading: true,
  });

  /* Lấy số liệu THẬT từ Supabase */
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [totalRes, eligibleRes] = await Promise.all([
          supabase.from('certificate_records').select('*', { count: 'exact', head: true }),
          supabase
            .from('certificate_records')
            .select('*', { count: 'exact', head: true })
            .eq('is_eligible', true),
        ]);
        setStats((s) => ({
          ...s,
          totalCertificates: totalRes.count ?? 0,
          eligibleCount: eligibleRes.count ?? 0,
          loading: false,
        }));
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    };
    loadStats();
  }, []);

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
