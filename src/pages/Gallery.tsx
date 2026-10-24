import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Image as ImageIcon, Download, ArrowLeft, ArrowRight, X, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { driveDownloadUrl } from '../lib/drive';
import { usePublicLock } from '../lib/siteLock';
import { PublicLockNotice } from '../components/PublicLockNotice';
import type { Album, Photo } from '../types/index';

/* Ảnh sự kiện lấy từ bảng albums/photos trong Supabase (quản trị viên thêm bằng link Drive). */

export function Gallery() {
  const [search, setSearch] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('all');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photoRows, setPhotoRows] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  /* Cổng khóa khu vực công khai: khách thấy thông báo tạm khóa, admin đã đăng nhập vẫn dùng */
  const lock = usePublicLock();

  /* Tải album + ảnh từ Supabase; bảng chưa có hoặc lỗi thì hiện trạng thái trống, không vỡ trang.
     Đang khóa với khách thì khỏi tải dữ liệu. */
  useEffect(() => {
    if (!lock.checked) return;
    if (lock.locked && !lock.isAdmin) {
      setAlbums([]);
      setPhotoRows([]);
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [aRes, pRes] = await Promise.all([
          supabase.from('albums').select('*').order('created_at', { ascending: true }),
          supabase.from('photos').select('*').order('created_at', { ascending: false }),
        ]);
        const rows = (pRes.data ?? []) as Photo[];
        const counts = new Map<string, number>();
        const covers = new Map<string, string>();
        rows.forEach((p) => {
          counts.set(p.album_id, (counts.get(p.album_id) ?? 0) + 1);
          if (!covers.has(p.album_id)) covers.set(p.album_id, p.thumbnail_url || p.url);
        });
        setAlbums(
          ((aRes.data ?? []) as Album[]).map((a) => ({
            ...a,
            cover_image_url: covers.get(a.id) ?? null,
            photo_count: counts.get(a.id) ?? 0,
          })),
        );
        setPhotoRows(rows);
      } catch {
        setAlbums([]);
        setPhotoRows([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [lock]);

  const photos = photoRows.filter(
    (p) =>
      (selectedAlbum === 'all' || p.album_id === selectedAlbum) &&
      p.title.toLowerCase().includes(search.toLowerCase())
  );

  const openViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerOpen(true);
  };

  const closeViewer = () => setViewerOpen(false);

  const prevPhoto = () => {
    setCurrentIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  };

  const nextPhoto = () => {
    setCurrentIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  };

  /* Bàn phím: ← → đổi ảnh, ESC tắt; khoá cuộn nền khi mở to */
  useEffect(() => {
    if (!viewerOpen) return;

    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, photos.length]);

  /* Tải: mở link tải trực tiếp — tương thích mọi loại link ảnh */
  const downloadPhoto = (photo: { url: string }) => {
    window.open(driveDownloadUrl(photo.url), '_blank', 'noopener');
  };

  const currentAlbum = albums.find((a) => a.id === selectedAlbum);

  /* Đang kiểm tra cờ khóa */
  if (!lock.checked) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <p className="text-center text-sm text-slate-500">Đang tải...</p>
      </div>
    );
  }

  /* Đang khóa và không phải admin: chỉ hiện thông báo tạm khóa */
  if (lock.locked && !lock.isAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-geoenv-600"
        >
          <span aria-hidden>←</span> Về trang chủ
        </Link>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-700 ring-1 ring-emerald-100 sm:text-sm">
            📸 Album ảnh
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Thư viện ảnh sự kiện</h1>
        </div>
        <PublicLockNotice />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      {/* Phần đầu trang — ✏️ sửa tiêu đề/mô tả tại đây */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-geoenv-600"
      >
        <span aria-hidden>←</span> Về trang chủ
      </Link>

      {lock.locked && lock.isAdmin && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          Bạn đang xem với quyền quản trị — trang đang khóa với khách.
        </div>
      )}

      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-700 ring-1 ring-emerald-100 sm:text-sm">
          📸 Album ảnh
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Thư viện ảnh sự kiện</h1>

      </div>

      {/* Thanh công cụ: tìm kiếm + chọn album */}
      <div className="card mt-8 p-4 shadow-md sm:p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input-field pl-11"
            placeholder="Tìm ảnh theo tiêu đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Các nút album — trượt ngang trên điện thoại */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {(['all', ...albums.map((a) => a.id)] as string[]).map((albumId) => {
            const label = albumId === 'all' ? 'Tất cả album' : albums.find((a) => a.id === albumId)?.name ?? '';
            const active = selectedAlbum === albumId;
            return (
              <button
                key={albumId}
                onClick={() => setSelectedAlbum(albumId)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  active
                    ? 'bg-geoenv-600 text-white shadow-[0_4px_14px_rgba(30,95,196,0.35)]'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-geoenv-300 hover:text-geoenv-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <ImageIcon className="h-3.5 w-3.5" />
          {loading
            ? 'Đang tải ảnh...'
            : photos.length > 0
              ? `${photos.length} ảnh${currentAlbum ? ` — album ${currentAlbum.name}` : ''}`
              : 'Không có ảnh phù hợp'}
        </p>
      </div>

      {/* Lưới ảnh */}
      {loading ? (
        <div className="card mt-6 py-14 text-center sm:py-20">
          <p className="text-base font-semibold text-slate-900 sm:text-lg">Đang tải ảnh...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="card mt-6 py-14 text-center sm:py-20">
          <Camera className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <p className="text-base font-semibold text-slate-900 sm:text-lg">
            {search ? 'Không tìm thấy ảnh phù hợp' : 'Chưa có ảnh trong album này'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ban tổ chức sẽ cập nhật ảnh sau sự kiện — bạn quay lại sau nhé!
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-geoenv-500"
              onClick={() => openViewer(index)}
              aria-label={`Mở ảnh: ${photo.title}`}
            >
              <img
                src={photo.thumbnail_url || photo.url}
                alt={photo.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/35">
                <span className="flex h-9 w-9 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                  <Search className="h-4 w-4 text-white" />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ✏️ Chú thích cuối trang — sửa chữ tại đây */}
      <p className="mt-8 text-center text-xs text-slate-500 sm:text-sm">
        Ban tổ chức GEOENV RUN 2026 chụp lại toàn bộ khoảnh khắc. Ảnh sẽ được cập nhật dần sau sự kiện.
      </p>

      {/* ===== TRÌNH XEM ẢNH (lightbox) — nền đen chuẩn xa rong Ảnh ===== */}
      {viewerOpen && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 backdrop-blur-sm sm:p-6"
          onClick={closeViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Trình xem ảnh"
        >
          <button
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            className="absolute left-3 top-3 z-10 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/25 sm:left-5 sm:top-5"
            aria-label="Đóng trình xem ảnh"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <span className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white sm:right-5 sm:top-5 sm:text-sm">
            {currentIndex + 1} / {photos.length}
          </span>

          <div
            className="relative flex max-h-full max-w-4xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={prevPhoto}
              className="absolute left-0 top-1/2 z-20 -translate-y-1/2 translate-x-2 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/25 hover:translate-x-0"
              aria-label="Ảnh trước"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-0 top-1/2 z-20 -translate-y-1/2 -translate-x-2 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/25 hover:translate-x-0"
              aria-label="Ảnh sau"
            >
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <img
              src={photos[currentIndex].thumbnail_url || photos[currentIndex].url}
              alt={photos[currentIndex].title}
              className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            <div className="mt-4 text-center">
              <h3 className="text-sm font-semibold text-white sm:text-base">
                {photos[currentIndex].title}
              </h3>
              {photos[currentIndex].description && (
                <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                  {photos[currentIndex].description}
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => downloadPhoto(photos[currentIndex])}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              >
                <Download className="h-4 w-4" /> Tải ảnh
              </button>
            </div>

            <p className="mt-2 hidden text-[11px] text-white/40 sm:block">
              Dùng ← → để đổi ảnh • ESC để thoát
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
