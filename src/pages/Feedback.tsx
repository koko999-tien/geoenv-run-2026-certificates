import { useState } from 'react';
import { Inbox, Send, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ✏️ Các loại phản ánh — sửa/thêm tại đây (nhớ sửa cùng lúc ở file SQL nếu đổi tên) */
const CATEGORIES = ['Góp ý tổ chức', 'Phản ánh vi phạm', 'Sự cố cần hỗ trợ', 'Khác'];

/* Lấy câu báo lỗi đọc được từ Supabase (lỗi Supabase là object thường, không phải Error) */
const supaMsg = (e: unknown): string =>
  (e as { message?: string })?.message ?? 'Có lỗi xảy ra.';

/* Hòm thư góp ý & phản ánh — trang công khai, KHÔNG bị khóa chung với tra cứu/thư
   viện ảnh: trong lúc diễn ra giải, các bạn vẫn cần gửi được góp ý và phản ánh. */
export function Feedback() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [className, setClassName] = useState('');
  const [bibNumber, setBibNumber] = useState('');
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung góp ý hoặc phản ánh.');
      return;
    }
    setSending(true);
    const { error: supabaseError } = await supabase.from('feedback_reports').insert({
      category,
      name: name.trim() || null,
      team: team.trim() || null,
      class_name: className.trim() || null,
      bib_number: bibNumber.trim() || null,
      contact: contact.trim() || null,
      content: content.trim(),
    });
    setSending(false);
    if (supabaseError) {
      setError(
        `Không gửi được: ${supaMsg(supabaseError)} Nếu lỗi còn tiếp diễn, vui lòng liên hệ trực tiếp Ban tổ chức.`,
      );
      return;
    }
    setSent(true);
  };

  const resetForm = () => {
    setCategory(CATEGORIES[0]);
    setName('');
    setTeam('');
    setClassName('');
    setBibNumber('');
    setContact('');
    setContent('');
    setSent(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Tiêu đề trang */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-geoenv-50 px-3 py-1 text-xs font-semibold text-geoenv-700 ring-1 ring-geoenv-100">
          <Inbox className="h-3.5 w-3.5" />
          Hòm thư Ban tổ chức
        </span>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Góp ý &amp; phản ánh</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Trong lúc tham gia giải chạy, bạn có góp ý cho Ban tổ chức hoặc phát hiện điều chưa
          đúng (ví dụ chạy sai đường, gian lận, sự cố trên đường chạy) thì gửi vào đây nhé.
        </p>
      </div>

      {/* Cam kết riêng tư — quan trọng để các bạn dám tố cáo */}
      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-geoenv-100 bg-geoenv-50/70 p-4 text-sm leading-relaxed text-slate-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-geoenv-600" />
        <span>
          Nội dung bạn gửi <strong className="text-slate-900">chỉ Ban tổ chức xem được</strong>,
          không hiển thị công khai. Bạn có thể gửi ẩn danh bằng cách bỏ trống họ tên.
        </span>
      </div>

      {sent ? (
        <div className="card mt-6 p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Đã gửi thành công, cảm ơn bạn!</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
            Ban tổ chức đã nhận được phản ánh của bạn và sẽ xem xét trong thời gian sớm nhất.
            Nếu cần hỗ trợ gấp trên đường chạy, hãy liên hệ trực tiếp người của Ban tổ chức gần
            nhất.
          </p>
          <button onClick={resetForm} className="btn-outline mt-5">
            Gửi thêm phản ánh khác
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-5 sm:p-6">
          <div>
            <label htmlFor="fb-category" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Loại phản ánh <span className="text-red-500">*</span>
            </label>
            <select
              id="fb-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fb-name" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Họ tên <span className="whitespace-nowrap font-normal text-slate-500">(không bắt buộc)</span>
            </label>
            <input
              id="fb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Để trống nếu muốn ẩn danh"
              className="input-field"
            />
          </div>

          {/* Thông tin người gửi — cả 3 đều không bắt buộc */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="fb-team" className="mb-1.5 block text-sm font-semibold text-slate-900">
                Đội <span className="whitespace-nowrap font-normal text-slate-500">(không bắt buộc)</span>
              </label>
              <input
                id="fb-team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Ví dụ: Rùa Bò"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="fb-class" className="mb-1.5 block text-sm font-semibold text-slate-900">
                Lớp <span className="whitespace-nowrap font-normal text-slate-500">(không bắt buộc)</span>
              </label>
              <input
                id="fb-class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ví dụ: QLTNMT K71A"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="fb-bib" className="mb-1.5 block text-sm font-semibold text-slate-900">
                Số BIB của bạn <span className="whitespace-nowrap font-normal text-slate-500">(không bắt buộc)</span>
              </label>
              <input
                id="fb-bib"
                value={bibNumber}
                onChange={(e) => setBibNumber(e.target.value)}
                placeholder="Ví dụ: 42-03"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="fb-content" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Nội dung <span className="text-red-500">*</span>
            </label>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Mô tả rõ sự việc: xảy ra ở đâu, lúc nào, số BIB / đội của người liên quan (nếu biết)..."
              className="input-field resize-y"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{content.length}/1000 ký tự</p>
          </div>

          <div>
            <label htmlFor="fb-contact" className="mb-1.5 block text-sm font-semibold text-slate-900">
              SĐT hoặc email liên hệ <span className="whitespace-nowrap font-normal text-slate-500">(không bắt buộc)</span>
            </label>
            <input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Để BTC liên hệ lại khi cần xác minh"
              className="input-field"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={sending} className="btn-primary w-full">
            <Send className="h-4 w-4" />
            {sending ? 'Đang gửi...' : 'Gửi phản ánh'}
          </button>
        </form>
      )}
    </div>
  );
}
