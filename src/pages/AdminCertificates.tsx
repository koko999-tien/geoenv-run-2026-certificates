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
/* Bỏ dấu tiếng Việt để tìm không dấu cũng ra (gõ "nguyen" vẫn thấy "Nguyễn") */
const strip = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

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

/* Lỗi Supabase là object thường (không phải instanceof Error) nên đọc message kiểu này */
const supaMsg = (e: unknown) =>
  (e as { message?: string } | null)?.message ?? 'Không rõ nguyên nhân';

/* Nhận diện dòng tiêu đề: trả về nhãn cột, các dòng dữ liệu và cột Họ tên/Lớp mặc định.
   BTC vẫn đổi lại được ở 2 ô chọn cột — vì tiêu đề file thực tế rất đa dạng.
   QUAN TRỌNG: "Tên đội" không bao giờ được nhận làm cột Họ tên (nó chứa chữ "tên"
   nên lần trước code nhận nhầm, nhập toàn tên đội vào cột họ tên). */
function detectColumns(raw: string[][]): {
  columns: string[];
  dataRows: string[][];
  nameCol: number;
  classCol: number;
  headerFound: boolean;
} {
  const finish = (i: number, ni: number, ci: number) => ({
    columns: raw[i].map((c, idx) => clean(c) || `Cột ${idx + 1}`),
    dataRows: raw.slice(i + 1),
    nameCol: ni,
    classCol: ci,
    headerFound: true,
  });
  for (let i = 0; i < raw.length; i++) {
    const cells = raw[i].map((c) => norm(c));
    /* Lượt 1: khớp chính xác cả 2 cột */
    const ni = cells.findIndex((c) => NAME_HEADERS.includes(c));
    const ci = cells.findIndex((c) => CLASS_HEADERS.includes(c));
    if (ni >= 0 && ci >= 0) return finish(i, ni, ci);
    /* Lượt 2: tên khớp chính xác hoặc chứa "họ tên"; lớp khớp chính xác hoặc chứa "lớp"
       ("Lớp (VD: ...)" rơi vào đây; "Tên đội" bị loại vì không chứa "họ tên") */
    const ni2 = cells.findIndex((c) => NAME_HEADERS.includes(c) || c.includes('họ tên'));
    const ci2 = cells.findIndex(
      (c, idx) => idx !== ni2 && (CLASS_HEADERS.includes(c) || c.includes('lớp')),
    );
    if (ni2 >= 0 && ci2 >= 0) return finish(i, ni2, ci2);
    /* Lượt 3: tên chứa "tên" nhưng KHÔNG phải "tên đội" và không phải cột lớp */
    const ni3 = cells.findIndex(
      (c) => c.includes('tên') && !c.includes('đội') && !c.includes('lớp'),
    );
    const ci3 = cells.findIndex((c, idx) => idx !== ni3 && c.includes('lớp'));
    if (ni3 >= 0 && ci3 >= 0) return finish(i, ni3, ci3);
  }
  const width = Math.max(0, ...raw.map((r) => r.length));
  return {
    columns: Array.from(
      { length: width },
      (_, idx) => `Cột ${idx + 1} (vd: ${clean(raw[0]?.[idx] ?? '')})`,
    ),
    dataRows: raw,
    nameCol: 0,
    classCol: 1,
    headerFound: false,
  };
}

export function AdminCertificates() {
  const [search, setSearch] = useState('');
  /* Mục riêng cho hồ sơ vi phạm — khỏi phải mò trong 400 dòng */
  const [view, setView] = useState<'all' | 'violations'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'hasLink' | 'noLink'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showImport, setShowImport] = useState(false);
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  /* Nhập file */
  const fileRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [nameCol, setNameCol] = useState(0);
  const [classCol, setClassCol] = useState(1);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [skipped, setSkipped] = useState<{ fullName: string; className: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [importError, setImportError] = useState('');

  /* Dựng lại bảng xem trước mỗi khi đổi cột Họ tên/Lớp */
  useEffect(() => {
    if (dataRows.length === 0) {
      setParsed([]);
      return;
    }
    let cancelled = false;
    const build = async () => {
      const extracted = dataRows
        .map((r) => ({ fullName: clean(r[nameCol] ?? ''), className: clean(r[classCol] ?? '') }))
        .filter((r) => r.fullName && r.className);
      /* Các dòng thiếu họ tên hoặc lớp sẽ bị bỏ qua — hiện rõ ra để BTC bổ sung sau */
      setSkipped(
        dataRows
          .map((r) => ({ fullName: clean(r[nameCol] ?? ''), className: clean(r[classCol] ?? '') }))
          .filter((r) => (r.fullName && !r.className) || (!r.fullName && r.className)),
      );
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
      if (cancelled) return;
      const existingKeys = new Set(
        (existing || []).map((r) => `${norm(r.full_name)}|${norm(r.class_name)}`),
      );
      setParsed(
        unique.map((r) => ({
          ...r,
          alreadyExists: existingKeys.has(`${norm(r.fullName)}|${norm(r.className)}`),
        })),
      );
    };
    build();
    return () => {
      cancelled = true;
    };
  }, [dataRows, nameCol, classCol]);

  /* Khóa vi phạm */
  const [lockingRow, setLockingRow] = useState<CertificateRow | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [locking, setLocking] = useState(false);
  const [needsReasonColumn, setNeedsReasonColumn] = useState(false);
  const lockBoxRef = useRef<HTMLDivElement>(null);

  /* Bảng có 402 dòng nên hộp khóa nằm tít cuối trang — bấm nút là tự cuộn tới hộp,
     không thì trông như bấm mà không có gì xảy ra */
  useEffect(() => {
    if (lockingRow) {
      lockBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [lockingRow]);

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
      setListError(`Không tải được danh sách: ${supaMsg(e)}`);
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
    } catch (e) {
      alert(`Có lỗi xảy ra khi khóa chứng nhận: ${supaMsg(e)}`);
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
    } catch (e) {
      alert(`Có lỗi xảy ra khi mở khóa: ${supaMsg(e)}`);
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
    } catch (e) {
      alert(`Có lỗi xảy ra khi xóa: ${supaMsg(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setImportError('');
    setImportResult('');
    setParsed([]);
    setDataRows([]);
    setColumns([]);
    try {
      let detected: ReturnType<typeof detectColumns> | null = null;
      if (/\.xlsx?$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        /* Quét mọi sheet, lấy sheet đầu tiên nhận diện được cột Họ tên/Lớp */
        for (const sheetName of wb.SheetNames) {
          const raw = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
            header: 1,
            defval: '',
          }) as string[][];
          const d = detectColumns(raw);
          if (d.headerFound) {
            detected = d;
            break;
          }
          if (!detected) detected = d;
        }
      } else if (/\.csv$/i.test(file.name)) {
        detected = detectColumns(parseCsv(await file.text()));
      } else {
        setImportError('Chỉ hỗ trợ file .xlsx, .xls và .csv.');
        return;
      }
      if (!detected) {
        setImportError('Không đọc được nội dung file.');
        return;
      }
      if (detected.dataRows.length === 0) {
        setImportError('File không có dòng dữ liệu nào.');
        return;
      }
      setColumns(detected.columns);
      setDataRows(detected.dataRows);
      setNameCol(detected.nameCol);
      setClassCol(detected.classCol);
    } catch (e) {
      setImportError(
        `Đọc file thất bại: ${supaMsg(e)}. Thử lại với file .xlsx, .xls hoặc .csv khác.`,
      );
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
      const skippedCount = parsed.length - fresh.length;
      setImportResult(
        `Đã nhập ${fresh.length} hồ sơ mới.${skippedCount > 0 ? ` Bỏ qua ${skippedCount} dòng đã có sẵn.` : ''}`,
      );
      setParsed([]);
      await fetchCertificates();
    } catch (e) {
      const msg = supaMsg(e);
      setImportError(
        /row-level security/i.test(msg)
          ? 'Nhập thất bại do bảng đang bật bảo mật dòng (RLS) mà chưa có policy cho phép ghi. Vào Supabase Dashboard → Table Editor → bảng certificate_records → Policies → tạo policy cho phép INSERT, UPDATE, DELETE với người dùng đã đăng nhập (authenticated), rồi thử nhập lại.'
          : /permission denied/i.test(msg)
            ? 'Nhập thất bại do tài khoản quản trị chưa được cấp quyền ghi vào bảng certificate_records. Vào Supabase Dashboard → SQL Editor, chạy: grant select, insert, update, delete on public.certificate_records to authenticated; — rồi bấm nhập lại (không cần chọn lại file).'
            : `Nhập thất bại: ${msg}`,
      );
    } finally {
      setImporting(false);
    }
  };

  /* Lọc theo ô tìm + trạng thái, rồi chia trang — bảng 400+ dòng không còn phải lướt hết */
  const visibleRows = rows.filter((r) => {
    const q = strip(search);
    const matchSearch =
      !q || strip(r.full_name).includes(q) || strip(r.class_name).includes(q);
    const matchView = view === 'violations' ? !r.is_eligible : true;
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'hasLink'
          ? !!r.certificate_url
          : !r.certificate_url;
    return matchSearch && matchView && matchStatus;
  });
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize);

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

      {/* Ô tìm kiếm + lọc trạng thái + cỡ trang */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input-field pl-11"
            placeholder="Tìm theo họ tên hoặc lớp (gõ không dấu cũng được)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Link ảnh: tất cả</option>
          <option value="hasLink">Link ảnh: đã có</option>
          <option value="noLink">Link ảnh: chưa có</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value={20}>20 / trang</option>
          <option value={50}>50 / trang</option>
          <option value={100}>100 / trang</option>
        </select>
      </div>

      {listError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{listError}</p>
        </div>
      )}

      {/* Mục Tất cả / Vi phạm — bấm là thấy ngay, khỏi lọc mò */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setView('all');
            setPage(1);
          }}
          className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors ${
            view === 'all'
              ? 'bg-slate-900 text-white ring-slate-900'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả hồ sơ ({rows.length})
        </button>
        <button
          onClick={() => {
            setView('violations');
            setPage(1);
          }}
          className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors ${
            view === 'violations'
              ? 'bg-red-600 text-white ring-red-600'
              : 'bg-white text-red-700 ring-red-200 hover:bg-red-50'
          }`}
        >
          Hồ sơ vi phạm ({rows.filter((r) => !r.is_eligible).length})
        </button>
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
                {pageRows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm text-slate-400">
                      {(safePage - 1) * pageSize + index + 1}
                    </td>
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
                      {view === 'violations' && !search
                        ? 'Chưa có hồ sơ vi phạm nào.'
                        : `Không tìm thấy kết quả khớp với "${search}"`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Phân trang */}
          {visibleRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
              <p className="text-xs text-slate-500">
                Hiển thị {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, visibleRows.length)} / {visibleRows.length} hồ sơ
                {visibleRows.length !== rows.length && ` (lọc từ ${rows.length})`}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40"
                >
                  Đầu
                </button>
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-2 text-xs font-medium text-slate-700">
                  Trang {safePage} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage === pageCount}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40"
                >
                  Sau
                </button>
                <button
                  onClick={() => setPage(pageCount)}
                  disabled={safePage === pageCount}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-slate-200 disabled:opacity-40"
                >
                  Cuối
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hộp khóa vi phạm */}
      {lockingRow && (
        <div ref={lockBoxRef} className="card mt-6 border-red-200 p-4 sm:p-6">
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
            Hỗ trợ file .xlsx, .xls và .csv. Sau khi chọn file, kiểm tra kỹ bảng xem trước rồi
            mới bấm nhập — dòng đã có sẵn trong hệ thống sẽ được bỏ qua, không nhập trùng.
          </p>

          {columns.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Cột Họ tên
                <select
                  value={nameCol}
                  onChange={(e) => setNameCol(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {columns.map((c, i) => (
                    <option key={i} value={i}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Cột Lớp
                <select
                  value={classCol}
                  onChange={(e) => setClassCol(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {columns.map((c, i) => (
                    <option key={i} value={i}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {columns.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              Nếu cột Họ tên trong bảng xem trước hiện ra số thứ tự hay tên đội thì tức là đang
              chọn sai cột — đổi lại ở 2 ô trên. File nhập phải là danh sách thành viên (Họ tên,
              Lớp từng vận động viên), không phải danh sách đội.
            </p>
          )}

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
              {skipped.length > 0 && (
                <p className="mb-2 text-xs text-amber-700">
                  Có {skipped.length} dòng thiếu họ tên hoặc lớp nên chưa nhập được:{' '}
                  {skipped
                    .slice(0, 20)
                    .map((r) => r.fullName || `(thiếu tên, lớp ${r.className})`)
                    .join(', ')}
                  {skipped.length > 20 ? ` và ${skipped.length - 20} dòng nữa` : ''} — BTC bổ sung
                  đủ thông tin rồi nhập lại, hoặc nhập tay sau.
                </p>
              )}
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
