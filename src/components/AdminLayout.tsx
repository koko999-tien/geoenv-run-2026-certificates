import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Image as ImageIcon, LogOut, Menu, X, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

/* ✏️ Mục điều hướng cột trái — 1 dòng 1 trang quản trị */
const NAV_ITEMS = [
  { to: '/quan-tri', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/quan-tri/chung-nhan', label: 'Chứng nhận', icon: FileText, end: false },
  { to: '/quan-tri/anh', label: 'Thư viện ảnh', icon: ImageIcon, end: false },
];

export function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  /* Khối điều hướng dùng chung cho desktop + mobile */
  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={closeSidebar}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-geoenv-600 text-white shadow-[0_6px_16px_-6px_rgba(30,95,196,0.6)]'
                : 'text-slate-300 hover:bg-geoenv-900 hover:text-white'
            )
          }
        >
          <item.icon className="h-4.5 w-4.5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ===== SIDEBAR MÁY TÍNH — cố định bên trái ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-geoenv-950 md:flex">
        {/* Đầu sidebar: logo + tên khu vực */}
        <div className="flex items-center gap-2.5 border-b border-geoenv-900 px-5 py-4">
          <img src="/favicon.png" alt="Logo" className="h-9 w-9 rounded-full ring-1 ring-geoenv-800" />
          <div>
            <p className="text-sm font-bold leading-tight text-white">GEOENV RUN</p>
            <p className="text-[11px] text-slate-400">Khu vực quản trị</p>
          </div>
        </div>

        {navList}

        {/* Chân sidebar: về website chính + đăng xuất */}
        <div className="space-y-1 border-t border-geoenv-900 p-3">
          <Link
            to="/"
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-geoenv-900 hover:text-white"
          >
            <Globe className="h-4.5 w-4.5" />
            Về trang chính
          </Link>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4.5 w-4.5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ===== SIDEBAR Điện thoại (kéo ra/phủ mờ) ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeSidebar} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-geoenv-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-geoenv-900 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <img src="/favicon.png" alt="Logo" className="h-9 w-9 rounded-full ring-1 ring-geoenv-800" />
                <p className="text-sm font-bold text-white">GEOENV RUN</p>
              </div>
              <button onClick={closeSidebar} className="rounded-lg p-1.5 text-slate-400 hover:bg-geoenv-900 hover:text-white" aria-label="Đóng menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
            <div className="border-t border-geoenv-900 p-3">
              <Link
                to="/"
                onClick={closeSidebar}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-geoenv-900 hover:text-white"
              >
                <Globe className="h-4.5 w-4.5" />
                Về trang chính
              </Link>
              <button
                onClick={() => { closeSidebar(); onLogout(); }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut className="h-4.5 w-4.5" />
                Đăng xuất
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ===== NỘI DUNG ===== */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-60">
        {/* Topbar thanh trên: nút menu điện thoại + nhãn khu vực */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Mở menu quản trị"
          >
            <Menu className="h-6 w-6" />
          </button>
          <p className="text-sm font-medium text-slate-500 md:hidden">Khu vực quản trị</p>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-geoenv-400 hover:text-geoenv-700"
            >
              <Globe className="h-4 w-4" /> Trang chính
            </Link>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </header>

        <main className="flex-grow">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
          GEOENV RUN 2026 — Khu vực quản trị nội bộ, chỉ dành cho ban tổ chức.
        </footer>
      </div>
    </div>
  );
}
