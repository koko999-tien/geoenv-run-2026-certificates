import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Calendar,
  Camera,
  Clock3,
  Flag,
  Heart,
  Image as ImageIcon,
  Mail,
  MapPin,
  Medal,
  Route,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

/* ============================================================
   ✏️ SỬA NỘI DUNG SỰ KIỆN TẠI ĐÂY — toàn trang tự cập nhật theo.
   ============================================================ */
const EVENT = {
  name: 'GEOENV RUN 2026',
  tagline: 'Bước chân Địa chất – Môi trường',
  intro:
    'Giải chạy tiếp sức Ekiden 10KM do Liên chi Đoàn Khoa Khoa học và Kỹ thuật Địa chất phối hợp Liên chi Đoàn Khoa Môi trường tổ chức — hướng tới kỷ niệm 60 năm thành lập Trường Đại học Mỏ – Địa chất và chào đón tân sinh viên K71. Tra cứu giấy chứng nhận và xem album ảnh ngay tại website này.',
  dateText: 'Chủ nhật, 25/10/2026',
  placeText: 'Trường Đại học Mỏ – Địa chất',
  placeDetail:
    'Đường nội khu cạnh giảng đường A1, Khu Đô thị Đại học, Trường Đại học Mỏ – Địa chất (đối diện Trường THCS & THPT Đoàn Thị Điểm)',
  /* ✏️ QUAN TRỌNG: thời điểm giải chạy bắt đầu (dùng để đếm ngược) */
  startAt: '2026-10-25T06:00:00+07:00',
  hosts: [
    'Khoa Khoa học và Kỹ thuật Địa chất',
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

/* Ảnh nền Hero — ảnh thật GEOENV RUN mùa 1 (02/11/2025), chụp trước backdrop
   của hai Khoa. File nằm ở public/hero.jpg (bản nén 1920px từ album BTC). */
const HERO_IMAGE = '/hero.jpg';

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
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white sm:text-xs">
                Đơn vị tổ chức
              </p>
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-white/40 sm:w-16" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
              {ORG_LOGOS.map((logo) => (
                <span
                  key={logo.src}
                  title={logo.alt}
                  className="flex h-10 w-10 items-center justify-center transition-transform duration-200 hover:-translate-y-1 sm:h-12 sm:w-12"
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
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

      {/* ================= CHỨC NĂNG CHÍNH — ngay dưới banner, chạm 1 cái là tới ================= */}
      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Ô 1: Tra cứu giấy chứng nhận — chức năng quan trọng nhất, luôn ở đầu trang */}
            <Link to="/tra-cuu" className="group block">
              <div className="card flex h-full items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-geoenv-200 hover:shadow-lg sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-geoenv-600 shadow-md shadow-geoenv-600/25">
                  <Award className="h-6 w-6 text-white" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    Tra cứu giấy chứng nhận
                  </h2>
                  <p className="mt-0.5 text-sm leading-snug text-slate-600">
                    Nhập họ tên và lớp để tìm, tải giấy chứng nhận của bạn.
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-geoenv-500 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Ô 2: Thư viện ảnh */}
            <Link to="/thu-vien-anh" className="group block">
              <div className="card flex h-full items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/25">
                  <ImageIcon className="h-6 w-6 text-white" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    Thư viện ảnh sự kiện
                  </h2>
                  <p className="mt-0.5 text-sm leading-snug text-slate-600">
                    Xem và tải ảnh đẹp của giải chạy về máy của bạn.
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= DÃY SỐ LIỆU NỔI BẬT ================= */}
      <section className="bg-gradient-to-r from-geoenv-800 via-geoenv-700 to-geoenv-800 py-8 sm:py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 sm:px-6 lg:grid-cols-4">
          {[
            { icon: Flag, value: '85', label: 'Đội tham gia' },
            { icon: Users, value: '425', label: 'Vận động viên' },
            { icon: Route, value: '10 KM', label: 'Cự ly Ekiden' },
            { icon: Sparkles, value: '60 năm', label: 'Thành lập HUMG' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className="mx-auto h-5 w-5 text-geoenv-200" />
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-geoenv-200 sm:text-sm sm:normal-case sm:tracking-normal">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= NHÌN LẠI MÙA 1 — ảnh thật, dẫn vào thư viện ================= */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Nhìn lại GEOENV RUN mùa 1
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
                Những khoảnh khắc đáng nhớ của mùa giải 2025 — hẹn gặp lại ở mùa 2 với quy mô lớn
                hơn.
              </p>
            </div>
            <Link
              to="/thu-vien-anh"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-geoenv-700 hover:text-geoenv-800"
            >
              <Camera className="h-4 w-4" />
              Xem thư viện ảnh
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['/s1-1.jpg', '/s1-2.jpg', '/s1-3.jpg'].map((src, i) => (
              <Link
                key={src}
                to="/thu-vien-anh"
                className="group block overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-900/5"
              >
                <img
                  src={src}
                  alt={`GEOENV RUN mùa 1 — ảnh ${i + 1}`}
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </Link>
            ))}
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
          <p className="mx-auto mt-5 flex max-w-2xl items-start justify-center gap-1.5 text-center text-sm text-slate-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-geoenv-500" />
            <span>
              <span className="font-semibold text-slate-700">Cung đường thi đấu:</span>{' '}
              {EVENT.placeDetail}
            </span>
          </p>
        </div>
      </section>

      {/* ================= GIỚI THIỆU & THỂ THỨC THI ĐẤU ================= */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Giới thiệu giải chạy
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
            GEOENV RUN Season 2 – “Bước chân Địa chất &amp; Môi trường” là sân chơi thể thao
            lành mạnh nhằm thúc đẩy phong trào rèn luyện sức khỏe, tăng cường giao lưu, kết
            nối giữa cán bộ, giảng viên và sinh viên hai Khoa Địa chất – Môi trường nói
            riêng, sinh viên toàn trường nói chung — với tinh thần{' '}
            <span className="font-semibold text-geoenv-700">
              “Chạy vì sức khỏe, vì cộng đồng”
            </span>
            .
          </p>

          <h3 className="mt-12 text-center text-2xl font-bold text-slate-900">
            Thể thức thi đấu
          </h3>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Flag,
                title: 'Chạy tiếp sức Ekiden',
                text: 'Mỗi đội gồm 05 vận động viên, thi đấu theo hình thức tiếp sức đồng đội.',
              },
              {
                icon: Route,
                title: '2 km mỗi người – 10 km mỗi đội',
                text: 'Mỗi vận động viên chạy 2 km, cả đội chinh phục tổng cự ly 10 km.',
              },
              {
                icon: Users,
                title: 'Ít nhất 01 VĐV nữ mỗi đội',
                text: 'Cơ cấu đội bắt buộc có tối thiểu 01 vận động viên nữ trong 05 thành viên.',
              },
              {
                icon: Clock3,
                title: 'Ghi nhận bằng Strava',
                text: 'Thành tích quãng đường và thời gian của từng vận động viên được ghi nhận qua ứng dụng Strava.',
              },
              {
                icon: Sparkles,
                title: 'Quy mô mùa 2',
                text: '85 đội thi với 425 vận động viên đến từ các lớp, khoa trong toàn trường.',
              },
              {
                icon: Award,
                title: 'Chứng nhận cho VĐV',
                text: 'Vận động viên hoàn thành phần thi nhận giấy chứng nhận — tra cứu và tải về ngay tại website này.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card flex items-start gap-3.5 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-geoenv-50 ring-1 ring-geoenv-100">
                  <item.icon className="h-5 w-5 text-geoenv-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900 sm:text-[15px]">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= GIẢI THƯỞNG ================= */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Cơ cấu giải thưởng
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Trophy,
                medal: '🥇',
                title: 'Giải Nhất',
                prize: '1.500.000đ',
                note: 'Kèm huy chương và giấy chứng nhận cho cả đội.',
                accent: 'bg-amber-50 ring-amber-100 text-amber-600',
              },
              {
                icon: Trophy,
                medal: '🥈',
                title: 'Giải Nhì',
                prize: '1.000.000đ',
                note: 'Kèm huy chương và giấy chứng nhận cho cả đội.',
                accent: 'bg-slate-100 ring-slate-200 text-slate-500',
              },
              {
                icon: Trophy,
                medal: '🥉',
                title: 'Giải Ba',
                prize: '500.000đ',
                note: 'Kèm huy chương và giấy chứng nhận cho cả đội.',
                accent: 'bg-orange-50 ring-orange-100 text-orange-600',
              },
              {
                icon: Medal,
                medal: '🏆',
                title: 'VĐV nam xuất sắc nhất',
                prize: '300.000đ',
                note: 'Dành cho vận động viên nam có thành tích chạy 2 km nhanh nhất.',
                accent: 'bg-geoenv-50 ring-geoenv-100 text-geoenv-600',
              },
              {
                icon: Medal,
                medal: '🏆',
                title: 'VĐV nữ xuất sắc nhất',
                prize: '300.000đ',
                note: 'Dành cho vận động viên nữ có thành tích chạy 2 km nhanh nhất.',
                accent: 'bg-emerald-50 ring-emerald-100 text-emerald-600',
              },
              {
                icon: Camera,
                medal: '📸',
                title: 'Khoảnh khắc ấn tượng',
                prize: '500.000đ',
                note: 'Dành cho đội có tổng điểm tương tác cao nhất trên fanpage hai Khoa.',
                accent: 'bg-rose-50 ring-rose-100 text-rose-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${item.accent}`}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="text-2xl" aria-hidden>
                    {item.medal}
                  </span>
                </div>
                <p className="mt-4 text-sm font-bold text-slate-900 sm:text-[15px]">
                  {item.title}
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-geoenv-700">
                  {item.prize}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CUỘC THI KHOẢNH KHẮC ẤN TƯỢNG ================= */}
      <section className="bg-gradient-to-br from-geoenv-950 via-geoenv-900 to-emerald-900 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur">
              <Camera className="h-4 w-4" />
              Cuộc thi ảnh
            </span>
            <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
              Khoảnh khắc ấn tượng GEOENV RUN 2026
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              Mỗi đội gửi 01 bức ảnh ấn tượng nhất chụp trong thời gian diễn ra giải chạy.
              Ban tổ chức đăng ảnh lên fanpage của hai Khoa để khán giả bình chọn — đội có
              tổng điểm cao nhất nhận giải <span className="font-bold text-white">500.000đ</span>.
            </p>
          </div>

          <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Mail className="h-5 w-5 text-white" />
              </span>
              <p className="mt-3.5 text-sm font-bold text-white">1. Gửi ảnh dự thi</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                Gửi về email{' '}
                <a
                  href="mailto:lienchidiachat.humg@gmail.com"
                  className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  lienchidiachat.humg@gmail.com
                </a>{' '}
                với tiêu đề “KHOẢNH KHẮC ẤN TƯỢNG”, kèm tên đội và slogan của đội — trước{' '}
                <span className="font-semibold text-white">20h00 ngày 27/10/2026</span>.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Heart className="h-5 w-5 text-white" />
              </span>
              <p className="mt-3.5 text-sm font-bold text-white">2. Bình chọn trên fanpage</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                Like fanpage hai Khoa, share bài dự thi về trang cá nhân ở chế độ công khai
                và kêu gọi mọi người thả reaction, share cho ảnh của đội mình.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Share2 className="h-5 w-5 text-white" />
              </span>
              <p className="mt-3.5 text-sm font-bold text-white">3. Cách tính điểm</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                Mỗi lượt share kèm hashtag sự kiện = <span className="font-semibold text-white">3 điểm</span>;
                mỗi reaction like/love/care = <span className="font-semibold text-white">1 điểm</span>.
                Thời gian bình chọn: 3 ngày kể từ khi BTC đăng bài.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/60">
            Lưu ý: tài khoản hoặc bài dự thi dùng thủ thuật like/share ảo sẽ không được tính điểm.
          </p>
        </div>
      </section>

    </div>
  );
}
