import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, AlertCircle, CheckCircle, Search, Info, Lightbulb, Lock } from 'lucide-react';
import { Button } from '../components/Button';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { OFFICIAL_MAJORS } from '../data/majors';

interface SearchResult {
  found: boolean;
  unique: boolean;
  fullName: string | null;
  className: string | null;
  message: string;
  certificateUrl: string | null;
  /* Khóa tải do vi phạm — kèm lý do BTC ghi */
  locked: boolean;
  lockReason: string | null;
}

/* Bỏ dấu tiếng Việt để gõ không dấu cũng khớp ("nguyen" khớp "Nguyễn") */
const strip = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');

/* Viết tắt từ tên lớp đầy đủ: chữ cái đầu mỗi từ, giữ nguyên token có số (K71A),
   bỏ từ nối "và"/"của" — vd "Quản lý tài nguyên môi trường K71A" -> "qltnmtk71a" */
const acronym = (text: string) =>
  strip(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'va' && w !== 'cua')
    .map((w) => (/\d/.test(w) ? w : w[0]))
    .join('');

/* Kiểu viết tắt thứ 2 của trường (Tiến xác nhận): mã = tiền tố khoa + khóa/lớp.
   VD "DCMTQL69A" = tiền tố "DCMTQL" (Địa chất - Môi trường - Quản lý) + khóa "69A",
   tương đương lớp "Quản lý tài nguyên môi trường K69A". Mỗi khoa có tiền tố riêng
   nên bảng này chỉ thêm được khi có ví dụ xác nhận — không đoán mò. */
const PREFIX_ALIASES: { code: string; major: string }[] = [
  { code: 'dcmtql', major: 'quản lý tài nguyên môi trường' },
];

/* Khoá chuẩn hoá để so sánh tên ngành: bỏ dấu, bỏ từ nối "và"/"của", quy
   "lí"->"lý", "kĩ"->"kỹ" (cùng một từ viết khác nhau), "bds" = bất động sản */
const WORD_ALIASES: Record<string, string> = { bds: 'batdongsan' };
const majorKey = (text: string) =>
  strip(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'va' && w !== 'cua')
    .map((w) => WORD_ALIASES[w] ?? (w === 'li' ? 'ly' : w === 'ki' ? 'ky' : w))
    .join('');

/* Tách tên lớp thành (phần ngành, phần khóa). Token cuối bắt đầu bằng số hoặc
   "K"+số là khóa (K70D1, 70_02, 67-04A...); chữ cái lẻ cuối tên ngành là lớp con
   (A/B/C) hoặc tiền tố khóa viết tách ("K 71A") nên bỏ đi khi so ngành */
const splitClass = (text: string) => {
  const tokens = strip(text).split(' ').filter(Boolean);
  if (tokens.length > 1 && /^k?\d/i.test(tokens[tokens.length - 1])) {
    const cohort = tokens.pop()!;
    while (
      tokens.length > 1 &&
      (/^[a-z]$/.test(tokens[tokens.length - 1]) || /^[a-z]\d+$/.test(tokens[tokens.length - 1]))
    ) {
      tokens.pop();
    }
    const head = tokens.join(' ').replace(/\s*chat luong cao$/, '').trim();
    return { head, cohort };
  }
  const s = strip(text);
  const m = s.match(/^(.*?)(k?\d[\w-]*)$/);
  if (m) return { head: m[1].trim(), cohort: m[2] };
  return { head: s, cohort: '' };
};

/* "K69A" và "69A" coi là một; "70_02" và "70-02" coi là một */
const cohortKey = (cohort: string) => cohort.toLowerCase().replace(/^k/, '').replace(/[^a-z0-9]/g, '');

const OFFICIAL_BY_KEY = new Map(OFFICIAL_MAJORS.map((m) => [majorKey(m), m]));
const OFFICIAL_BY_ACRONYM = new Map(OFFICIAL_MAJORS.map((m) => [acronym(m), m]));

/* Quy tên lớp về (ngành chính thức, khóa): khớp tên đầy đủ, viết tắt chữ cái đầu
   (QLTNMT), hoặc tên dài hơn ngành chính thức (lấy ngành dài nhất là tiền tố).
   Mã kiểu khoa (DCCTCT...) không quy được — trả null, để lưới chọn lớp lo. */
const resolveMajor = (text: string) => {
  const { head, cohort } = splitClass(text);
  const key = majorKey(head);
  let major = OFFICIAL_BY_KEY.get(key) ?? OFFICIAL_BY_ACRONYM.get(key) ?? null;
  if (!major && key === 'dcmtql') major = 'Quản lý tài nguyên và môi trường';
  if (!major) {
    let best: string | null = null;
    for (const m of OFFICIAL_MAJORS) {
      const mk = majorKey(m);
      if (key.startsWith(mk) && (!best || mk.length > majorKey(best).length)) best = m;
    }
    major = best;
  }
  return major ? { major, cohort: cohortKey(cohort) } : null;
};

/* Khớp kiểu khoa: cùng khóa, một bên là tiền tố khoa, bên kia là tên ngành đầy đủ */
const prefixAliasMatches = (typed: string, stored: string) => {
  const t = splitClass(typed);
  const s = splitClass(stored);
  if (!t.cohort || cohortKey(t.cohort) !== cohortKey(s.cohort)) return false;
  return PREFIX_ALIASES.some(({ code, major }) => {
    const tk = majorKey(t.head);
    const sk = majorKey(s.head);
    const mk = majorKey(major);
    return (tk === code && mk === sk) || (mk === tk && sk === code);
  });
};

/* Lớp gõ vào khớp lớp đã lưu khi: giống nhau (không dấu), một bên là viết tắt
   chữ cái đầu của bên kia, khớp quy tắc tiền tố khoa, hoặc cùng quy về một
   ngành chính thức + cùng khóa — vd "QLTNMT K71A", "DCMTQL69A", "Quản lí tài
   nguyên môi trường K69A" đều khớp "Quản lý tài nguyên và môi trường K69A" */
const classMatches = (typed: string, stored: string) => {
  const a = strip(typed).replace(/\s+/g, '');
  const b = strip(stored).replace(/\s+/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  if (acronym(typed) === b || a === acronym(stored)) return true;
  if (prefixAliasMatches(typed, stored)) return true;
  const rt = resolveMajor(typed);
  const rs = resolveMajor(stored);
  return !!rt && !!rs && rt.major === rs.major && rt.cohort === rs.cohort;
};

interface Candidate {
  fullName: string;
  className: string;
}

export function CertificateLookup() {
  const [form, setForm] = useState({ fullName: '', className: '' });
  const [result, setResult] = useState<SearchResult | null>(null);
  /* Khi tên khớp mà lớp chưa khớp: cho VĐV chọn đúng lớp trong các lớp tìm thấy */
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candidateRows, setCandidateRows] = useState<Record<string, any>[] | null>(null);
  /* Tối ưu: tải danh sách 1 lần rồi giữ lại, tìm lại không gọi mạng nữa */
  const rowsCache = useRef<Record<string, any>[] | null>(null);
  /* Gợi ý lớp khi đang gõ: gõ vài chữ cái đầu là hiện các lớp trong dữ liệu */
  const [classSuggestOpen, setClassSuggestOpen] = useState(false);
  const [classSuggestItems, setClassSuggestItems] = useState<string[]>([]);
  const [classSuggestActive, setClassSuggestActive] = useState(0);
  /* Gợi ý tên VĐV khi đang gõ: chỉ cần gõ họ là hiện tên đầy đủ kèm lớp để phân biệt */
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [nameSuggestItems, setNameSuggestItems] = useState<Candidate[]>([]);
  const [nameSuggestActive, setNameSuggestActive] = useState(0);

  /* Tải danh sách (dùng chung bộ nhớ đệm với nút tìm) để gợi ý không cần bấm tìm */
  const ensureRows = async (): Promise<Record<string, any>[]> => {
    if (rowsCache.current) return rowsCache.current;
    const { data, error: supabaseError } = await supabase.from('certificate_records').select('*');
    if (supabaseError) throw supabaseError;
    rowsCache.current = data || [];
    return rowsCache.current;
  };

  /* Gợi ý lớp: gõ tên trước thì ưu tiên lớp của đúng người đó; chưa gõ tên thì gợi
     ý toàn bộ. Khớp khi chữ gõ là đầu của tên lớp (không dấu) hoặc đầu của dạng
     viết tắt — vd "Q" hiện QLTNMT..., Quản lý...; "QL" hiện QLTNMT..., Quản lý...
     nhưng không hiện Quản trị (viết tắt QTKD). Hiển thị đúng nguyên văn đã ghi. */
  const updateClassSuggestions = async (typed: string, name: string) => {
    const q = strip(typed).replace(/\s+/g, '');
    if (!q) {
      setClassSuggestItems([]);
      setClassSuggestOpen(false);
      return;
    }
    let all: Record<string, any>[];
    try {
      all = await ensureRows();
    } catch {
      setClassSuggestItems([]);
      setClassSuggestOpen(false);
      return;
    }
    const nameNorm = strip(name);
    const scoped = nameNorm ? all.filter((r) => strip(r.full_name) === nameNorm) : [];
    const pool = scoped.length > 0 ? scoped : all;
    const seen = new Set<string>();
    const items: string[] = [];
    for (const r of pool) {
      const cls = String(r.class_name ?? '');
      if (!cls) continue;
      const key = strip(cls);
      if (seen.has(key)) continue;
      const literal = key.replace(/\s+/g, '');
      if (literal.startsWith(q) || acronym(cls).startsWith(q)) {
        seen.add(key);
        items.push(cls);
      }
      if (items.length >= 8) break;
    }
    setClassSuggestItems(items);
    setClassSuggestActive(0);
    setClassSuggestOpen(items.length > 0);
  };

  const pickClassSuggestion = (cls: string) => {
    setForm((f) => ({ ...f, className: cls }));
    setClassSuggestOpen(false);
  };

  /* Gợi ý tên: khớp khi chữ gõ là đầu họ tên ("nguyen" -> Nguyễn...) hoặc bắt đầu
     từ đầu một chữ trong tên ("minh duc" -> Nguyễn Minh Đức). Gõ họ thì các tên
     họ đó lên trước; mỗi gợi ý kèm lớp để phân biệt các VĐV trùng tên. */
  const updateNameSuggestions = async (typed: string) => {
    const q = strip(typed);
    if (!q) {
      setNameSuggestItems([]);
      setNameSuggestOpen(false);
      return;
    }
    let all: Record<string, any>[];
    try {
      all = await ensureRows();
    } catch {
      setNameSuggestItems([]);
      setNameSuggestOpen(false);
      return;
    }
    const seen = new Set<string>();
    const prefix: Candidate[] = [];
    const word: Candidate[] = [];
    for (const r of all) {
      const fullName = String(r.full_name ?? '');
      const className = String(r.class_name ?? '');
      if (!fullName) continue;
      const key = `${strip(fullName)}|${strip(className)}`;
      if (seen.has(key)) continue;
      const nameNorm = strip(fullName);
      if (nameNorm.startsWith(q)) {
        seen.add(key);
        prefix.push({ fullName, className });
      } else if (nameNorm.includes(` ${q}`)) {
        seen.add(key);
        word.push({ fullName, className });
      }
    }
    const items = [...prefix, ...word].slice(0, 8);
    setNameSuggestItems(items);
    setNameSuggestActive(0);
    setNameSuggestOpen(items.length > 0);
  };

  /* Chọn 1 VĐV: điền cả tên và lớp của đúng người đó để bấm tìm là ra ngay */
  const pickNameSuggestion = (item: Candidate) => {
    setForm({ fullName: item.fullName, className: item.className });
    setNameSuggestOpen(false);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Kết quả cho 1 bản ghi: đủ điều kiện -> tải; bị khóa -> hiện lý do, không cho tải */
  const resolveRecord = (record: Record<string, any>): SearchResult => {
    /* ✏️ Link giấy chứng nhận là cột "certificate_url" trong bảng Supabase */
    const certUrl = record.certificate_url ?? null;
    if (!record.is_eligible) {
      return {
        found: true,
        unique: true,
        fullName: record.full_name,
        className: record.class_name,
        message: 'Giấy chứng nhận của bạn đã bị khóa.',
        certificateUrl: null,
        locked: true,
        lockReason: record.violation_reason ?? null,
      };
    }
    return {
      found: true,
      unique: true,
      fullName: record.full_name,
      className: record.class_name,
      message: 'Tìm thấy giấy chứng nhận của bạn rồi! 🎉',
      certificateUrl: certUrl,
      locked: false,
      lockReason: null,
    };
  };

  const notFoundResult = (): SearchResult => ({
    found: false,
    unique: false,
    fullName: null,
    className: null,
    message: 'Chúng tôi chưa tìm thấy giấy chứng nhận khớp với họ tên bạn nhập.',
    certificateUrl: null,
    locked: false,
    lockReason: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCandidates(null);
    setCandidateRows(null);
    setClassSuggestOpen(false);

    try {
      const nameNorm = strip(form.fullName);
      const classTyped = form.className.trim();

      if (!nameNorm) {
        setError('Vui lòng nhập họ tên.');
        setLoading(false);
        return;
      }

      /* Lấy toàn bộ bảng rồi khớp phía client — bảng chỉ vài trăm dòng nên vẫn nhẹ,
         đổi lại khớp được không dấu, viết đầy đủ/viết tắt và gợi ý lớp khi gõ lệch.
         Danh sách chỉ tải 1 lần rồi giữ trong bộ nhớ của trang. */
      let all: Record<string, any>[];
      if (rowsCache.current) {
        all = rowsCache.current;
      } else {
        const { data, error: supabaseError } = await supabase
          .from('certificate_records')
          .select('*');
        if (supabaseError) throw supabaseError;
        all = data || [];
        rowsCache.current = all;
      }

      const nameMatches = all.filter((r) => strip(r.full_name) === nameNorm);

      if (nameMatches.length === 0) {
        setResult(notFoundResult());
        setLoading(false);
        return;
      }

      /* Không gõ lớp: tên chỉ khớp 1 người thì hiện luôn, nhiều người thì cho chọn lớp */
      if (!classTyped) {
        if (nameMatches.length === 1) {
          setResult(resolveRecord(nameMatches[0]));
        } else {
          setCandidateRows(nameMatches);
          setCandidates(uniqueClasses(nameMatches));
          setResult({
            ...notFoundResult(),
            message:
              'Tìm thấy tên của bạn với nhiều lớp — chọn đúng lớp của bạn bên dưới nhé.',
          });
        }
        setLoading(false);
        return;
      }

      const exactMatches = nameMatches.filter((r) => classMatches(classTyped, r.class_name));

      if (exactMatches.length === 0) {
        /* Tên đúng mà lớp gõ lệch (đầy đủ/viết tắt/gõ sai): cho chọn trong các lớp đã lưu */
        setCandidateRows(nameMatches);
        setCandidates(uniqueClasses(nameMatches));
        setResult({
          ...notFoundResult(),
          message:
            'Tìm thấy tên của bạn nhưng lớp chưa khớp — chọn đúng lớp của bạn bên dưới nhé.',
        });
      } else if (exactMatches.length > 1) {
        setResult({
          found: true,
          unique: false,
          fullName: exactMatches[0].full_name,
          className: exactMatches[0].class_name,
          message:
            'Hệ thống thấy nhiều bản ghi trùng họ tên và lớp. Vui lòng liên hệ ban tổ chức để xác minh nhé.',
          certificateUrl: null,
          locked: false,
          lockReason: null,
        });
      } else {
        setResult(resolveRecord(exactMatches[0]));
      }
    } catch {
      setError('Có lỗi xảy ra khi tra cứu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  /* Các lớp khác nhau của cùng 1 tên (so theo dạng không dấu, giữ cách viết gốc) */
  const uniqueClasses = (rows: Record<string, any>[]): Candidate[] => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const r of rows) {
      const key = strip(r.class_name);
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ fullName: r.full_name, className: r.class_name });
      }
    }
    return out;
  };

  const handlePickCandidate = (c: Candidate) => {
    const rows = (candidateRows || []).filter((r) => strip(r.class_name) === strip(c.className));
    if (rows.length === 1) {
      setResult(resolveRecord(rows[0]));
      setCandidates(null);
    } else if (rows.length > 1) {
      setResult({
        found: true,
        unique: false,
        fullName: c.fullName,
        className: c.className,
        message:
          'Hệ thống thấy nhiều bản ghi trùng họ tên và lớp. Vui lòng liên hệ ban tổ chức để xác minh nhé.',
        certificateUrl: null,
        locked: false,
        lockReason: null,
      });
      setCandidates(null);
    }
  };

  /* Mở link giấy chứng nhận ở tab mới — tương thích mọi loại link */
  const handleOpenCertificate = () => {
    if (!result?.certificateUrl) return;
    window.open(result.certificateUrl, '_blank', 'noopener');
  };

  const notFoundTips = [
    'Gõ tên không cần dấu cũng được (ví dụ: "nguyen van a").',
    'Lớp nên gõ tên đầy đủ (ví dụ: "Quản lý tài nguyên và môi trường K71A").',
    'Nhập đúng họ tên đầy đủ như khi đăng ký (có chữ đệm).',
    'Vẫn không thấy? Liên hệ BTC qua thông tin ở cuối trang nhé.',
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      {/* Phần đầu — ✏️ sửa tiêu đề/mô tả tại đây */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-geoenv-600"
      >
        <span aria-hidden>←</span> Về trang chủ
      </Link>

      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-geoenv-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-geoenv-700 ring-1 ring-geoenv-100 sm:text-sm">
          🏅 Giấy chứng nhận
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          Tra cứu giấy chứng nhận
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Nhập <strong className="text-slate-900">họ tên</strong> để tìm và tải giấy chứng nhận
          tham gia GEOENV RUN 2026. Nên gõ tên lớp đầy đủ, ví dụ: Quản lý tài nguyên và môi
          trường K71A. Bỏ trống ô lớp cũng được.
        </p>
      </div>

      {/* Form tra cứu — thẻ trắng chuẩn học thuật */}
      <form
        onSubmit={handleSubmit}
        className="card mt-8 p-5 shadow-md sm:p-7"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative space-y-2">
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoFocus
              className="input-field"
              // ✏️ Sửa ví dụ gợi ý tại đây
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChange={(e) => {
                setForm({ ...form, fullName: e.target.value });
                void updateNameSuggestions(e.target.value);
              }}
              onFocus={() => {
                if (form.fullName) void updateNameSuggestions(form.fullName);
              }}
              onBlur={() => setNameSuggestOpen(false)}
              onKeyDown={(e) => {
                if (!nameSuggestOpen || nameSuggestItems.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setNameSuggestActive((a) => (a + 1) % nameSuggestItems.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setNameSuggestActive((a) => (a - 1 + nameSuggestItems.length) % nameSuggestItems.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  pickNameSuggestion(nameSuggestItems[nameSuggestActive]);
                } else if (e.key === 'Escape') {
                  setNameSuggestOpen(false);
                }
              }}
              autoComplete="off"
            />
            <p className="text-xs text-slate-400">Gõ họ (ví dụ: Nguyễn) để xem gợi ý tên VĐV.</p>
            {nameSuggestOpen && nameSuggestItems.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {nameSuggestItems.map((item, i) => (
                  <li key={`${item.fullName}|${item.className}`}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickNameSuggestion(item);
                      }}
                      onMouseEnter={() => setNameSuggestActive(i)}
                      className={cn(
                        'block w-full px-3 py-2 text-left',
                        i === nameSuggestActive ? 'bg-geoenv-50 text-geoenv-800' : 'hover:bg-geoenv-50',
                      )}
                    >
                      <span className="block text-sm font-medium text-slate-800">{item.fullName}</span>
                      {item.className && (
                        <span className="block text-xs text-slate-400">{item.className}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative space-y-2">
            <label htmlFor="className" className="block text-sm font-medium text-slate-700">
              Lớp <span className="font-normal text-slate-400">(có thể bỏ trống)</span>
            </label>
            <input
              id="className"
              type="text"
              className="input-field"
              // ✏️ Sửa ví dụ gợi ý tại đây
              placeholder="Quản lý tài nguyên và môi trường K71A"
              value={form.className}
              onChange={(e) => {
                setForm({ ...form, className: e.target.value });
                void updateClassSuggestions(e.target.value, form.fullName);
              }}
              onFocus={() => {
                if (form.className) void updateClassSuggestions(form.className, form.fullName);
              }}
              onBlur={() => setClassSuggestOpen(false)}
              onKeyDown={(e) => {
                if (!classSuggestOpen || classSuggestItems.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setClassSuggestActive((a) => (a + 1) % classSuggestItems.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setClassSuggestActive((a) => (a - 1 + classSuggestItems.length) % classSuggestItems.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  pickClassSuggestion(classSuggestItems[classSuggestActive]);
                } else if (e.key === 'Escape') {
                  setClassSuggestOpen(false);
                }
              }}
              autoComplete="off"
            />
            <p className="text-xs text-slate-400">Gõ vài chữ cái đầu để xem gợi ý lớp.</p>
            {classSuggestOpen && classSuggestItems.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {classSuggestItems.map((cls, i) => (
                  <li key={cls}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickClassSuggestion(cls);
                      }}
                      onMouseEnter={() => setClassSuggestActive(i)}
                      className={cn(
                        'block w-full px-3 py-2 text-left text-sm text-slate-700',
                        i === classSuggestActive ? 'bg-geoenv-50 text-geoenv-800' : 'hover:bg-geoenv-50',
                      )}
                    >
                      {cls}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button type="submit" variant="primary" className="mt-5 w-full text-base" disabled={loading}>
          {loading ? (
            <>
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Đang tìm kiếm...
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              Tìm giấy chứng nhận
            </>
          )}
        </Button>
      </form>

      {/* Báo lỗi hệ thống */}
      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Kết quả tra cứu */}
      {result && (
        <div
          className={cn(
            'mt-5 rounded-2xl border p-5',
            result.locked
              ? 'border-red-200 bg-red-50'
              : result.found && result.unique
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50',
          )}
        >
          <div className="flex items-start gap-3">
            {result.locked ? (
              <Lock className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            ) : result.found && result.unique ? (
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            ) : (
              <Info className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-base font-semibold sm:text-lg',
                  result.locked
                    ? 'text-red-800'
                    : result.found && result.unique
                      ? 'text-emerald-800'
                      : 'text-amber-800',
                )}
              >
                {result.message}
              </p>

              {(result.fullName || result.className) && (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-bold text-slate-900">{result.fullName}</span>
                  {result.className && <span> • Lớp {result.className}</span>}
                </p>
              )}

              {/* Bị khóa do vi phạm: không cho tải, hiện lý do + mail BTC */}
              {result.locked && (
                <div className="mt-4 space-y-2 rounded-xl border border-red-200 bg-white p-3 text-sm text-red-800">
                  <p>
                    <span className="font-semibold">Lý do: </span>
                    {result.lockReason ?? 'Vi phạm quy chế giải chạy.'}
                  </p>
                  <p>
                    Mọi thắc mắc vui lòng liên hệ Ban tổ chức qua email{' '}
                    <a
                      href="mailto:geoenvrun@gmail.com"
                      className="font-semibold underline hover:text-red-900"
                    >
                      geoenvrun@gmail.com
                    </a>
                    .
                  </p>
                </div>
              )}

              {/* Trạng thái đủ điều kiện — chỉ hiện khi không bị khóa */}
              {result.found && result.unique && !result.locked && (
                <div className="mt-4">
                  {result.certificateUrl ? (
                    <Button variant="primary" className="text-sm" onClick={handleOpenCertificate}>
                      <Download className="h-4 w-4" />
                      Tải giấy chứng nhận
                    </Button>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Giấy chứng nhận của bạn đã được lưu trong hệ thống. Ban tổ chức đang gắn
                        đường link file — bạn quay lại tra cứu sau ít phút nhé!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chọn lớp khi tên khớp mà lớp gõ chưa khớp */}
      {candidates && candidates.length > 0 && (
        <div className="card mt-4 p-5">
          <p className="text-sm font-semibold text-slate-900">
            Tìm thấy tên <span className="text-geoenv-700">{candidates[0].fullName}</span> với
            các lớp sau — bấm đúng lớp của bạn:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.className}
                type="button"
                onClick={() => handlePickCandidate(c)}
                className="rounded-full px-4 py-2 text-sm font-medium text-geoenv-700 ring-1 ring-geoenv-200 transition-colors hover:bg-geoenv-50"
              >
                Lớp {c.className}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gợi ý khi không tìm thấy */}
      {result && !result.found && (
        <div className="card mt-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lightbulb className="h-5 w-5 text-geoenv-600" />
            Gợi ý khi không tìm thấy:
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {notFoundTips.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-geoenv-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
