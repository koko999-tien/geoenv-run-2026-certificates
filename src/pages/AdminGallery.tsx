import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Upload, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizeDriveLink, driveThumbnailUrl } from '../lib/drive';

interface AlbumRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface PhotoRow {
  id: string;
  album_id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

/* Supabase trả lỗi dạng object thường, không phải instanceof Error */
const supaMsg = (e: unknown): string =>
  (e as { message?: string } | null)?.message ?? 'Có lỗi xảy ra, thử lại nhé.';

const emptyForm = {
  link: '',
  title: '',
  albumId: '',
  newAlbumName: '',
  description: '',
};

export function AdminGallery() {
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteAlbumId, setConfirmDeleteAlbumId] = useState<string | null>(null);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    const [aRes, pRes] = await Promise.all([
      supabase.from('albums').select('*').order('created_at', { ascending: true }),
      supabase.from('photos').select('*').order('created_at', { ascending: false }),
    ]);
    if (aRes.error || pRes.error) {
      setLoadError(
        `Không tải được thư viện: ${supaMsg(aRes.error ?? pRes.error)}. Nếu bảng albums/photos chưa được tạo, chạy file SQL tạo bảng thư viện ảnh rồi tải lại trang.`,
      );
      setAlbums([]);
      setPhotos([]);
    } else {
      setAlbums((aRes.data ?? []) as AlbumRow[]);
      setPhotos((pRes.data ?? []) as PhotoRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mở form thêm ảnh, chọn sẵn album nếu bấm từ thẻ album */
  const openAddForm = (albumId?: string) => {
    setForm((f) => ({ ...f, albumId: albumId ?? f.albumId }));
    setShowAddForm(true);
    setFormError(null);
    setNotice(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    const link = normalizeDriveLink(form.link);
    if (!link) {
      setFormError('Dán link Drive của ảnh vào trước nhé.');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Nhập tiêu đề ảnh.');
      return;
    }
    setSaving(true);
    let albumId = form.albumId;
    if (albumId === 'new') {
      const name = form.newAlbumName.trim();
      if (!name) {
        setFormError('Nhập tên album mới.');
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from('albums').insert({ name }).select('id').single();
      if (error || !data) {
        setFormError(`Không tạo được album: ${supaMsg(error)}`);
        setSaving(false);
        return;
      }
      albumId = data.id;
    }
    if (!albumId) {
      setFormError('Chọn album cho ảnh.');
      setSaving(false);
      return;
    }
    /* Chống trùng link: cùng 1 link Drive thì chỉ thêm 1 lần */
    const { data: dup } = await supabase
      .from('photos')
      .select('id, title')
      .eq('url', link)
      .maybeSingle();
    if (dup) {
      setFormError(`Link này đã có trong thư viện rồi (ảnh "${dup.title}").`);
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('photos').insert({
      album_id: albumId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      url: link,
      thumbnail_url: driveThumbnailUrl(link),
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        setFormError('Link này đã có trong thư viện rồi.');
      } else {
        setFormError(`Không thêm được ảnh: ${supaMsg(error)}`);
      }
      setSaving(false);
      return;
    }
    setNotice('Đã thêm ảnh vào thư viện.');
    setForm({ ...emptyForm, albumId });
    setSaving(false);
    void loadAll();
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    const { error } = await supabase.from('albums').update({ name }).eq('id', id);
    if (error) {
      setLoadError(`Không đổi được tên: ${supaMsg(error)}`);
      return;
    }
    setRenamingId(null);
    void loadAll();
  };

  /* Xóa album: bấm 1 lần để xác nhận, bấm lần 2 mới xóa; album còn ảnh thì chặn */
  const handleDeleteAlbum = async (album: AlbumRow) => {
    if (confirmDeleteAlbumId !== album.id) {
      setConfirmDeleteAlbumId(album.id);
      return;
    }
    setConfirmDeleteAlbumId(null);
    const count = photos.filter((p) => p.album_id === album.id).length;
    if (count > 0) {
      setLoadError(`Album "${album.name}" còn ${count} ảnh, xóa hết ảnh trong album trước đã.`);
      return;
    }
    const { error } = await supabase.from('albums').delete().eq('id', album.id);
    if (error) {
      setLoadError(`Không xóa được album: ${supaMsg(error)}`);
      return;
    }
    setNotice(`Đã xóa album "${album.name}".`);
    void loadAll();
  };

  /* Xóa ảnh: bấm 1 lần để xác nhận, bấm lần 2 mới xóa */
  const handleDeletePhoto = async (photo: PhotoRow) => {
    if (confirmDeletePhotoId !== photo.id) {
      setConfirmDeletePhotoId(photo.id);
      return;
    }
    setConfirmDeletePhotoId(null);
    const { error } = await supabase.from('photos').delete().eq('id', photo.id);
    if (error) {
      setLoadError(`Không xóa được ảnh: ${supaMsg(error)}`);
      return;
    }
    setNotice(`Đã xóa ảnh "${photo.title}".`);
    void loadAll();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Quản lý thư viện ảnh</h1>
          <p className="mt-1 text-sm text-slate-600">
            Thêm ảnh bằng link Drive, sắp xếp và quản lý ảnh sự kiện
          </p>
        </div>
        <button
          onClick={() => openAddForm()}
          className="inline-flex items-center gap-2 rounded-xl bg-geoenv-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(30,95,196,0.5)] transition-all hover:bg-geoenv-700"
        >
          <Upload className="h-4 w-4" /> Thêm ảnh bằng link Drive
        </button>
      </div>

      {notice && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {loadError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải thư viện...</p>
      ) : (
        <>
          {/* Form thêm ảnh */}
          {showAddForm && (
            <div ref={formRef} className="card mb-6 p-5 sm:p-6">
              <h3 className="text-lg font-bold text-slate-900">Thêm ảnh mới</h3>
              <form onSubmit={handleAddPhoto} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="photoLink" className="block text-sm font-medium text-slate-700">
                    Link Drive của ảnh <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="photoLink"
                    type="text"
                    required
                    className="input-field mt-1"
                    value={form.link}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="photoTitle" className="block text-sm font-medium text-slate-700">
                    Tiêu đề ảnh <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="photoTitle"
                    type="text"
                    required
                    className="input-field mt-1"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="photoAlbum" className="block text-sm font-medium text-slate-700">
                    Album
                  </label>
                  <select
                    id="photoAlbum"
                    className="input-field mt-1"
                    value={form.albumId}
                    onChange={(e) => setForm({ ...form, albumId: e.target.value })}
                  >
                    <option value="">— Chọn album —</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    <option value="new">+ Tạo album mới...</option>
                  </select>
                </div>
                {form.albumId === 'new' && (
                  <div>
                    <label htmlFor="newAlbumName" className="block text-sm font-medium text-slate-700">
                      Tên album mới <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="newAlbumName"
                      type="text"
                      className="input-field mt-1"
                      value={form.newAlbumName}
                      onChange={(e) => setForm({ ...form, newAlbumName: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="photoDesc" className="block text-sm font-medium text-slate-700">
                    Mô tả <span className="font-normal text-slate-400">(không bắt buộc)</span>
                  </label>
                  <input
                    id="photoDesc"
                    type="text"
                    className="input-field mt-1"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-geoenv-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang thêm...' : 'Thêm ảnh vào thư viện'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Danh sách album */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => {
              const albumPhotos = photos.filter((p) => p.album_id === album.id);
              const cover = albumPhotos[0];
              const expanded = expandedAlbumId === album.id;
              return (
                <div key={album.id} className="card flex flex-col overflow-hidden">
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-50">
                    {cover ? (
                      <img
                        src={cover.thumbnail_url ?? cover.url}
                        alt={album.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="mb-2 h-9 w-9 text-slate-300" />
                        <span className="absolute bottom-3 text-xs text-slate-400">Chưa có ảnh</span>
                      </>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      {renamingId === album.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRename(album.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          autoFocus
                          className="input-field !py-2 text-sm"
                        />
                      ) : (
                        <h4 className="font-semibold text-slate-900">{album.name}</h4>
                      )}
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {albumPhotos.length} ảnh
                      </span>
                    </div>
                    {renamingId === album.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleRename(album.id)}
                          className="flex-1 rounded-lg bg-geoenv-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-geoenv-700"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openAddForm(album.id)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                        >
                          Thêm ảnh
                        </button>
                        <button
                          onClick={() => {
                            setRenamingId(album.id);
                            setRenameValue(album.name);
                          }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                        >
                          Đổi tên
                        </button>
                        <button
                          onClick={() => void handleDeleteAlbum(album)}
                          className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          {confirmDeleteAlbumId === album.id ? 'Chắc chắn xóa?' : 'Xóa'}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedAlbumId(expanded ? null : album.id)}
                      className="mt-3 w-full text-center text-xs font-medium text-geoenv-600 hover:text-geoenv-700"
                    >
                      {expanded
                        ? 'Ẩn ảnh trong album ▲'
                        : `Xem ảnh trong album (${albumPhotos.length}) ▼`}
                    </button>
                    {expanded && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {albumPhotos.length === 0 ? (
                          <p className="col-span-3 text-xs text-slate-400">
                            Album này chưa có ảnh.
                          </p>
                        ) : (
                          albumPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                            >
                              <img
                                src={photo.thumbnail_url ?? photo.url}
                                alt={photo.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              <button
                                onClick={() => void handleDeletePhoto(photo)}
                                title={`Xóa ảnh "${photo.title}"`}
                                className="absolute right-1 top-1 rounded-md bg-black/60 px-1.5 py-1 text-[11px] font-medium text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                {confirmDeletePhotoId === photo.id ? 'Chắc chắn?' : 'Xóa'}
                              </button>
                              <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-1 text-[11px] text-white">
                                {photo.title}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {albums.length === 0 && (
            <p className="text-sm text-slate-500">
              Chưa có album nào. Thêm ảnh đầu tiên để tạo album, hoặc chạy file SQL tạo bảng để có
              sẵn 5 album chính thức.
            </p>
          )}
        </>
      )}

      {/* Hướng dẫn */}
      <div className="card mt-8 p-5 sm:p-6">
        <h3 className="mb-3 flex items-center gap-2.5 font-bold text-slate-900">
          <ImageIcon className="h-5 w-5 text-geoenv-600" /> Hướng dẫn thêm ảnh
        </h3>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>• Chỉ thêm ảnh đã được ban tổ chức duyệt chung.</li>
          <li>• Dán link Drive của ảnh (mở quyền xem cho bất kỳ ai có link); ảnh hiển thị trực tiếp từ link, không tải file lên web.</li>
          <li>• Link nào trùng thì hệ thống không thêm 2 lần.</li>
          <li>• Không tạo ảnh giả để lấp đầy thư viện.</li>
          <li>• Không ghép ảnh với MSSV hoặc BIB (số BIB của vận động viên).</li>
        </ul>
      </div>
    </div>
  );
}
