import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

/* ✏️ Sửa tên liên kết tại đây — 1 dòng 1 trang */
const NAV_LINKS = [
  { to: '/tra-cuu', label: 'Tra cứu giấy chứng nhận' },
  { to: '/nop-ket-qua', label: 'Nộp kết quả' },
  { to: '/minigame', label: 'Minigame' },
  { to: '/gop-y', label: 'Góp ý & phản ánh' },
  { to: '/quan-tri', label: 'Quản trị' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={closeMenu}>
            <img
              src="/favicon.png"
              alt="Logo GEOENV RUN 2026"
              className="h-9 w-9 rounded-full ring-2 ring-geoenv-100"
            />
            <span className="font-bold text-base text-slate-900 tracking-tight sm:text-lg">
              GEOENV RUN 2026
            </span>
          </Link>

          {/* Menu máy tính */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-geoenv-50 hover:text-geoenv-700"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Nút ☰ điện thoại */}
          <button
            className="rounded-lg p-2.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu điện thoại */}
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={closeMenu}
              className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-geoenv-50 hover:text-geoenv-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
