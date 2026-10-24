import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Upload,
  AlertTriangle,
  Trash2,
  Check,
  Link2,
  Loader2,
  Lock,
  LockOpen,
} from 'lucide-react';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface CertificateRow {
  id: string;
  full_name: string;
  class_name: string;
  is_eligible: boolean;
  created_at: string;
  /* Lý do khóa — cần cột violation_reason trong bảng Supabase (xem banner hướng dẫn) */
  violation_reason?: string | null;
  certificate_url?: string | null;
}

interface ParsedRow {
  fullName: string;
  className: string;
  alreadyExists: boolean;
}

const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
const clean = (t: string) => t.trim().replace(/\s+/g, ' ');

/* Đọc CSV — xử lý ô có dấu ngoặc kép, dấu phẩy trong ô, BOM, xuống dòng CRLF */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const NAME_HEADERS = ['họ tên', 'họ và tên', 'tên', 'full_name', 'fullname', 'họ tên sv', 'sinh viên'];
const CLASS_HEADERS = ['lớp', 'class_name', 'classname', 'lớp học'];

/* Tìm dòng tiêu đề và vị trí cột Họ tên / Lớp; không thấy thì coi mọi dòng là dữ liệu */
function extractRows(raw: string[][]): { fullName: string; className: string }[] {
  let nameCol = 0;
  let classCol = 1;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const cells = raw[i].map((c) => norm(c));
    const ni = cells.findIndex((c) => NAME_HEADERS.includes(c));
    const ci = cells.findIndex((c) => CLASS_HEADERS.includes(c));
    if (ni >= 0 && ci >= 0) {
      nameCol = ni;
      classCol = ci;
      start = i + 1;
      break;
    }
    /* Dự phòng: tiêu đề kiểu "Họ tên sinh viên", "Tên lớp"... — nhận theo từ khóa chứa */
    const ni2 = cells.findIndex((c) => c.includes('tên') && !c.includes('lớp'));
    const ci2 = cells.findIndex((c, idx) => idx !== ni2 && c.includes('lớp'));
    if (ni2 >= 0 && ci2 >= 0) {
      nameCol = ni2;
      classCol = ci2;
      start = i + 1;
      break;
    }
  }
  const out: { fullName: string; className: string }[] = [];
  for (let i = start; i < raw.length; i++) {
    const fullName = clean(raw[i][nameCol] ?? '');
    const className = clean(raw[i][classCol] ?? '');
    if (fullName && className) out.push({ fullName, className });
  }
  return out;
}

export function AdminCertificates() {
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  /* Nhập file */
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [importError, setImportError] = useState('');

  /* Khóa vi phạm */
  const [lockingRow, setLockingRow] = useState<CertificateRow | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [locking, setLocking] = useState(false);
  const [needsReasonColumn, setNeedsReasonColumn] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    setListError('');
    try {
      const { data, error } = await supabase
        .from('certificate_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setListError(
        e instanceof Error ? e.message : 'Không tải được danh sách. Kiểm tra lại quyền truy cập bảng.',
      );
    } finally {
      setLoading(false);
    }
  };

  /* Khóa chứng nhận vì vi phạm — 1 nút bấm là khóa tải ngay */
  const handleLock = async () => {
    if (!lockingRow) return;
    if (!lockReason.trim()) {
      alert('Vui lòng nhập lý do khóa để vận động viên biết vì sao bị khóa.');
      return;
    }
    setLocking(true);
    try {
      const { error } = await supabase
        .from('certificate_records')
        .update({ is_eligible: false, violation_reason: lockReason.trim() })
        .eq('id', lockingRow.id);

      if (error) {
        if (error.message.includes('violation_reason')) {
          /* Chưa có cột lý do: vẫn khóa được, chỉ chưa lưu được lý do */
          const { error: fallbackError } = await supabase
            .from('certificate_records')
            .update({ is_eligible: false })
            .eq('id', lockingRow.id);
          if (fallbackError) throw fallbackError;
          setNeedsReasonColumn(true);
        } else {
          throw error;
        }
      }
      setLockingRow(null);
      setLockReason('');
      await fetchCertificates();
    } catch {
      alert('Có lỗi xảy ra khi khóa chứng nhận.');
    } finally {
      setLocking(false);
    }
  };

  /* Mở khóa — trả lại quyền tải cho vận động viên */
  const handleUnlock = async (record: CertificateRow) => {
    if (!window.confirm(`Mở khóa chứng nhận cho ${record.full_name}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('certificate_records')
        .update({ is_eligible: true, violation_reason: null })
        .eq('id', record.id);
      if (error && error.message.includes('violation_reason')) {
        const { error: fallbackError } = await supabase
          .from('certificate_records')
          .update({ is_eligible: true })
          .eq('id', record.id);
        if (fallbackError) throw fallbackError;
      } else if (error) {
        throw error;
      }
      await fetchCertificates();
    } catch {
      alert('Có lỗi xảy ra khi mở khóa.');
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

  const handleFile = async (file: File) => {
    setImportError('');
    setImportResult('');
    try {
      let raw: string[][];
      if (/\.xlsx?$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
      } else if (/\.csv$/i.test(file.name)) {
        raw = parseCsv(await file.text());
      } else {
        setImportError('Chỉ hỗ trợ file .xlsx, .xls và .csv.');
        return;
      }
      const extracted = extractRows(raw);
      if (extracted.length === 0) {
        setImportError('Không đọc được dòng nào. Kiểm tra file có cột Họ tên và Lớp.');
        setParsed([]);
        return;
      }
      /* Loại trùng trong file + đánh dấu dòng đã có sẵn trong hệ thống */
      const seen = new Set<string>();
      const unique = extracted.filter((r) => {
        const k = `${norm(r.fullName)}|${norm(r.className)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const { data: existing } = await supabase
        .from('certificate_records')
        .select('full_name, class_name');
      const existingKeys = new Set(
        (existing || []).map((r) => `${norm(r.full_name)}|${norm(r.class_name)}`),
      );
      setParsed(
        unique.map((r) => ({
          ...r,
          alreadyExists: existingKeys.has(`${norm(r.fullName)}|${norm(r.className)}`),
        })),
      );
    } catch {
      setImportError('Đọc file thất bại. Thử lại với file .xlsx hoặc .csv khác.');
      setParsed([]);
    }
  };

  const handleImport = async () => {
    const fresh = parsed.filter((r) => !r.alreadyExists);
    if (fresh.length === 0) {
      setImportResult('Không có dòng mới để nhập (tất cả đã có sẵn).');
      return;
    }
    setImporting(true);
    setImportError('');
    setImportResult('');
    try {
      for (let i = 0; i < fresh.length; i += 100) {
        const batch = fresh.slice(i, i + 100).map((r) => ({
          full_name: r.fullName,
          class_name: r.className,
          is_eligible: true,
        }));
        const { error } = await supabase.from('certificate_records').insert(batch);
        if (error) throw error;
      }
      const skipped = parsed.length - fresh.length;
      setImportResult(
        `Đã nhập ${fresh.length} hồ sơ mới.${skipped > 0 ? ` Bỏ qua ${skipped} dòng đã có sẵn.` : ''}`,
      );
      setParsed([]);
      await fetchCertificates();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setImportError(
        /row-level security/i.test(msg)
          ? 'Nhập thất bại do bảng đang bật bảo mật dòng (RLS) mà chưa có policy cho phép ghi. Vào Supabase Dashboard → Table Editor → bảng certificate_records → Policies → tạo policy cho phép INSERT, UPDATE, DELETE với người dùng đã đăng nhập (authenticated), rồi thử nhập lại.'
          : msg
            ? `Nhập thất bại: ${msg}`
            : 'Nhập thất bại. Kiểm tra lại quyền ghi vào bảng certificate_records.',
      );
    } finally {
      setImporting(false);
    }
  };

  const visibleRows = rows.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.class_name.toLowerCase().includes(search.toLowerCase()),
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

      {/* Banner: chưa có cột lý do vi phạm */}
      {needsReasonColumn && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Chưa lưu được lý do khóa (vẫn khóa tải bình thường).</p>
          <p className="mt-1">
            Để lưu và hiển thị lý do vi phạm, chạy câu này 1 lần trong Supabase Dashboard → SQL
            Editor:
          </p>
          <code className="mt-2 block rounded-lg bg-white px-3 py-2 text-xs text-slate-800 ring-1 ring-amber-200">
            alter table public.certificate_records add column if not exists violation_reason text;
          </code>
        </div>
      )}

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

      {listError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{listError}</p>
        </div>
      )}

      {/* Bảng danh sách */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-geoenv-600" />
          <p className="text-sm">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
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
                      {row.is_eligible ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          <Check className="h-3 w-3" /> Đủ điều kiện
                        </span>
                      ) : (
                        <span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
                            <Lock className="h-3 w-3" /> Bị khóa
                          </span>
                          {row.violation_reason && (
                            <span className="mt-1 block max-w-[220px] text-xs leading-relaxed text-slate-500">
                              Lý do: {row.violation_reason}
                            </span>
                          )}
                        </span>
                      )}
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
                      <div className="flex flex-wrap gap-2">
                        {row.is_eligible ? (
                          <button
                            onClick={() => {
                              setLockingRow(row);
                              setLockReason('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50"
                          >
                            <Lock className="h-3.5 w-3.5" /> Đánh dấu vi phạm
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnlock(row)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50"
                          >
                            <LockOpen className="h-3.5 w-3.5" /> Mở khóa
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-slate-700">Chưa có dữ liệu chứng nhận</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Bấm "Nhập Excel" phía trên để nhập danh sách từ file.
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

      {/* Hộp khóa vi phạm */}
      {lockingRow && (
        <div className="card mt-6 border-red-200 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Lock className="h-5 w-5 text-red-600" /> Khóa chứng nhận — {lockingRow.full_name} •{' '}
            Lớp {lockingRow.class_name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Sau khi khóa, vận động viên này vào tra cứu sẽ thấy tải bị khóa kèm lý do bên dưới và
            email liên hệ BTC. Muốn mở lại thì bấm "Mở khóa" ở bảng.
          </p>
          <textarea
            className="input-field mt-4 min-h-[80px]"
            placeholder="VD: Chạy sai cự ly quy định, gian lận kết quả Strava..."
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleLock} disabled={locking}>
              {locking ? 'Đang khóa...' : 'Xác nhận khóa'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLockingRow(null);
                setLockReason('');
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}

      {/* Khung nhập từ Excel */}
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
          <div
            className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:border-geoenv-400 sm:p-8"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="mb-3 text-sm text-slate-500">
              Kéo thả file Excel/CSV vào đây hoặc bấm để chọn
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <Button variant="outline" className="w-full sm:w-auto">
              Chọn file
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Hỗ trợ file .xlsx, .xls và .csv. Các cột bắt buộc: Họ tên, Lớp. Dòng đã có sẵn trong
            hệ thống sẽ được bỏ qua, không nhập trùng.
          </p>

          {importError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{importError}</p>
            </div>
          )}
          {importResult && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {importResult}
            </div>
          )}

          {parsed.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Xem trước: {parsed.length} dòng (mới: {parsed.filter((r) => !r.alreadyExists).length}
                , đã có: {parsed.filter((r) => r.alreadyExists).length})
              </p>
              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5">Họ tên</th>
                      <th className="px-4 py-2.5">Lớp</th>
                      <th className="px-4 py-2.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">{r.fullName}</td>
                        <td className="px-4 py-2 text-slate-600">{r.className}</td>
                        <td className="px-4 py-2">
                          {r.alreadyExists ? (
                            <span className="text-xs text-slate-400">Đã có — sẽ bỏ qua</span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-700">Mới</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 50 && (
                  <p className="px-4 py-2 text-xs text-slate-500">
                    ... và {parsed.length - 50} dòng nữa.
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                className="mt-4"
                onClick={handleImport}
                disabled={importing}
              >
                {importing
                  ? 'Đang nhập...'
                  : `Nhập ${parsed.filter((r) => !r.alreadyExists).length} hồ sơ mới vào hệ thống`}
              </Button>
            </div>
          )}
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
