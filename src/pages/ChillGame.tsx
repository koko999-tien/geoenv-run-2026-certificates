import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, ArrowRight, RotateCcw, Trophy, Check, X } from 'lucide-react';

/* Mini game đố vui về GEOENV RUN — chạy hoàn toàn trên trình duyệt, không cần
   đăng nhập, không tính giờ, không lưu điểm lên máy chủ. */
interface Question {
  q: string;
  options: string[];
  answer: number;
}

const QUESTIONS: Question[] = [
  {
    q: 'GEOENV RUN SEASON 2 có bao nhiêu đội thi đấu?',
    options: ['81 đội', '85 đội', '100 đội', '60 đội'],
    answer: 1,
  },
  {
    q: 'Thể thức Ekiden của giải là gì?',
    options: [
      '4 người/đội, mỗi người 2,5km',
      '5 người/đội, mỗi người 2km',
      '10 người/đội, mỗi người 1km',
      '2 người/đội, mỗi người 5km',
    ],
    answer: 1,
  },
  {
    q: 'Đội nào đoạt giải Nhất chung cuộc?',
    options: ['Pò Fēng Zhě', 'Humg Basketball Club - HBC', 'SIÊU LỐP', 'Gà Bay Vịt Chạy'],
    answer: 2,
  },
  {
    q: 'Đội nào đoạt giải Nhì chung cuộc?',
    options: ['SIÊU LỐP', 'Pò Fēng Zhě', 'Humg Basketball Club - HBC', 'SKIN WALKER'],
    answer: 1,
  },
  {
    q: 'Đội nào đoạt giải Ba chung cuộc?',
    options: ['SIÊU LỐP', 'Pò Fēng Zhě', 'Humg Basketball Club - HBC', 'Gà Bay Vịt Chạy'],
    answer: 2,
  },
  {
    q: 'VĐV nam xuất sắc nhất là ai?',
    options: ['Trần Khánh Nam', 'Lê Công Cường', 'Nguyễn Tiến Đạt', 'Nguyễn Hữu Linh'],
    answer: 2,
  },
  {
    q: 'VĐV nữ xuất sắc nhất là ai?',
    options: ['Nguyễn Hiền Trang', 'Ngô Phương Chiển', 'Đỗ Thị Thuỳ Dung', 'Nguyễn Thị Hường'],
    answer: 1,
  },
  {
    q: "Đội nào nhận giải 'Đội kiên cường nhất'?",
    options: ['SIÊU LỐP', 'Pò Fēng Zhě', 'Gà Bay Vịt Chạy', 'SKIN WALKER'],
    answer: 2,
  },
  {
    q: 'Đội SIÊU LỐP mang số báo danh đội là bao nhiêu?',
    options: ['Đội 60', 'Đội 06', 'Đội 10', 'Đội 24'],
    answer: 1,
  },
  {
    q: "Đội 'Gà Bay Vịt Chạy' mang số báo danh đội là bao nhiêu?",
    options: ['Đội 06', 'Đội 30', 'Đội 24', 'Đội 48'],
    answer: 2,
  },
  {
    q: 'Tiền thưởng của giải Nhất đồng đội là bao nhiêu?',
    options: ['500.000đ', '1.000.000đ', '1.500.000đ', '3.000.000đ'],
    answer: 2,
  },
  {
    q: "Cuộc thi 'Khoảnh khắc ấn tượng' tính điểm như thế nào?",
    options: [
      'Chia sẻ kèm hashtag 3 điểm, reaction 1 điểm',
      'Chia sẻ 1 điểm, reaction 3 điểm',
      'Mỗi tương tác 2 điểm',
      'Chỉ tính lượt chia sẻ',
    ],
    answer: 0,
  },
  {
    q: "Hạn cuối gửi ảnh dự thi 'Khoảnh khắc ấn tượng' là khi nào?",
    options: [
      'Trước 20h 25/10/2026',
      'Trước 20h 27/10/2026',
      'Trước 20h 28/10/2026',
      'Trước 20h 30/10/2026',
    ],
    answer: 1,
  },
  {
    q: 'Giải chạy hướng tới kỷ niệm bao nhiêu năm thành lập Trường ĐH Mỏ – Địa chất?',
    options: ['50 năm', '55 năm', '60 năm', '65 năm'],
    answer: 2,
  },
  {
    q: 'Giấy chứng nhận được làm cho bao nhiêu VĐV? (không tính các đội khách mời)',
    options: ['425 VĐV', '405 VĐV', '400 VĐV', '415 VĐV'],
    answer: 1,
  },
];

function resultMessage(score: number) {
  if (score === QUESTIONS.length) return 'Quá đỉnh! Bạn là fan cứng của GEOENV RUN rồi!';
  if (score >= 12) return 'Giỏi quá! Bạn nhớ giải chạy rất rõ.';
  if (score >= 8) return 'Khá ổn! Chơi lại một ván để lên điểm nhé.';
  return 'Mới làm quen với giải chạy thôi, chơi lại nào!';
}

export function ChillGame() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  const choose = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === current.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((v) => v + 1);
      setSelected(null);
    }
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <Trophy className="h-7 w-7 text-amber-600" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Kết quả của bạn</h1>
        <p className="mt-3 text-5xl font-black tabular-nums text-geoenv-700">
          {score}/{QUESTIONS.length}
        </p>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{resultMessage(score)}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={restart}
            className="flex items-center justify-center gap-2 rounded-xl bg-geoenv-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
          >
            <RotateCcw className="h-4 w-4" />
            Chơi lại
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-geoenv-300 hover:text-geoenv-700"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
          <Gamepad2 className="h-7 w-7 text-violet-600" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Góc chill — Mini game</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
          Bạn hiểu GEOENV RUN đến đâu? Trả lời 15 câu hỏi, có vài câu hóc búa đấy — không
          tính giờ, sai cũng không sao.
        </p>
      </div>

      <div className="card mt-8 p-5 sm:p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">
            Câu {index + 1}/{QUESTIONS.length}
          </span>
          <span className="font-semibold tabular-nums text-geoenv-700">{score} điểm</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-geoenv-500 transition-all"
            style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }}
          />
        </div>

        <h2 className="mt-5 text-lg font-bold leading-snug text-slate-900">{current.q}</h2>
        <div className="mt-4 space-y-2.5">
          {current.options.map((opt, i) => {
            const isCorrect = selected !== null && i === current.answer;
            const isWrongPick = selected === i && i !== current.answer;
            const isDimmed = selected !== null && !isCorrect && !isWrongPick;
            return (
              <button
                key={opt}
                onClick={() => choose(i)}
                disabled={selected !== null}
                className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                  isCorrect
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : isWrongPick
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : isDimmed
                        ? 'border-slate-200 bg-slate-50 text-slate-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-geoenv-300 hover:bg-geoenv-50'
                }`}
              >
                <span className="flex-1">{opt}</span>
                {isCorrect && <Check className="h-5 w-5 shrink-0" />}
                {isWrongPick && <X className="h-5 w-5 shrink-0" />}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-5">
            <p className="text-sm font-medium leading-relaxed text-slate-700">
              {selected === current.answer
                ? 'Chính xác! 🎉'
                : `Chưa đúng rồi — đáp án là: ${current.options[current.answer]}`}
            </p>
            <button
              onClick={next}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
            >
              {isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
