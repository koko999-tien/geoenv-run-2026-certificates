import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-geoenv-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Logo + giới thiệu */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/favicon.png"
                alt="Logo GEOENV RUN 2026"
                className="h-10 w-10 rounded-full ring-2 ring-geoenv-800"
              />
              <span className="font-bold text-lg text-white tracking-tight">GEOENV RUN 2026</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Bước chân Địa chất – Môi trường. Giải chạy chính thức của Trường Đại học Mỏ – Địa chất.
            </p>
          </div>

          {/* Liên kết nhanh */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chức năng</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/tra-cuu" className="transition-colors hover:text-white">
                  Tra cứu giấy chứng nhận
                </Link>
              </li>
              <li>
                <Link to="/thu-vien-anh" className="transition-colors hover:text-white">
                  Thư viện ảnh
                </Link>
              </li>
            </ul>
          </div>

          {/* Thông tin */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đơn vị tổ chức</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Trường Đại học Mỏ – Địa chất</li>
              <li>Khoa Khoa học Kỹ thuật Địa chất</li>
              <li>Khoa Môi trường</li>
            </ul>
          </div>

          {/* Liên hệ — ✏️ sửa email / số điện thoại tại đây */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Liên hệ</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>
                Email:{' '}
                <a href="mailto:duron62789@gmail.com" className="text-geoenv-400 transition-colors hover:text-geoenv-300">
                  duron62789@gmail.com
                </a>
              </li>
              <li>Điện thoại: 0326881352</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-geoenv-900/60 pt-6">
          <p className="text-center text-xs text-slate-500">
            © 2026 Khoa Môi trường, Trường Đại học Mỏ – Địa chất. Bản quyền thuộc về ban tổ chức GEOENV RUN 2026.
          </p>
        </div>
      </div>
    </footer>
  );
}
