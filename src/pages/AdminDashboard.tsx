import { useEffect, useState } from 'react';
import { Users, Loader2, ListChecks, Lock, Mail, Eye, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isPublicLocked } from '../lib/siteLock';

interface Stats {
  totalCertificates: number;
  eligibleCount: number;
  ineligibleCount: number;
  hasLinkCount: number;
  noLinkCount: number;
  unreadFeedback: number | null;
  pendingResults: number | null;
  loading: boolean;
}

interface VisitStats {
  total: number;
  today: number;
  unique: number;
  byPage: { path: string; views: number }[];
}

/* Tên hiển thị cho từng đường dẫn trong bảng lượt truy cập */
const PAGE_NAMES: Record<string, string> = {
  '/': 'Trang chủ',
  '/tra-cuu': 'Tra cứu giấy chứng nhận',
  '/gop-y': 'Góp ý & phản ánh',
  '/nop-ket-qua': 'Nộp kết quả chạy',
  '/kiem-tra': 'Kiểm tra (dữ liệu thử)',
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCertificates: 0,
    eligibleCount: 0,
    ineligibleCount: 0,
    hasLinkCount: 0,
    noLinkCount: 0,
    unreadFeedback: null,
    pendingResults: null,
    loading: true,
  });
  /* Lượt truy cập — null = đang tải, lỗi thì hiện câu báo riêng, không làm mất
     các số liệu khác. Chỉ trang này (sau đăng nhập) mới gọi hàm thống kê. */
  const [visits, setVisits] = useState<VisitStats | null>(null);
  const [visitsError, setVisitsError] = useState(false);
  /* Trạng thái khóa khu vực công khai: null = chưa đọc được (bảng cài đặt chưa có) */
  const [siteLocked, setSiteLocked] = useState<boolean | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  /* Lấy số liệu THẬT từ Supabase */
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [totalRes, eligibleRes, ineligibleRes, hasLinkRes, noLinkRes, locked, unreadFeedback, pendingResults] =
          await Promise.all([
            supabase.from('certificate_records').select('*', { count: 'exact', head: true }),
            supabase
              .from('certificate_records')
              .select('*', { count: 'exact', head: true })
              .eq('is_eligible', true),
            supabase
              .from('certificate_records')
              .select('*', { count: 'exact', head: true })
              .eq('is_eligible', false),
            supabase
              .from('certificate_records')
              .select('*', { count: 'exact', head: true })
              .not('certificate_url', 'is', null),
            supabase
              .from('certificate_records')
              .select('*', { count: 'exact', head: true })
              .is('certificate_url', null),
            isPublicLocked(),
            /* Số phản ánh chưa đọc — nuốt lỗi riêng để bảng hòm thư chưa có cũng
               không làm mất số liệu các bảng khác */
            supabase
              .from('feedback_reports')
              .select('*', { count: 'exact', head: true })
              .eq('is_read', false)
              .then(
                (res) => res.count ?? null,
                () => null,
              ),
            /* Số kết quả chạy chờ duyệt — nuốt lỗi riêng để bảng kết quả chưa có
               cũng không làm mất số liệu các bảng khác */
            supabase
              .from('race_result_submissions')
              .select('*', { count: 'exact', head: true })
              .eq('is_verified', false)
              .then(
                (res) => res.count ?? null,
                () => null,
              ),
          ]);
        setStats((s) => ({
          ...s,
          totalCertificates: totalRes.count ?? 0,
          eligibleCount: eligibleRes.count ?? 0,
          ineligibleCount: ineligibleRes.count ?? 0,
          hasLinkCount: hasLinkRes.count ?? 0,
          noLinkCount: noLinkRes.count ?? 0,
          unreadFeedback,
          pendingResults,
          loading: false,
        }));
        setSiteLocked(locked);
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    };
    loadStats();
    /* Số liệu truy cập — tải riêng, nuốt lỗi riêng để bảng đếm chưa có cũng
       không ảnh hưởng các số liệu khác */
    supabase
      .rpc('visit_stats')
      .then(
        ({ data, error }) => {
          if (error || !data) {
            setVisitsError(true);
            return;
          }
          const d = data as {
            total?: number;
            today?: number;
            unique_visitors?: number;
            by_page?: { path: string; views: number }[];
          };
          setVisits({
            total: d.total ?? 0,
            today: d.today ?? 0,
            unique: d.unique_visitors ?? 0,
            byPage: Array.isArray(d.by_page) ? d.by_page : [],
          });
        },
        () => setVisitsError(true),
      );
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
          ? 'Đã khóa khu vực công khai: khách vào trang tra cứu chỉ thấy thông báo tạm khóa.'
          : 'Đã mở lại khu vực công khai: mọi người vào tra cứu bình thường.',
      );
    }
    setToggling(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tổng quan</h1>
      </div>

      {/* Tổng quan đợt cuối 28/10 — nhìn một cái là biết còn thiếu gì trước ngày
          mở tra cứu: bao nhiêu người đủ điều kiện, bao nhiêu bị khóa, bao nhiêu
          đã/chưa có link giấy */}
      <div className="card mt-6 p-6 sm:p-7">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          <Trophy className="h-5 w-5 text-geoenv-600" />
          Tổng quan đợt cuối 28/10
        </h3>
        {stats.loading ? (
          <Loader2 className="mt-4 h-6 w-6 animate-spin text-geoenv-600" />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tổng hồ sơ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                {stats.totalCertificates}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Đủ điều kiện</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 sm:text-3xl">
                {stats.eligibleCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bị khóa</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-red-700 sm:text-3xl">
                {stats.ineligibleCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Đã có link</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                {stats.hasLinkCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Chưa có link</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 sm:text-3xl">
                {stats.noLinkCount}
              </p>
            </div>
          </div>
        )}
        <Link
          to="/quan-tri/chung-nhan"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-geoenv-700 hover:text-geoenv-800"
        >
          Vào quản lý chứng nhận <span aria-hidden>→</span>
        </Link>
      </div>

      {/* Lượt truy cập — CHỈ quản trị viên thấy: thẻ này nằm trong trang quản trị
          (sau đăng nhập), và hàm visit_stats chỉ cấp quyền cho tài khoản đã đăng
          nhập nên khách không thể đọc được số liệu dù biết tên hàm */}
      <div className="card mt-6 p-6 sm:p-7">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          <Eye className="h-5 w-5 text-geoenv-600" />
          Lượt truy cập
        </h3>
        {visitsError ? (
          <p className="mt-4 text-sm text-slate-500">
            Chưa tải được số liệu — chạy file SQL theo dõi lượt truy cập rồi tải lại trang.
          </p>
        ) : !visits ? (
          <Loader2 className="mt-4 h-6 w-6 animate-spin text-geoenv-600" />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tổng lượt</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                  {visits.total}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hôm nay</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                  {visits.today}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Người khác nhau</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                  {visits.unique}
                </p>
              </div>
            </div>
            {visits.byPage.length > 0 && (
              <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-4">
                {visits.byPage.map((row) => (
                  <div key={row.path} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{PAGE_NAMES[row.path] ?? row.path}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{row.views}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Công tắc khóa khu vực công khai */}
      <div className="card mt-6 p-6 sm:p-7">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          <Lock className="h-5 w-5 text-amber-600" />
          Khóa khu vực công khai
        </h3>
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

      {/* Các khu thao tác nhanh — ✏️ sửa tên nút tại đây */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ActionCard
          title="Quản lý chứng nhận"
          icon={<Users className="h-5 w-5 text-geoenv-600" />}
          items={[
            { to: '/quan-tri/chung-nhan', label: 'Vào quản lý chứng nhận', icon: ListChecks },
          ]}
        />
        <ActionCard
          title="Hòm thư góp ý & phản ánh"
          icon={<Mail className="h-5 w-5 text-amber-600" />}
          items={[
            {
              to: '/quan-tri/phan-anh',
              label: 'Xem góp ý & phản ánh',
              icon: Mail,
              badge:
                stats.unreadFeedback && stats.unreadFeedback > 0
                  ? `${stats.unreadFeedback} mới`
                  : null,
            },
          ]}
        />
        <ActionCard
          title="Kết quả chạy"
          icon={<Trophy className="h-5 w-5 text-amber-500" />}
          items={[
            {
              to: '/quan-tri/ket-qua',
              label: 'Duyệt kết quả chạy',
              icon: Trophy,
              badge:
                stats.pendingResults && stats.pendingResults > 0
                  ? `${stats.pendingResults} chờ duyệt`
                  : null,
            },
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
  items: {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | null;
  }[];
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
            {item.badge && (
              <span className="ml-auto rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
