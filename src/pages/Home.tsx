import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Calendar, Clock3, Image as ImageIcon, MapPin, Users } from 'lucide-react';

/* ============================================================
   ✏️ SỬA NỘI DUNG SỰ KIỆN TẠI ĐÂY — toàn trang tự cập nhật theo.
   ============================================================ */
const EVENT = {
  name: 'GEOENV RUN 2026',
  tagline: 'Bước chân Địa chất – Môi trường',
  intro:
    'Giải chạy 10KM EKIDEN do Khoa Khoa học Kỹ thuật Địa chất phối hợp Khoa Môi trường, Trường Đại học Mỏ – Địa chất tổ chức. Tra cứu giấy chứng nhận và xem album ảnh ngay tại website này.',
  dateText: 'Chủ nhật, 25/10/2026',
  placeText: 'Trường Đại học Mỏ – Địa chất',
  /* ✏️ QUAN TRỌNG: thời điểm giải chạy bắt đầu (dùng để đếm ngược) */
  startAt: '2026-10-25T06:00:00+07:00',
  hosts: [
    'Khoa Khoa học Kỹ thuật Địa chất',
    'Khoa Môi trường',
    'Trường Đại học Mỏ – Địa chất',
  ],
};

/* ✏️ LOGO 5 ĐƠN VỊ TỔ CHỨC — thứ tự hiển thị từ trái sang phải:
   Cờ Đoàn → Hội SV Việt Nam → Trường ĐH Mỏ–Địa chất → Khoa Địa chất → Khoa Môi trường.
   File đã chuẩn hoá khung 200×200 (public/logos) nên luôn bằng nhau, thẳng hàng.
   Muốn thay logo: lưu file mới vào public/logos với đúng tên bên dưới. */
const ORG_LOGOS = [
  /* ✏️ 5 file *-sticker.png: viền trắng VẼ BÁM THEO ĐƯỜNG VIỀT từng logo (decal),
     lề an toàn đã kiểm chứng — hiển thị trực tiếp, không cần khung CSS trắng */
  { src: '/logos/co-doan-sticker.png', alt: 'Đoàn Thanh niên Cộng sản Hồ Chí Minh' },
  { src: '/logos/hoi-sinh-vien-sticker.png', alt: 'Hội Sinh viên Việt Nam' },
  { src: '/logos/logo-humg-sticker.png', alt: 'Trường Đại học Mỏ – Địa chất' },
  { src: '/logos/khoa-dia-chat-sticker.png', alt: 'Khoa Khoa học & Kỹ thuật Địa chất' },
  { src: '/logos/khoa-moi-truong-sticker.png', alt: 'Khoa Môi trường' },
];

/* Ảnh nền Hero — ✏️ ĐỔI ẢNH CỦA BẠN:
   Lưu ảnh chụp sự kiện (1920px trở lên) vào thư mục public với tên hero.jpg
   rồi thay đường dẫn dưới thành '/hero.jpg' */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1920&q=80';

/* Bộ đếm ngược — tự cập nhật mỗi giây */
function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor(remaining / 3600000) % 24,
    minutes: Math.floor(remaining / 60000) % 60,
    seconds: Math.floor(remaining / 1000) % 60,
    isStarted: remaining === 0,
  };
}

export function Home() {
  const { days, hours, minutes, seconds, isStarted } = useCountdown(EVENT.startAt);
  const pad = (n: number) => String(n).padStart(2, '0');

  const countdownCells = [
    { value: pad(days), label: 'Ngày' },
    { value: pad(hours), label: 'Giờ' },
    { value: pad(minutes), label: 'Phút' },
    { value: pad(seconds), label: 'Giây' },
  ];

  const infoItems = [
    { icon: MapPin, label: 'Địa điểm', value: EVENT.placeText },
    { icon: Calendar, label: 'Ngày tổ chức', value: EVENT.dateText },
    { icon: Users, label: 'Tổ chức bởi', value: EVENT.hosts.join(' • ') },
  ];

  return (
    <div>
      {/* ================= HERO — ảnh nền + lớp phủ tối ================= */}
      <section className="relative isolate overflow-hidden">
        {/* ✏️ Ảnh nền — thay bằng ảnh thật trong public (xem chú thích HERO_IMAGE) */}
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        {/* Lớp phủ tối mờ để chữ trắng nổi bật (chuẩn chiến dịch truyền thông) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-geoenv-950/90 via-geoenv-900/75 to-emerald-900/60" />

        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          {/* 🏛️ Hàng đơn vị tổ chức — chuẩn "hàng tài trợ":
                 nhãn chữ có đường kẻ mảnh hai bên + 5 logo sticker trắng đồng khổ nổi trên nền tối */}
          <div className="mb-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-white/40 sm:w-16" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                Đơn vị tổ chức
              </p>
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-white/40 sm:w-16" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2.5">
              {ORG_LOGOS.map((logo) => (
                <img
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.alt}
                  loading="lazy"
                  className="h-[58px] w-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-1 sm:h-[72px]"
                />
              ))}
            </div>
          </div>

          {/* 1️⃣ Tên sự kiện — chủ thể trung tâm, đứng TRƯỚC khẩu hiệu */}
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
            {EVENT.name}
          </h1>

          {/* 2️⃣ Khẩu hiệu — nằm dưới tên sự kiện */}
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur sm:text-sm">
              🌿 {EVENT.tagline}
            </span>
          </div>

          {/* Viên thông tin nhanh: ngày + nơi */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur sm:text-sm">
              <Calendar className="h-4 w-4 text-geoenv-300" />
              {EVENT.dateText}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur sm:text-sm">
              <MapPin className="h-4 w-4 text-geoenv-300" />
              {EVENT.placeText}
            </span>
          </div>

          {/* ✏️ Đoạn giới thiệu (sửa trong EVENT ở đầu file) */}
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            {EVENT.intro}
          </p>

          {/* Hai nút bấm chính */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              to="/tra-cuu"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-geoenv-800 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-geoenv-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-geoenv-900 sm:w-auto"
            >
              <Award className="h-5 w-5" />
              Tra cứu giấy chứng nhận
            </Link>
            <Link
              to="/thu-vien-anh"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 px-8 py-4 font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-geoenv-900 sm:w-auto"
            >
              Xem thư viện ảnh
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* ============ BỘ ĐẾM NGƯỢC (thẻ kính mờ trên nền ảnh) ============ */}
          <div className="mt-12">
            {isStarted ? (
              <p className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur sm:text-base">
                🎉 Sự kiện đang diễn ra — chúc các vận động viên về đích an toàn!
              </p>
            ) : (
              <div className="inline-flex items-center rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur sm:px-8 sm:py-5">
                <div className="mr-3 hidden flex-col items-start sm:flex">
                  <Clock3 className="h-5 w-5 text-geoenv-300" />
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                    Đếm ngược
                  </span>
                </div>
                {countdownCells.map((cell) => (
                  <div key={cell.label} className="w-14 text-center sm:w-16">
                    <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                      {cell.value}
                    </div>
                    <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60 sm:text-xs">
                      {cell.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= THÔNG TIN SỰ KIỆN (thẻ trắng trên nền sáng) ================= */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Thông tin sự kiện
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="card flex items-start gap-3.5 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-col sm:items-center sm:text-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-geoenv-50 ring-1 ring-geoenv-100">
                  <item.icon className="h-5 w-5 text-geoenv-600" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HAI CHỨC NĂNG CHÍNH ================= */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Chức năng chính</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
              Tra cứu giấy chứng nhận và xem ảnh sự kiện một cách nhanh chóng, dễ dàng.
            </p>
          </div>

          {/* Hai card bằng nhau: nền trắng, viền mảnh, bóng đổ dịu chuẩn học thuật */}
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {/* ✏️ CARD 1: Tra cứu giấy chứng nhận */}
            <Link to="/tra-cuu" className="group block h-full">
              <div className="card flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1 hover:border-geoenv-200 hover:shadow-lg sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-geoenv-50 ring-1 ring-geoenv-100">
                  <Award className="h-6 w-6 text-geoenv-600" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                  Tra cứu giấy chứng nhận
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Nhập họ tên và lớp để tìm và tải giấy chứng nhận tham gia giải chạy.
                </p>
                <div className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-geoenv-600">
                  Bắt đầu tra cứu
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {/* ✏️ CARD 2: Thư viện ảnh */}
            <Link to="/thu-vien-anh" className="group block h-full">
              <div className="card flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
                  <ImageIcon className="h-6 w-6 text-emerald-600" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                  Thư viện ảnh sự kiện
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Xem ảnh sự kiện, mở ảnh lớn và tải ảnh về thiết bị của bạn.
                </p>
                <div className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-emerald-600">
                  Xem ảnh sự kiện
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
