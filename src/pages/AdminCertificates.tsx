import { useState, useEffect } from 'react';
import { Search, Upload, AlertTriangle, Trash2, Check, X, Link2, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';

interface CertificateRow {
  id: string;
  full_name: string;
  class_name: string;
  is_eligible: boolean;
  created_at: string;
  /* ✏️ Link giấy chứng nhận từng người — BTC dán trong Supabase (Table Editor) */
  certificate_url?: string | null;
}

export function AdminCertificates() {
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('certificate_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch {
      // Bỏ qua lỗi, hiển thị danh sách trống
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEligible = async (record: CertificateRow) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('certificate_records')
        .update({ is_eligible: !record.is_eligible })
        .eq('id', record.id);

      if (error) throw error;
      await fetchCertificates();
    } catch {
      alert('Có lỗi xảy ra khi cập nhật trạng thái.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('certificate_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCertificates();
    } catch {
      alert('Có lỗi xảy ra khi xóa.');
    } finally {
      setLoading(false);
    }
  };

  const visibleRows = rows.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.class_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Quản lý chứng nhận</h1>
          <p className="mt-1 text-sm text-slate-600">Danh sách người nhận giấy chứng nhận</p>
        </div>
        <Button variant="primary" onClick={() => setShowImport(!showImport)} className="text-sm">
          <Upload className="h-4 w-4" /> Nhập Excel
        </Button>
      </div>

      {/* Ô tìm kiếm */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className="input-field pl-11"
          placeholder="Tìm theo họ tên hoặc lớp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Bảng danh sách */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-geoenv-600" />
          <p className="text-sm">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">STT</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Họ tên</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lớp</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Điều kiện</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Link GCN</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ngày tạo</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">{row.full_name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{row.class_name}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleEligible(row)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                          row.is_eligible
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                        }`}
                        title="Bấm để đổi trạng thái"
                      >
                        {row.is_eligible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {row.is_eligible ? 'Đủ điều kiện' : 'Chưa đủ'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {row.certificate_url ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-geoenv-50 px-2.5 py-1 text-xs font-medium text-geoenv-700 ring-1 ring-geoenv-200">
                          <Link2 className="h-3 w-3" /> Đã có
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(row.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-slate-700">Chưa có dữ liệu chứng nhận</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Bấm "Nhập Excel" phía trên, hoặc thêm trực tiếp trong Supabase (Table Editor).
                      </p>
                    </td>
                  </tr>
                )}
                {rows.length > 0 && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      Không tìm thấy kết quả khớp với "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Khung nhập từ Excel — ✏️ giao diện mẫu, ghép import thật ở bước sau */}
      {showImport && (
        <div className="card mt-8 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Nhập liệu từ Excel</h3>
            <button
              onClick={() => setShowImport(false)}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              ✕ Đóng
            </button>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:border-geoenv-400 sm:p-8">
            <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="mb-3 text-sm text-slate-500">Kéo thả file Excel vào đây hoặc bấm để chọn</p>
            <input type="file" accept=".xlsx,.csv" className="sr-only" />
            <Button variant="outline" className="w-full sm:w-auto">Chọn file</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Hỗ trợ file .xlsx và .csv. Các cột bắt buộc: Họ tên, Lớp.
          </p>
        </div>
      )}

      {/* Cảnh báo bảo mật */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Lưu ý bảo mật</p>
          <p className="mt-0.5 text-amber-700">
            Không nhập số điện thoại hay thông tin nhạy cảm. Link giấy chứng nhận dán vào cột{' '}
            <strong>certificate_url</strong> trong Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
