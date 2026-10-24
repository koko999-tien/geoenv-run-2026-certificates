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
  ZoomIn,
} from 'lucide-react';

/* ============================================================
   ✏️ SỬA NỘI DUNG SỰ KIỆN TẠI ĐÂY — toàn trang tự cập nhật theo.
   ============================================================ */
const EVENT = {
  name: 'GEOENV RUN 2026',
  tagline: 'Bước chân Địa chất – Môi trường',
  intro:
    'Giải chạy tiếp sức Ekiden 10KM do hai Khoa: Khoa học & Kỹ thuật Địa chất phối hợp Khoa Môi trường tổ chức. Sự kiện chào đón tân sinh viên K71 và hướng tới kỷ niệm 60 năm thành lập Trường ĐH Mỏ – Địa chất.',
  dateText: 'Chủ nhật, 25/10/2026',
  placeText: 'Trường Đại học Mỏ – Địa chất',
  placeDetail:
    'Đường nội khu cạnh giảng đường A1, Khu Đô thị Đại học, Trường Đại học Mỏ – Địa chất (đối diện Trường THCS & THPT Đoàn Thị Điểm)',
  /* ✏️ QUAN TRỌNG: mốc đếm ngược = 5h30 tập trung sáng 25/10 (trừ 30 phút so với
     giờ xuất phát 6h00 theo yêu cầu của Tiến — đừng sửa lại thành 6h00).
     Qua mốc này đồng hồ chuyển sang trạng thái "đang diễn ra". */
  startAt: '2026-10-25T05:30:00+07:00',
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
  /* ✏️ Dùng file logo GỐC (đã tách nền). Mỗi logo được đặt trong huy hiệu tròn
     nền trắng (xem khối "Đơn vị tổ chức" ở Hero) nên không bao giờ bị xuyên
     thấu nền web, mép luôn sắc nét. Thứ tự: Đoàn — Hội SV — Trường — 2 Khoa. */
  { src: '/logos/co-doan.png', alt: 'Đoàn Thanh niên Cộng sản Hồ Chí Minh' },
  { src: '/logos/hoi-sinh-vien.png', alt: 'Hội Sinh viên Việt Nam' },
  { src: '/logos/logo-humg.png', alt: 'Trường Đại học Mỏ – Địa chất' },
  { src: '/logos/khoa-dia-chat.png', alt: 'Khoa Khoa học & Kỹ thuật Địa chất' },
  { src: '/logos/khoa-moi-truong.png', alt: 'Khoa Môi trường' },
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

  const startTime = new Date(target).getTime();
  const remaining = Math.max(0, startTime - now);
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor(remaining / 3600000) % 24,
    minutes: Math.floor(remaining / 60000) % 60,
    seconds: Math.floor(remaining / 1000) % 60,
    isStarted: remaining === 0,
    /* Sau ngày thi đấu (quá 24 giờ kể từ mốc đếm ngược 5h30) thì giải đã kết thúc */
    isEnded: now >= startTime + 86400000,
  };
}

export function Home() {
  const { days, hours, minutes, seconds, isStarted, isEnded } = useCountdown(EVENT.startAt);
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
      <section className="relative isolate overflow-hidden lg:flex lg:min-h-[90vh] lg:flex-col lg:items-center lg:justify-center">
        {/* ✏️ Ảnh nền — thay bằng ảnh thật trong public (xem chú thích HERO_IMAGE) */}
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        {/* Lớp phủ tối mờ để chữ trắng nổi bật (chuẩn chiến dịch truyền thông) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-geoenv-950/90 via-geoenv-900/75 to-emerald-900/60" />

        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:py-28 lg:max-w-4xl">
          {/* 🏛️ Hàng đơn vị tổ chức — chuẩn "hàng tài trợ":
                 nhãn chữ có đường kẻ mảnh hai bên + 5 logo sticker trắng đồng khổ nổi trên nền tối */}
          <div className="mb-6 flex flex-col items-center md:mb-8">
            <p className="mb-2 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/90 md:mb-3 md:text-xs">
              <span className="h-[1px] w-8 bg-white/30 md:w-12" />
              Đơn vị tổ chức
              <span className="h-[1px] w-8 bg-white/30 md:w-12" />
            </p>
            {/* Một dải capsule trắng duy nhất chứa cả 5 logo gốc — nền trắng của dải
                tự làm nền sạch cho mọi logo, giữ nguyên form dáng từng biểu trưng */}
            <div className="inline-flex max-w-full items-center justify-center gap-2.5 overflow-hidden rounded-full border border-white/60 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md sm:gap-3.5 sm:px-5 md:gap-5 md:px-7 md:py-2.5 lg:gap-6 lg:px-8 lg:py-2.5">
              {ORG_LOGOS.map((logo) => (
                <img
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.alt}
                  loading="lazy"
                  className="h-6 w-auto object-contain sm:h-7 md:h-9 lg:h-9"
                />
              ))}
            </div>
          </div>

          {/* 1️⃣ Tên sự kiện — chủ thể trung tâm, đứng TRƯỚC khẩu hiệu */}
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
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
          <p className="mx-auto mt-5 max-w-2xl text-balance text-sm leading-relaxed text-white/85 sm:text-base lg:max-w-3xl">
            {EVENT.intro}
          </p>

          {/* ============ BỘ ĐẾM NGƯỢC (thẻ kính mờ trên nền ảnh) ============ */}
          <div className="mt-8 sm:mt-12">
            {isEnded ? (
              <p className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur sm:text-base">
                🎉 Giải chạy đã diễn ra thành công — mời bạn tra cứu giấy chứng nhận và xem ảnh
                sự kiện!
              </p>
            ) : isStarted ? (
              <p className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur sm:text-base">
                🎉 Sự kiện đang diễn ra — chúc các vận động viên về đích an toàn!
              </p>
            ) : (
              <div className="inline-flex items-center rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur sm:px-8 sm:py-5 lg:px-10 lg:py-6">
                <div className="mr-3 hidden flex-col items-start sm:flex">
                  <Clock3 className="h-5 w-5 text-geoenv-300" />
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                    Đếm ngược
                  </span>
                </div>
                {countdownCells.map((cell) => (
                  <div key={cell.label} className="w-14 text-center sm:w-16 lg:w-20">
                    <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl lg:text-4xl">
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
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
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

      {/* ================= 3 CHỈ SỐ GIẢI ĐẤU ================= */}
      <section className="bg-gradient-to-r from-geoenv-800 via-geoenv-700 to-geoenv-800 py-8 sm:py-10 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          {/* Đúng 3 chỉ số kỹ thuật của giải — đối xứng 3 cột trên mọi màn hình */}
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Flag, value: '85', label: 'Đội thi đấu' },
              { icon: Users, value: '425', label: 'Vận động viên' },
              { icon: Route, value: '10 KM', label: 'Cự ly tiếp sức Ekiden' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="mx-auto h-5 w-5 text-geoenv-200" />
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-5xl lg:font-black">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium normal-case leading-snug tracking-normal text-geoenv-200 sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THÔNG TIN SỰ KIỆN (thẻ trắng trên nền sáng) ================= */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Thông tin sự kiện
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-8">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="card flex flex-col items-center p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:p-8"
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
          <div className="mt-5 flex justify-center px-4">
            <p className="inline-block max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm leading-relaxed text-slate-500">
              <MapPin className="mr-1 inline h-4 w-4 align-[-2px] text-geoenv-500" />
              <span className="font-semibold text-slate-700">Cung đường thi đấu:</span>{' '}
              {EVENT.placeDetail}
            </p>
          </div>
        </div>
      </section>

      {/* ================= SƠ ĐỒ ĐƯỜNG CHẠY ================= */}
      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Sơ đồ đường chạy
          </h2>
          <p className="mx-auto mt-5 max-w-2xl px-4 text-justify text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
            Đường chạy đi-về trên cùng một đoạn đường: xuất phát tại P. Nguyễn Đình Tứ,
            chạy 1 km đến điểm quay đầu rồi quay lại điểm xuất phát để bàn giao cho đồng
            đội — mỗi người chạy 2 km, 5 người tiếp sức tổng 10 km.
          </p>
          <div className="card mx-auto mt-7 max-w-4xl overflow-hidden">
            <a href="/so-do-duong-chay.webp" target="_blank" rel="noreferrer">
              <img
                src="/so-do-duong-chay.webp"
                alt="Sơ đồ đường chạy GEOENV RUN 2026: xuất phát tại P. Nguyễn Đình Tứ, chạy 1 km đến điểm quay đầu rồi quay lại điểm xuất phát để bàn giao; mỗi người chạy 2 km, 5 người tiếp sức tổng 10 km."
                loading="lazy"
                className="h-auto w-full"
              />
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 sm:text-sm">
            <ZoomIn className="h-4 w-4 text-geoenv-500" />
            Nhấn vào ảnh để xem kích thước đầy đủ.
          </p>
        </div>
      </section>

      {/* ================= GIỚI THIỆU & THỂ THỨC THI ĐẤU ================= */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-geoenv-600">
            Giới thiệu giải chạy
          </h2>
          <p className="mx-auto mt-5 max-w-2xl px-4 text-justify text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
            GEOENV RUN Season 2 – “Bước chân Địa chất &amp; Môi trường” là sân chơi thể thao
            lành mạnh nhằm thúc đẩy phong trào rèn luyện sức khỏe, tăng cường giao lưu, kết
            nối giữa cán bộ, giảng viên và sinh viên hai Khoa Địa chất – Môi trường nói
            riêng, sinh viên toàn trường nói chung — với tinh thần{' '}
            <span className="font-semibold text-geoenv-700">
              “Chạy vì sức khỏe, vì cộng đồng”
            </span>
            .
          </p>

          {/* Đoạn ý nghĩa 60 năm — chỉ dùng sự kiện đã xác thực, không thêm lời phát biểu */}
          <p className="mx-auto mt-5 max-w-2xl px-4 text-justify text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
            Giải chạy năm nay mang ý nghĩa đặc biệt khi diễn ra trong dịp kỷ niệm
            60&nbsp;năm thành lập Trường Đại học Mỏ&nbsp;–&nbsp;Địa&nbsp;chất
            (1966&nbsp;–&nbsp;2026), đồng thời chào đón các bạn tân sinh viên K71 — thế hệ tiếp
            bước truyền thống vẻ vang của Nhà&nbsp;trường.
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
                text: 'Vận động viên tham gia hợp lệ nhận giấy chứng nhận — tra cứu và tải về ngay tại website này.',
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
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
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
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
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
