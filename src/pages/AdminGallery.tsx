import { Image as ImageIcon, Upload, Camera, Info } from 'lucide-react';

/* ============================================================
   ✏️ DANH SÁCH ALBUM — hiện là giao diện mẫu.
   Khi có lưu trữ ảnh thật, album + số ảnh lấy từ dữ liệu thật.
   ============================================================ */
const ALBUMS = [
  { id: '1', name: 'Toàn cảnh sự kiện', count: 0 },
  { id: '2', name: 'Khai mạc và xuất phát', count: 0 },
  { id: '3', name: 'Trên đường chạy', count: 0 },
  { id: '4', name: 'Về đích', count: 0 },
  { id: '5', name: 'Khoảnh khắc tập thể', count: 0 },
];

export function AdminGallery() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Quản lý thư viện ảnh</h1>
          <p className="mt-1 text-sm text-slate-600">Tải lên, sắp xếp và quản lý ảnh sự kiện</p>
        </div>
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400"
          title="Sẽ mở khi lưu trữ ảnh thật được ghép vào"
        >
          <Upload className="h-4 w-4" /> Tải ảnh lên
        </button>
      </div>

      {/* Thông báo trạng thái — ✏️ xoá khi ghép lưu trữ ảnh thật */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <p>
          Trang hiện là giao diện mẫu. Khi ban tổ chức gửi link/source ảnh thật, khu này sẽ chỉnh sửa
          trực tiếp được (thêm album, gắn ảnh, xoá ảnh).
        </p>
      </div>

      {/* Danh sách album */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALBUMS.map((album) => (
          <div key={album.id} className="card flex flex-col overflow-hidden">
            <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-50">
              <Camera className="mb-2 h-9 w-9 text-slate-300" />
              <span className="absolute bottom-3 text-xs text-slate-400">Chưa có ảnh</span>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h4 className="font-semibold text-slate-900">{album.name}</h4>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {album.count} ảnh
                </span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50" disabled>
                  Thêm ảnh
                </button>
                <button className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50" disabled>
                  Đổi tên
                </button>
                <button className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50" disabled>
                  Xóa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hướng dẫn */}
      <div className="card mt-8 p-5 sm:p-6">
        <h3 className="mb-3 flex items-center gap-2.5 font-bold text-slate-900">
          <ImageIcon className="h-5 w-5 text-geoenv-600" /> Hướng dẫn tải ảnh
        </h3>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>• Chỉ tải ảnh đã được ban tổ chức duyệt chung.</li>
          <li>• Chỉ tải ảnh bản gốc đạt chất lượng, bản thu nhỏ tự tạo cho lưới hiển thị.</li>
          <li>• Không tạo ảnh giả để lấp đầy thư viện.</li>
          <li>• Không ghép ảnh với MSSV hoặc BIB (số BIB của vận động viên).</li>
        </ul>
      </div>
    </div>
  );
}
