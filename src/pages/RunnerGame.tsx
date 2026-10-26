import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* Trò chơi chạy vô tận kiểu khủng long Chrome, nhân vật là vận động viên
   giải chạy: nhảy qua rào chắn, tảng đá, vũng nước; nhặt chai nước +50 điểm.
   Điểm vẽ trực tiếp lên canvas (không render lại React mỗi khung hình).
   BẢO MẬT: điểm chỉ lưu từ màn hình game over — điểm của ván vừa chơi,
   không có chỗ tự gõ điểm; trần 100000 điểm (bảng SQL cũng chặn). */

const W = 900;
const H = 300;
const GROUND = 256;
const RUNNER_X = 80;
const RUNNER_W = 34;
const RUNNER_H = 48;
const MAX_SCORE = 100000;
const BEST_KEY = 'geoenv-runner-best';
const NAME_KEY = 'geoenv-runner-name';
const TEAM_KEY = 'geoenv-runner-team';

type Phase = 'ready' | 'playing' | 'over';
type ObKind = 'hurdle' | 'rock' | 'puddle';

interface Obstacle {
  x: number;
  kind: ObKind;
}

interface Bottle {
  x: number;
  taken: boolean;
}

interface ScoreRow {
  id: number;
  player_name: string;
  team_name: string | null;
  score: number;
  created_at: string;
}

const OB_SIZE: Record<ObKind, { w: number; h: number }> = {
  hurdle: { w: 26, h: 32 },
  rock: { w: 34, h: 26 },
  puddle: { w: 44, h: 12 },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Vận động viên: chân tay đung đưa theo khung hình, trên không thì co chân. */
function drawRunner(
  ctx: CanvasRenderingContext2D,
  top: number,
  frame: number,
  airborne: boolean,
) {
  const hipY = top + 38;
  const swing = airborne ? 6 : Math.sin(frame * 0.4) * 11;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 16, hipY);
  ctx.lineTo(RUNNER_X + 16 + swing, top + 48);
  ctx.moveTo(RUNNER_X + 20, hipY);
  ctx.lineTo(RUNNER_X + 20 - swing, top + 48);
  ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(RUNNER_X + 12 + swing, top + 46, 10, 5);
  ctx.fillRect(RUNNER_X + 16 - swing, top + 46, 10, 5);
  ctx.fillStyle = '#1e5fc4';
  roundRect(ctx, RUNNER_X + 8, top + 16, 22, 24, 7);
  ctx.fill();
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 12, top + 20);
  ctx.lineTo(RUNNER_X + 12 - swing, top + 34);
  ctx.moveTo(RUNNER_X + 26, top + 20);
  ctx.lineTo(RUNNER_X + 26 + swing, top + 34);
  ctx.stroke();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(RUNNER_X + 19, top + 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(RUNNER_X + 10, top + 2, 18, 4);
}

function drawObstacle(ctx: CanvasRenderingContext2D, ob: Obstacle) {
  const { w, h } = OB_SIZE[ob.kind];
  const y = GROUND - h;
  if (ob.kind === 'hurdle') {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ob.x, y, 4, h);
    ctx.fillRect(ob.x + w - 4, y, 4, h);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(ob.x - 2, y, w + 4, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ob.x + 5, y, 6, 8);
    ctx.fillRect(ob.x + w - 11, y, 6, 8);
  } else if (ob.kind === 'rock') {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(ob.x, GROUND);
    ctx.lineTo(ob.x + 6, y + 6);
    ctx.lineTo(ob.x + 18, y);
    ctx.lineTo(ob.x + 30, y + 8);
    ctx.lineTo(ob.x + w, GROUND);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 4, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBottle(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = '#0ea5e9';
  roundRect(ctx, x, GROUND - 26, 14, 22, 3);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x + 4, GROUND - 31, 6, 5);
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [finalScore, setFinalScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [scoresError, setScoresError] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [teamInput, setTeamInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* Trạng thái game trong ref — vòng lặp vẽ đọc/ghi trực tiếp, không qua React. */
  const g = useRef({
    y: GROUND - RUNNER_H,
    vy: 0,
    airborne: false,
    frame: 0,
    speed: 6,
    score: 0,
    distance: 0,
    lastObDist: 0,
    nextGap: 500,
    lastBottleDist: 0,
    nextBottleGap: 900,
    obstacles: [] as Obstacle[],
    bottles: [] as Bottle[],
  });
  const phaseRef = useRef<Phase>('ready');

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const resetGame = () => {
    g.current = {
      y: GROUND - RUNNER_H,
      vy: 0,
      airborne: false,
      frame: 0,
      speed: 6,
      score: 0,
      distance: 0,
      lastObDist: 0,
      nextGap: 500,
      lastBottleDist: 0,
      nextBottleGap: 900,
      obstacles: [],
      bottles: [],
    };
  };

  const startGame = () => {
    resetGame();
    setSaved(false);
    setSaveError(null);
    setIsNewBest(false);
    setPhaseBoth('playing');
  };

  const gameOver = useCallback(() => {
    const score = Math.floor(g.current.score);
    setFinalScore(score);
    setPhaseBoth('over');
    setBest((prev) => {
      if (score > prev) {
        localStorage.setItem(BEST_KEY, String(score));
        setIsNewBest(true);
        return score;
      }
      return prev;
    });
  }, []);

  const jump = useCallback(() => {
    if (phaseRef.current === 'ready') {
      startGame();
      return;
    }
    if (phaseRef.current !== 'playing') return;
    const s = g.current;
    if (!s.airborne) {
      s.airborne = true;
      s.vy = -16.5;
    }
  }, []);

  /* Vòng lặp vẽ: nền, núi, mặt đường, vận động viên, chướng ngại, chai nước. */
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const s = g.current;
        if (phaseRef.current === 'playing') {
          s.frame++;
          if (s.airborne) {
            s.vy += 0.9;
            s.y += s.vy;
            if (s.y >= GROUND - RUNNER_H) {
              s.y = GROUND - RUNNER_H;
              s.airborne = false;
              s.vy = 0;
            }
          }
          s.speed = Math.min(6 + s.score * 0.002, 13);
          s.score += s.speed * 0.22;
          s.distance += s.speed;
          if (s.distance - s.lastObDist > s.nextGap) {
            const kinds: ObKind[] = ['hurdle', 'rock', 'puddle'];
            s.obstacles.push({ x: W + 20, kind: kinds[Math.floor(Math.random() * kinds.length)] });
            s.lastObDist = s.distance;
            s.nextGap = 340 + Math.random() * 280;
          }
          if (s.distance - s.lastBottleDist > s.nextBottleGap) {
            s.bottles.push({ x: W + 20, taken: false });
            s.lastBottleDist = s.distance;
            s.nextBottleGap = 800 + Math.random() * 700;
          }
          for (const ob of s.obstacles) ob.x -= s.speed;
          for (const b of s.bottles) b.x -= s.speed;
          s.obstacles = s.obstacles.filter((o) => o.x + 60 > 0);
          s.bottles = s.bottles.filter((b) => b.x + 30 > 0 && !b.taken);
          const runnerBox = { x: RUNNER_X + 6, y: s.y + 4, w: RUNNER_W - 12, h: RUNNER_H - 6 };
          let hit = false;
          for (const ob of s.obstacles) {
            const sz = OB_SIZE[ob.kind];
            if (overlaps(runnerBox, { x: ob.x + 2, y: GROUND - sz.h, w: sz.w - 4, h: sz.h })) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const b of s.bottles) {
              if (!b.taken && overlaps(runnerBox, { x: b.x, y: GROUND - 31, w: 14, h: 31 })) {
                b.taken = true;
                s.score += 50;
              }
            }
          }
          if (hit) gameOver();
        }

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#eaf6ff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#bbf7d0';
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        ctx.lineTo(180, GROUND - 90);
        ctx.lineTo(360, GROUND);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(520, GROUND);
        ctx.lineTo(680, GROUND - 70);
        ctx.lineTo(840, GROUND);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#dcfce7';
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(0, GROUND, W, 2);
        ctx.fillStyle = '#86efac';
        const dashOff = s.distance % 180;
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(i * 180 - dashOff, GROUND + 24, 60, 3);
        }
        for (const b of s.bottles) drawBottle(ctx, b.x);
        for (const ob of s.obstacles) drawObstacle(ctx, ob);
        drawRunner(ctx, s.y, s.frame, s.airborne);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Điểm: ${Math.floor(s.score)}`, W - 16, 32);
        if (phaseRef.current === 'ready') {
          ctx.textAlign = 'center';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText('Nhấn để bắt đầu chạy!', W / 2, 100);
          ctx.font = '18px sans-serif';
          ctx.fillText('Phím cách hoặc chạm vào khung game để nhảy', W / 2, 132);
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [gameOver]);

  /* Phím cách / mũi tên lên để nhảy — chặn cuộn trang khi bấm phím cách. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  /* Kỷ lục cá nhân + tên đã lưu trên máy này. */
  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_KEY) ?? 0);
    if (!Number.isNaN(stored)) setBest(stored);
    setNameInput(localStorage.getItem(NAME_KEY) ?? '');
    setTeamInput(localStorage.getItem(TEAM_KEY) ?? '');
  }, []);

  const loadScores = useCallback(async () => {
    const { data, error } = await supabase
      .from('game_scores')
      .select('id, player_name, team_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);
    if (error) {
      setScoresError(true);
      return;
    }
    setScoresError(false);
    setScores((data ?? []) as ScoreRow[]);
  }, []);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const saveScore = async () => {
    const name = nameInput.trim();
    if (!name) {
      setSaveError('Nhập tên để lưu điểm.');
      return;
    }
    if (finalScore > MAX_SCORE) {
      setSaveError('Điểm vượt giới hạn, không lưu được.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('game_scores').insert({
      player_name: name.slice(0, 30),
      team_name: teamInput.trim() ? teamInput.trim().slice(0, 30) : null,
      score: finalScore,
    });
    setSaving(false);
    if (error) {
      setSaveError('Không lưu được điểm, thử lại sau.');
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(TEAM_KEY, teamInput.trim());
    setSaved(true);
    void loadScores();
  };

  return (
    <div>
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={jump}
          className="block h-auto w-full cursor-pointer touch-manipulation"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={startGame}
          className="flex items-center gap-2 rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
        >
          {phase === 'ready' ? <Play className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          {phase === 'ready' ? 'Bắt đầu chạy' : 'Chơi lại'}
        </button>
        <p className="text-sm text-slate-600">
          Phím cách hoặc chạm vào khung game để nhảy · Nhặt chai nước +50 điểm
          {best > 0 && (
            <>
              {' · '}
              <span className="font-semibold tabular-nums text-slate-900">Kỷ lục của bạn: {best}</span>
            </>
          )}
        </p>
      </div>

      {phase === 'over' && (
        <div className="card mt-5 p-5 text-center sm:p-6">
          <p className="text-lg font-bold text-slate-900">Vấp rồi!</p>
          <p className="mt-1 text-5xl font-black tabular-nums text-geoenv-700">{finalScore}</p>
          {isNewBest && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              <Trophy className="h-3.5 w-3.5" /> Kỷ lục mới của bạn!
            </p>
          )}
          {finalScore > 0 && !saved && (
            <div className="mx-auto mt-5 max-w-md text-left">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Tên của bạn *</span>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={30}
                    placeholder="VD: Nguyễn Văn A"
                    className="input-field mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Đội (không bắt buộc)</span>
                  <input
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    maxLength={30}
                    placeholder="VD: SIÊU LỐP"
                    className="input-field mt-1"
                  />
                </label>
              </div>
              <button
                onClick={() => void saveScore()}
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700 disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : 'Lưu điểm vào bảng xếp hạng'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Điểm lưu từ ván vừa chơi, không tự nhập.
              </p>
              {saveError && <p className="mt-2 text-center text-sm text-red-600">{saveError}</p>}
            </div>
          )}
          {saved && (
            <p className="mt-4 text-sm font-semibold text-emerald-700">
              Đã lưu vào bảng xếp hạng!
            </p>
          )}
        </div>
      )}

      <div className="card mt-5 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Trophy className="h-5 w-5 text-amber-500" />
          Bảng xếp hạng
        </h3>
        {scoresError ? (
          <p className="mt-3 text-sm text-slate-500">
            Bảng xếp hạng sẽ hiện sau khi chạy file SQL tạo bảng điểm.
          </p>
        ) : scores === null ? (
          <p className="mt-3 text-sm text-slate-500">Đang tải…</p>
        ) : scores.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có điểm nào — bạn là người đầu tiên!</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {scores.map((row, i) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"
              >
                <span
                  className={`w-7 text-center text-base font-black tabular-nums ${
                    i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900">{row.player_name}</span>
                  {row.team_name && <span className="text-slate-500"> · {row.team_name}</span>}
                  <span className="block text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span className="font-bold tabular-nums text-geoenv-700">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
