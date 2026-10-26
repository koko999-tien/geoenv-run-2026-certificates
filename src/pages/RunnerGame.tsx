import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* =========================================================================
   GEOENV RUN 2026 - TRÒ CHƠI CHẠY VÔ TẬN NÂNG CẤP TOÀN DIỆN
   - Đồ họa: Parallax 5 tầng, chu kỳ ngày - hoàng hôn - đêm, vạch cự ly, cờ phướn BTC
   - Hoạt ảnh: Vận động viên 8 frame, dải băng tung bay, nhảy kép (double jump),
               trượt người sát đất (slide), vấp ngã ngộ nghĩnh, vệt lướt tốc độ cao
   - Lối chơi & Hiệu ứng: Khiên bảo vệ, nước tăng lực siêu tốc, chai nước + huy chương,
                         âm thanh Web Audio tổng hợp đa kênh, pháo hoa giấy confetti
   - Bảng xếp hạng: Đồng bộ Supabase thời gian thực, lưu kỷ lục cá nhân
   ========================================================================= */

const W = 960;
const H = 320;
const GROUND = 265;
const RUNNER_X = 90;
const RUNNER_W = 36;
const RUNNER_H = 50;
const MAX_SCORE = 100000;
const BEST_KEY = 'geoenv-runner-best';
const NAME_KEY = 'geoenv-runner-name';
const TEAM_KEY = 'geoenv-runner-team';
const SOUND_KEY = 'geoenv-runner-sound';

type Phase = 'ready' | 'playing' | 'over';
type ObKind = 'hurdle' | 'rock' | 'puddle' | 'drone';
type ItemKind = 'bottle' | 'medal' | 'shield' | 'booster';

interface Obstacle {
  x: number;
  kind: ObKind;
  passed?: boolean;
}

interface Item {
  x: number;
  y: number;
  kind: ItemKind;
  taken: boolean;
  bob: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
  type?: 'dust' | 'spark' | 'confetti' | 'splash' | 'star';
  rotation?: number;
  vRot?: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

interface ScoreRow {
  id: number;
  player_name: string;
  team_name: string | null;
  score: number;
  created_at: string;
}

const OB_CONFIG: Record<ObKind, { w: number; h: number; yOffset: number }> = {
  hurdle: { w: 30, h: 36, yOffset: 36 },
  rock: { w: 36, h: 28, yOffset: 28 },
  puddle: { w: 48, h: 14, yOffset: 12 },
  drone: { w: 38, h: 22, yOffset: 68 }, // Bay tầm cao, bắt buộc trượt (slide) bên dưới!
};

/* ----------------- WEB AUDIO SYNTHESIZER ----------------- */
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  constructor() {
    const saved = localStorage.getItem(SOUND_KEY);
    this.enabled = saved !== 'false';
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  playJump(double = false) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const now = this.ctx.currentTime;
      osc.type = 'sine';
      const startF = double ? 320 : 180;
      const endF = double ? 620 : 380;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(endF, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  playSlide() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const now = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.16);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  playCollect(kind: ItemKind) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      if (kind === 'booster' || kind === 'shield') {
        // Hợp âm hào quang
        [440, 554, 659, 880].forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.15, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.25);
        });
      } else {
        // Âm thanh nhặt chai nước / huy chương
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        const f1 = kind === 'medal' ? 660 : 523;
        const f2 = kind === 'medal' ? 880 : 784;
        osc.frequency.setValueAtTime(f1, now);
        osc.frequency.setValueAtTime(f2, now + 0.08);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {}
  }

  playShieldBreak() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  playMilestone() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch {}
  }

  playGameOver() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.45);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }
}

const soundEngine = new SoundEngine();

/* Helper vẽ bo góc */
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

/* =========================================================================
   HỆ THỐNG VẼ ĐỒ HỌA PARALLAX & BỐI CẢNH (DAY / SUNSET / NIGHT)
   ========================================================================= */

function drawEnvironment(ctx: CanvasRenderingContext2D, distance: number) {
  // Chu kỳ thời gian theo quãng đường chạy
  // 0 - 900m: Ngày | 900 - 2200m: Hoàng hôn | 2200m+: Đêm sao
  const timeProgress = (distance % 3600) / 3600;
  let skyTop = '#38bdf8';
  let skyMid = '#bae6fd';
  let skyBot = '#f0f9ff';
  let sunMoonColor = '#fef08a';
  let sunMoonGlow = 'rgba(254, 240, 138, 0.35)';
  let mountainFar = '#93c5fd';
  let mountainNear = '#60a5fa';
  let isNight = false;

  if (timeProgress > 0.35 && timeProgress <= 0.65) {
    // Hoàng hôn rực rỡ
    const t = (timeProgress - 0.35) / 0.3;
    skyTop = t < 0.5 ? '#f97316' : '#c026d3';
    skyMid = t < 0.5 ? '#fb923c' : '#f43f5e';
    skyBot = '#fed7aa';
    sunMoonColor = '#fbbf24';
    sunMoonGlow = 'rgba(251, 146, 60, 0.4)';
    mountainFar = '#a855f7';
    mountainNear = '#7c3aed';
  } else if (timeProgress > 0.65) {
    // Đêm lung linh ngàn sao
    isNight = true;
    skyTop = '#090d16';
    skyMid = '#172554';
    skyBot = '#1e3a8a';
    sunMoonColor = '#f1f5f9';
    sunMoonGlow = 'rgba(241, 245, 249, 0.4)';
    mountainFar = '#1e293b';
    mountainNear = '#0f172a';
  }

  // 1. Bầu trời
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(0.65, skyMid);
  sky.addColorStop(1, skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  // Sao đêm lấp lánh nếu là ban đêm
  if (isNight) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 28; i++) {
      const sx = (i * 97 + (distance * 0.02)) % W;
      const sy = 15 + ((i * 37) % (GROUND - 90));
      const r = (i % 3 === 0) ? 1.8 : 1.1;
      const alpha = 0.4 + 0.6 * Math.sin(distance * 0.03 + i);
      ctx.globalAlpha = Math.max(0.1, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  // Mặt trời hoặc Mặt trăng
  const celestialX = 820;
  const celestialY = 55;
  ctx.fillStyle = sunMoonGlow;
  ctx.beginPath();
  ctx.arc(celestialX, celestialY, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sunMoonColor;
  ctx.beginPath();
  ctx.arc(celestialX, celestialY, 28, 0, Math.PI * 2);
  ctx.fill();
  if (isNight) {
    // Vết khuyết mặt trăng
    ctx.fillStyle = skyTop;
    ctx.beginPath();
    ctx.arc(celestialX + 10, celestialY - 4, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mây trôi bồng bềnh 3D
  ctx.fillStyle = isNight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.85)';
  const clouds = [
    { x: 100, y: 55, s: 0.9 },
    { x: 380, y: 35, s: 1.1 },
    { x: 670, y: 70, s: 0.8 },
    { x: 920, y: 45, s: 1.2 },
  ];
  for (const c of clouds) {
    const cx = (((c.x - distance * 0.09) % (W + 280)) + W + 280) % (W + 280) - 140;
    const cy = c.y;
    const s = c.s;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24 * s, cy + 4 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 26 * s, cy + 4 * s, 24 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Dãy núi xa (Parallax lớp 1)
  const farOff = (distance * 0.18) % 480;
  ctx.fillStyle = mountainFar;
  for (let x = -480 - farOff; x < W + 480; x += 480) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + 160, GROUND - 115);
    ctx.lineTo(x + 320, GROUND - 60);
    ctx.lineTo(x + 480, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Dãy đồi & Cây xanh tầng giữa (Parallax lớp 2)
  const nearOff = (distance * 0.42) % 360;
  ctx.fillStyle = mountainNear;
  for (let x = -360 - nearOff; x < W + 360; x += 360) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + 110, GROUND - 75);
    ctx.lineTo(x + 220, GROUND - 95);
    ctx.lineTo(x + 360, GROUND);
    ctx.closePath();
    ctx.fill();

    // Hàng cây xanh mát
    ctx.fillStyle = isNight ? '#064e3b' : '#10b981';
    ctx.beginPath();
    ctx.arc(x + 110, GROUND - 75, 14, 0, Math.PI * 2);
    ctx.arc(x + 170, GROUND - 65, 18, 0, Math.PI * 2);
    ctx.arc(x + 220, GROUND - 95, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mountainNear;
  }

  // Tòa nhà biểu tượng HUMG / Trường học mờ ảo tầng sau
  const humgOff = (distance * 0.3) % 800;
  ctx.fillStyle = isNight ? '#1e293b' : '#94a3b8';
  for (let x = -800 - humgOff; x < W + 800; x += 800) {
    roundRect(ctx, x + 380, GROUND - 90, 80, 90, 4);
    ctx.fill();
    roundRect(ctx, x + 405, GROUND - 120, 30, 30, 2);
    ctx.fill();
    // Cửa sổ sáng đèn
    ctx.fillStyle = isNight ? '#fef08a' : '#f8fafc';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(x + 392 + c * 20, GROUND - 80 + r * 22, 10, 12);
      }
    }
    ctx.fillStyle = isNight ? '#1e293b' : '#94a3b8';
  }

  // 4. Đường chạy Tartan chuyên nghiệp
  const track = ctx.createLinearGradient(0, GROUND, 0, H);
  track.addColorStop(0, '#c2410c'); // Đỏ cam Tartan
  track.addColorStop(0.3, '#9a3412');
  track.addColorStop(1, '#7c2d12');
  ctx.fillStyle = track;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // Viền cỏ xanh mướt hai bên lề đường
  const grass = ctx.createLinearGradient(0, GROUND - 5, 0, GROUND);
  grass.addColorStop(0, '#22c55e');
  grass.addColorStop(1, '#15803d');
  ctx.fillStyle = grass;
  ctx.fillRect(0, GROUND - 5, W, 5);

  // Vạch biên trắng phản quang
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, GROUND, W, 3.5);

  // Làn chạy phân cách (Làn 1 và Làn 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const dashOff = (distance * 1.0) % 140;
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(i * 140 - dashOff, GROUND + 28, 70, 3);
  }

  // Cột mốc cự ly dọc đường (100m, 200m, 500m, 1km...)
  const postDist = 600; // Mỗi 600px một mốc cự ly
  const postOff = (distance * 1.0) % postDist;
  const currKm = Math.floor(distance / postDist) * 100;
  for (let x = -postDist - postOff; x < W + postDist; x += postDist) {
    if (x > -80 && x < W + 80) {
      // Cột mốc
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 120, GROUND - 32, 24, 32);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 120, GROUND - 32, 24, 8);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.max(100, currKm)}m`, x + 132, GROUND - 10);
    }
  }

  // Cờ phướn cổ vũ GEOENV RUN 2026 tung bay
  const bannerOff = (distance * 1.0) % 1100;
  for (let x = -1100 - bannerOff; x < W + 1100; x += 1100) {
    if (x > -150 && x < W + 150) {
      // Cột cờ
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 280, GROUND - 68, 4, 68);
      // Lá cờ bay phấp phới
      const wave = Math.sin(distance * 0.08) * 3;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(x + 284, GROUND - 66);
      ctx.quadraticCurveTo(x + 310, GROUND - 66 + wave, x + 338, GROUND - 62);
      ctx.lineTo(x + 338, GROUND - 40);
      ctx.quadraticCurveTo(x + 310, GROUND - 44 + wave, x + 284, GROUND - 44);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GEOENV', x + 311, GROUND - 51 + wave * 0.5);
    }
  }
}

/* =========================================================================
   HỆ THỐNG VẼ VẬN ĐỘNG VIÊN (RUNNER ANIMATION RIG)
   - Chu kỳ chạy 8 bước mượt mà
   - Dải ruy băng bandana bay theo gió
   - Dáng cúi trượt sát đất (slide)
   - Dáng nhảy vút người (jump & double jump)
   - Số BIB "2026" in trên ngực áo
   - Hào quang khiên / vệt tăng tốc
   ========================================================================= */

function drawRunner(
  ctx: CanvasRenderingContext2D,
  y: number,
  frame: number,
  airborne: boolean,
  sliding: boolean,
  hasShield: boolean,
  hasBooster: boolean,
  isOver: boolean,
) {
  ctx.save();

  // 1. Bóng đổ dưới mặt đất (co giãn theo độ cao nhảy)
  const heightAbove = GROUND - RUNNER_H - y;
  const shadowScale = sliding
    ? 1.3
    : Math.max(0.3, 1 - heightAbove / 240);
  const shadowAlpha = sliding ? 0.35 : Math.max(0.12, 0.28 * (1 - heightAbove / 280));

  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(
    RUNNER_X + (sliding ? 22 : 18),
    GROUND + 3,
    (sliding ? 26 : 22) * shadowScale,
    (sliding ? 4.5 : 5) * shadowScale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // 2. Vệt hào quang năng lượng nếu đang bật Booster
  if (hasBooster) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.beginPath();
    ctx.ellipse(RUNNER_X + 18, y + 25, 34, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    // Vệt bóng ma (ghost trail)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.ellipse(RUNNER_X - 16, y + 26, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. VẼ TƯ THẾ TRƯỢT NGƯỜI (SLIDE / DUCK)
  if (sliding) {
    const slideY = GROUND - 24;

    // Chân trượt dài sát đất
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 2, slideY + 12);
    ctx.lineTo(RUNNER_X + 38, slideY + 16); // Chân duỗi dài
    ctx.stroke();

    // Giày chạy lướt trên đường
    ctx.fillStyle = '#f97316';
    ctx.fillRect(RUNNER_X + 36, slideY + 13, 10, 6);

    // Thân áo nghiêng thấp
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, RUNNER_X + 6, slideY - 2, 28, 16, 5);
    ctx.fill();

    // BIB 2026 trên lưng
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(RUNNER_X + 14, slideY + 1, 12, 10);
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2026', RUNNER_X + 20, slideY + 8);

    // Cánh tay chống trượt tạo phong cách
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 12, slideY + 4);
    ctx.lineTo(RUNNER_X - 2, slideY + 14);
    ctx.stroke();

    // Đầu và khăn bay
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(RUNNER_X + 34, slideY - 4, 9, 0, Math.PI * 2);
    ctx.fill();

    // Khăn headband bay ngang phía sau
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(RUNNER_X + 26, slideY - 8, 12, 4);
    const bandWave = Math.sin(frame * 0.4) * 3;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 26, slideY - 7);
    ctx.lineTo(RUNNER_X + 10, slideY - 9 + bandWave);
    ctx.lineTo(RUNNER_X + 10, slideY - 5 + bandWave);
    ctx.lineTo(RUNNER_X + 26, slideY - 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  // 4. VẼ TƯ THẾ GAME OVER (VẤP NGÃ)
  if (isOver) {
    const tumbleY = GROUND - 26;
    ctx.translate(RUNNER_X + 18, tumbleY);
    ctx.rotate(0.55); // Ngã nghiêng

    // Chân giơ lên trời
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-18, -12);
    ctx.moveTo(4, 10);
    ctx.lineTo(-8, -20);
    ctx.stroke();

    // Thân
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, -10, -6, 22, 20, 6);
    ctx.fill();

    // Đầu
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(8, -18, 9, 0, Math.PI * 2);
    ctx.fill();

    // Mắt hoa sao chóng mặt (dizzy stars)
    ctx.fillStyle = '#fbbf24';
    ctx.font = '14px sans-serif';
    ctx.fillText('💫', 12, -26);

    ctx.restore();
    return;
  }

  // 5. VẼ TƯ THẾ CHẠY BÌNH THƯỜNG HOẶC NHẢY TRÊN KHÔNG
  const hipY = y + 36;
  const cycle = Math.floor(frame / 4) % 8; // 8-frame run cycle
  const legAngles = [-16, -10, 0, 12, 18, 10, 0, -10];
  const swing = airborne ? 14 : legAngles[cycle];
  const backSwing = airborne ? -12 : -legAngles[cycle];

  // Chân sau & đùi sau
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 19, hipY);
  ctx.lineTo(RUNNER_X + 19 + backSwing, y + 49);
  ctx.stroke();

  // Giày sau
  ctx.fillStyle = '#f97316';
  ctx.fillRect(RUNNER_X + 16 + backSwing, y + 47, 10, 5);

  // Chân trước & đùi trước
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 15, hipY);
  ctx.lineTo(RUNNER_X + 15 + swing, y + 49);
  ctx.stroke();

  // Giày trước
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(RUNNER_X + 12 + swing, y + 47, 10, 5);

  // Thân áo chạy GEOENV RUN xanh thể thao
  ctx.fillStyle = '#0284c7'; // Cyan/Blue thể thao
  roundRect(ctx, RUNNER_X + 8, y + 15, 23, 24, 7);
  ctx.fill();

  // Số BIB "2026" trước ngực
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(RUNNER_X + 12, y + 21, 14, 11);
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2026', RUNNER_X + 19, y + 29);

  // Tay sau
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 12, y + 20);
  ctx.lineTo(RUNNER_X + 12 + backSwing * 0.9, y + 33);
  ctx.stroke();

  // Tay trước
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 26, y + 20);
  ctx.lineTo(RUNNER_X + 26 + swing * 0.9, y + 33);
  ctx.stroke();

  // Cổ và đầu
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath();
  ctx.arc(RUNNER_X + 20, y + 8, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // Mái tóc thể thao năng động
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(RUNNER_X + 20, y + 5, 9.5, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();

  // Băng đô thể thao (Headband) đỏ rực
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(RUNNER_X + 11, y + 3, 18, 4);

  // Dải ruy băng buộc đầu tung bay trong gió (animated ribbon)
  const ribbonWave = Math.sin(frame * 0.35) * 4;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 11, y + 4);
  ctx.quadraticCurveTo(RUNNER_X - 2, y + 3 + ribbonWave, RUNNER_X - 12, y + 6 + ribbonWave);
  ctx.lineTo(RUNNER_X - 11, y + 9 + ribbonWave);
  ctx.quadraticCurveTo(RUNNER_X - 2, y + 6 + ribbonWave, RUNNER_X + 11, y + 7);
  ctx.closePath();
  ctx.fill();

  // 6. HÀO QUANG KHIÊN BẢO VỆ (SHIELD BUBBLE)
  if (hasShield) {
    const pulse = Math.sin(frame * 0.15) * 2;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.arc(RUNNER_X + 19, y + 24, 30 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hạt sao bảo vệ xoay quanh khiên
    const starAngle = frame * 0.1;
    const sx = RUNNER_X + 19 + Math.cos(starAngle) * (30 + pulse);
    const sy = y + 24 + Math.sin(starAngle) * (30 + pulse);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* =========================================================================
   HỆ THỐNG VẼ CHƯỚNG NGẠI VẬT & VẬT PHẨM (OBSTACLES & POWER-UPS)
   ========================================================================= */

function drawObstacle(ctx: CanvasRenderingContext2D, ob: Obstacle, frame: number) {
  const { w, h, yOffset } = OB_CONFIG[ob.kind];
  const y = GROUND - yOffset;

  if (ob.kind === 'hurdle') {
    // Rào chắn thể thao phản quang sọc cam trắng
    ctx.fillStyle = '#334155';
    ctx.fillRect(ob.x + 2, y + 8, 4, h - 8);
    ctx.fillRect(ob.x + w - 6, y + 8, 4, h - 8);
    // Chân đế vững chắc
    ctx.fillRect(ob.x - 4, GROUND - 4, 12, 4);
    ctx.fillRect(ob.x + w - 8, GROUND - 4, 12, 4);
    // Thanh rào chắn
    ctx.fillStyle = '#ea580c';
    roundRect(ctx, ob.x - 2, y, w + 4, 10, 3);
    ctx.fill();
    // Vạch trắng phản quang
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ob.x + 4, y, 6, 10);
    ctx.fillRect(ob.x + w - 10, y, 6, 10);
  } else if (ob.kind === 'rock') {
    // Tảng đá địa chất góc cạnh 3D có vân đá
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(ob.x, GROUND);
    ctx.lineTo(ob.x + 7, y + 8);
    ctx.lineTo(ob.x + 20, y);
    ctx.lineTo(ob.x + 32, y + 9);
    ctx.lineTo(ob.x + w, GROUND);
    ctx.closePath();
    ctx.fill();
    // Mảng sáng và rêu xanh
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(ob.x + 7, y + 8);
    ctx.lineTo(ob.x + 20, y);
    ctx.lineTo(ob.x + 25, y + 12);
    ctx.lineTo(ob.x + 14, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.fillRect(ob.x + 16, y + 1, 6, 3);
  } else if (ob.kind === 'puddle') {
    // Vũng nước phản chiếu bầu trời có sóng gợn
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 4, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const ripple = (frame * 0.08) % 1;
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2 - 8, GROUND - 5, 8 * (1 - ripple * 0.3), 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 4, w / 2 + 3 * ripple, 6 + 2 * ripple, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ob.kind === 'drone') {
    // Flycam / Drone bay tầm cao ghi hình giải chạy
    const droneY = y + Math.sin(frame * 0.15) * 5;
    // Cánh quạt quay tít
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ob.x + 6, droneY - 4, 10, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(ob.x + w - 6, droneY - 4, 10, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Thân drone
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, ob.x + 4, droneY, w - 8, 14, 4);
    ctx.fill();
    // Camera và đèn LED nhấp nháy đỏ xanh
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(ob.x + w / 2, droneY + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    const ledColor = frame % 16 < 8 ? '#ef4444' : '#22c55e';
    ctx.fillStyle = ledColor;
    ctx.beginPath();
    ctx.arc(ob.x + 7, droneY + 6, 2.5, 0, Math.PI * 2);
    ctx.arc(ob.x + w - 7, droneY + 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, frame: number) {
  const bobY = item.y + Math.sin(frame * 0.1 + item.bob) * 5;

  if (item.kind === 'bottle') {
    // Chai nước khoáng thể thao +50 điểm
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, item.x, bobY, 15, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(item.x + 2, bobY + 7, 11, 9);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(item.x + 4, bobY - 4, 7, 5);
    // Hạt sáng lấp lánh
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(item.x + 4, bobY + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === 'medal') {
    // Huy chương vàng GEOENV +150 điểm
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    // Ngôi sao bên trong huy chương
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', item.x + 10, bobY + 14);
  } else if (item.kind === 'shield') {
    // Viên ngọc khiên bảo vệ
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡', item.x + 10, bobY + 14);
  } else if (item.kind === 'booster') {
    // Nước tăng lực siêu tốc GEOENV Booster
    ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eab308';
    roundRect(ctx, item.x + 3, bobY, 14, 22, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', item.x + 10, bobY + 15);
  }
}

/* Helper kiểm tra va chạm hitbox AABB */
function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* =========================================================================
   COMPONENT CHÍNH: RUNNER GAME
   ========================================================================= */

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [finalScore, setFinalScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    const stored = Number(localStorage.getItem(BEST_KEY) ?? 0);
    return Number.isNaN(stored) ? 0 : stored;
  });
  const [isNewBest, setIsNewBest] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEngine.enabled);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [scoresError, setScoresError] = useState(false);
  const [nameInput, setNameInput] = useState<string>(() => localStorage.getItem(NAME_KEY) ?? '');
  const [teamInput, setTeamInput] = useState<string>(() => localStorage.getItem(TEAM_KEY) ?? '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // State hỗ trợ HUD trên giao diện React
  const [activeBooster, setActiveBooster] = useState(false);
  const [activeShield, setActiveShield] = useState(false);

  /* Trạng thái game thuần ref để chạy vòng lặp 60fps mượt mà */
  const g = useRef({
    y: GROUND - RUNNER_H,
    vy: 0,
    airborne: false,
    doubleJumpAvailable: true,
    sliding: false,
    slideUntil: 0,
    frame: 0,
    speed: 4.8,
    score: 0,
    distance: 0,
    combo: 1,
    comboStreak: 0,
    shield: false,
    boosterUntil: 0,
    shake: 0,
    lastObDist: 0,
    nextGap: 420,
    lastItemDist: 0,
    nextItemGap: 650,
    lastMilestone: 0,
    obstacles: [] as Obstacle[],
    items: [] as Item[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
  });
  const phaseRef = useRef<Phase>('ready');

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const toggleSound = () => {
    soundEngine.enabled = !soundEngine.enabled;
    setSoundOn(soundEngine.enabled);
    localStorage.setItem(SOUND_KEY, String(soundEngine.enabled));
  };

  const resetGame = () => {
    g.current = {
      y: GROUND - RUNNER_H,
      vy: 0,
      airborne: false,
      doubleJumpAvailable: true,
      sliding: false,
      slideUntil: 0,
      frame: 0,
      speed: 4.8,
      score: 0,
      distance: 0,
      combo: 1,
      comboStreak: 0,
      shield: false,
      boosterUntil: 0,
      shake: 0,
      lastObDist: 0,
      nextGap: 420,
      lastItemDist: 0,
      nextItemGap: 650,
      lastMilestone: 0,
      obstacles: [],
      items: [],
      particles: [],
      floatingTexts: [],
    };
    setActiveBooster(false);
    setActiveShield(false);
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
    soundEngine.playGameOver();
    g.current.shake = 16;

    setBest((prev) => {
      if (score > prev) {
        localStorage.setItem(BEST_KEY, String(score));
        setIsNewBest(true);
        return score;
      }
      return prev;
    });
  }, []);

  /* Hành động: Nhảy & Nhảy kép */
  const jump = useCallback(() => {
    if (phaseRef.current === 'ready') {
      startGame();
      return;
    }
    if (phaseRef.current !== 'playing') return;

    const s = g.current;
    if (s.sliding) {
      // Hủy trượt ngay khi nhảy
      s.sliding = false;
    }

    if (!s.airborne) {
      // Nhảy lần 1
      s.airborne = true;
      s.vy = -16.8;
      s.doubleJumpAvailable = true;
      soundEngine.playJump(false);

      // Bụi đất bật nhảy
      for (let i = 0; i < 7; i++) {
        s.particles.push({
          x: RUNNER_X + 16,
          y: GROUND,
          vx: -1.5 - Math.random() * 2.5,
          vy: -1 - Math.random() * 2,
          r: 2 + Math.random() * 3,
          color: '#d97706',
          life: 0,
          maxLife: 20,
          type: 'dust',
        });
      }
    } else if (s.doubleJumpAvailable) {
      // Nhảy kép (Double jump)
      s.doubleJumpAvailable = false;
      s.vy = -14.5;
      soundEngine.playJump(true);

      // Hiệu ứng vòng sóng không trung
      for (let i = 0; i < 9; i++) {
        s.particles.push({
          x: RUNNER_X + 18,
          y: s.y + 35,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 2,
          r: 2 + Math.random() * 2.5,
          color: '#38bdf8',
          life: 0,
          maxLife: 18,
          type: 'spark',
        });
      }
      s.floatingTexts.push({
        x: RUNNER_X + 20,
        y: s.y - 10,
        text: 'DOUBLE JUMP!',
        color: '#38bdf8',
        alpha: 1,
        scale: 1,
      });
    }
  }, []);

  /* Hành động: Cúi trượt sát đất (Slide / Duck) */
  const slide = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = g.current;
    if (s.airborne) {
      // Đang trên không thì hạ nhanh xuống đất
      s.vy += 8;
      return;
    }
    s.sliding = true;
    s.slideUntil = s.frame + 28; // Trượt trong khoảng ~0.45s
    soundEngine.playSlide();

    // Hạt lửa ma sát trượt lướt
    for (let i = 0; i < 6; i++) {
      s.particles.push({
        x: RUNNER_X + 4,
        y: GROUND,
        vx: -2 - Math.random() * 3,
        vy: -0.5 - Math.random(),
        r: 1.5 + Math.random() * 2,
        color: '#f97316',
        life: 0,
        maxLife: 15,
        type: 'spark',
      });
    }
  }, []);

  /* VÒNG LẶP RENDER CHÍNH (CANVAS 60FPS) */
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const s = g.current;

        if (phaseRef.current === 'playing') {
          s.frame++;

          // Kiểm tra hiệu lực trượt
          if (s.sliding && s.frame >= s.slideUntil) {
            s.sliding = false;
          }

          // Kiểm tra hiệu lực Booster
          const isBoosted = s.frame < s.boosterUntil;
          if (activeBooster !== isBoosted) setActiveBooster(isBoosted);
          if (activeShield !== s.shield) setActiveShield(s.shield);

          // Vật lý trọng lực
          if (s.airborne) {
            s.vy += 0.88;
            s.y += s.vy;
            if (s.y >= GROUND - RUNNER_H) {
              s.y = GROUND - RUNNER_H;
              s.airborne = false;
              s.vy = 0;
              // Tiếp đất tạo bụi
              for (let i = 0; i < 8; i++) {
                s.particles.push({
                  x: RUNNER_X + 10 + Math.random() * 20,
                  y: GROUND,
                  vx: -1.5 - Math.random() * 3,
                  vy: -1 - Math.random() * 2,
                  r: 2 + Math.random() * 3.5,
                  color: '#b45309',
                  life: 0,
                  maxLife: 22,
                  type: 'dust',
                });
              }
            }
          }

          // Tính toán tốc độ: Tăng dần theo điểm, có boost x1.4
          const baseSpeed = Math.min(4.8 + s.score * 0.0028, 15.5);
          s.speed = isBoosted ? baseSpeed * 1.35 : baseSpeed;

          // Điểm & Quãng đường
          const pointInc = s.speed * 0.24 * s.combo;
          s.score += pointInc;
          s.distance += s.speed;

          // Sinh chướng ngại vật ngẫu nhiên
          if (s.distance - s.lastObDist > s.nextGap) {
            const kinds: ObKind[] = ['hurdle', 'rock', 'puddle', 'drone'];
            const chosen = kinds[Math.floor(Math.random() * kinds.length)];
            s.obstacles.push({ x: W + 30, kind: chosen });
            s.lastObDist = s.distance;
            s.nextGap = 360 + Math.random() * 320;
          }

          // Sinh vật phẩm & power-up
          if (s.distance - s.lastItemDist > s.nextItemGap) {
            const rand = Math.random();
            let kind: ItemKind = 'bottle';
            if (rand < 0.45) kind = 'bottle';
            else if (rand < 0.75) kind = 'medal';
            else if (rand < 0.90) kind = 'shield';
            else kind = 'booster';

            const itemY = kind === 'medal' ? GROUND - 85 : GROUND - 40;
            s.items.push({
              x: W + 20,
              y: itemY,
              kind,
              taken: false,
              bob: Math.random() * Math.PI,
            });
            s.lastItemDist = s.distance;
            s.nextItemGap = 600 + Math.random() * 550;
          }

          // Di chuyển chướng ngại & vật phẩm
          for (const ob of s.obstacles) ob.x -= s.speed;
          for (const item of s.items) {
            item.x -= s.speed;
            // Nếu có booster: Hút vật phẩm tự động về phía người chơi (Magnet)
            if (isBoosted && !item.taken) {
              const dx = RUNNER_X + 18 - item.x;
              const dy = s.y + 20 - item.y;
              item.x += dx * 0.12;
              item.y += dy * 0.12;
            }
          }

          s.obstacles = s.obstacles.filter((o) => o.x + 80 > 0);
          s.items = s.items.filter((item) => item.x + 40 > 0 && !item.taken);

          // Bụi chân chạy nhịp nhàng khi ở mặt đất
          if (!s.airborne && !s.sliding && s.frame % 5 === 0) {
            s.particles.push({
              x: RUNNER_X + 6,
              y: GROUND,
              vx: -1.2 - Math.random() * 1.5,
              vy: -0.4 - Math.random() * 0.8,
              r: 1.5 + Math.random() * 2,
              color: '#d97706',
              life: 0,
              maxLife: 16,
              type: 'dust',
            });
          }

          // Cập nhật hệ thống hạt (Particles)
          for (const p of s.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.life++;
            if (p.type === 'confetti' && p.rotation !== undefined && p.vRot !== undefined) {
              p.rotation += p.vRot;
              p.vy += 0.08; // Rơi nhẹ
            }
          }
          s.particles = s.particles.filter((p) => p.life < p.maxLife);

          // Cập nhật chữ bay nổi (Floating texts)
          for (const ft of s.floatingTexts) {
            ft.y -= 1.2;
            ft.alpha -= 0.02;
            ft.scale = Math.min(1.2, ft.scale + 0.01);
          }
          s.floatingTexts = s.floatingTexts.filter((ft) => ft.alpha > 0);

          // Kiểm tra mốc cự ly (Milestone Confetti Fireworks!)
          const milestone = Math.floor(s.distance / 500);
          if (milestone > s.lastMilestone && milestone > 0) {
            s.lastMilestone = milestone;
            soundEngine.playMilestone();
            const milestoneM = milestone * 500;
            s.floatingTexts.push({
              x: W / 2,
              y: 90,
              text: `🎉 CHẠM MỐC ${milestoneM}M!`,
              color: '#f59e0b',
              alpha: 1,
              scale: 1,
            });

            // Bắn pháo hoa giấy confetti rực rỡ
            const confColors = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#a855f7'];
            for (let i = 0; i < 45; i++) {
              s.particles.push({
                x: W / 2 + (Math.random() - 0.5) * 200,
                y: 60 + Math.random() * 40,
                vx: (Math.random() - 0.5) * 8,
                vy: -3 - Math.random() * 5,
                r: 4 + Math.random() * 4,
                color: confColors[Math.floor(Math.random() * confColors.length)],
                life: 0,
                maxLife: 50 + Math.random() * 30,
                type: 'confetti',
                rotation: Math.random() * Math.PI,
                vRot: (Math.random() - 0.5) * 0.2,
              });
            }
          }

          // Hitbox của người chơi (Thay đổi linh hoạt khi cúi trượt)
          const runnerBox = s.sliding
            ? { x: RUNNER_X + 4, y: GROUND - 24, w: 42, h: 22 }
            : { x: RUNNER_X + 8, y: s.y + 4, w: RUNNER_W - 14, h: RUNNER_H - 6 };

          // Kiểm tra ăn vật phẩm
          for (const item of s.items) {
            if (!item.taken && overlaps(runnerBox, { x: item.x, y: item.y - 10, w: 22, h: 32 })) {
              item.taken = true;
              soundEngine.playCollect(item.kind);

              if (item.kind === 'bottle') {
                s.score += 50;
                s.comboStreak++;
                if (s.comboStreak % 3 === 0) s.combo = Math.min(3, s.combo + 0.5);
                s.floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: `+50 ${s.combo > 1 ? `(x${s.combo})` : ''}`,
                  color: '#38bdf8',
                  alpha: 1,
                  scale: 1,
                });
              } else if (item.kind === 'medal') {
                s.score += 150;
                s.floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: '+150 HUY CHƯƠNG!',
                  color: '#fbbf24',
                  alpha: 1,
                  scale: 1,
                });
              } else if (item.kind === 'shield') {
                s.shield = true;
                s.floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: 'KHIÊN BẢO VỆ!',
                  color: '#0284c7',
                  alpha: 1,
                  scale: 1,
                });
              } else if (item.kind === 'booster') {
                s.boosterUntil = s.frame + 300; // 5 giây boost
                s.floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: '⚡ SIÊU TĂNG TỐC!',
                  color: '#eab308',
                  alpha: 1,
                  scale: 1,
                });
              }

              // Hạt sao tóe ra khi nhặt vật phẩm
              for (let i = 0; i < 9; i++) {
                s.particles.push({
                  x: item.x + 10,
                  y: item.y + 10,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  r: 2 + Math.random() * 2.5,
                  color: item.kind === 'medal' ? '#fbbf24' : '#38bdf8',
                  life: 0,
                  maxLife: 20,
                  type: 'star',
                });
              }
            }
          }

          // Kiểm tra va chạm chướng ngại vật
          let hit = false;
          for (const ob of s.obstacles) {
            const cfg = OB_CONFIG[ob.kind];
            const obBox = {
              x: ob.x + 4,
              y: GROUND - cfg.yOffset + 3,
              w: cfg.w - 8,
              h: cfg.h - 6,
            };

            if (overlaps(runnerBox, obBox)) {
              if (isBoosted) {
                // Bất tử khi đang trong trạng thái Siêu tăng tốc: Đập tan chướng ngại!
                ob.x = -999;
                s.floatingTexts.push({
                  x: obBox.x,
                  y: obBox.y - 15,
                  text: 'SMASH! +50',
                  color: '#eab308',
                  alpha: 1,
                  scale: 1,
                });
              } else if (s.shield) {
                // Khiên bảo vệ đỡ 1 đòn cứu nguy!
                s.shield = false;
                ob.x = -999;
                soundEngine.playShieldBreak();
                s.shake = 10;
                s.floatingTexts.push({
                  x: runnerBox.x,
                  y: runnerBox.y - 18,
                  text: 'VỠ KHIÊN! CẨN THẬN',
                  color: '#ef4444',
                  alpha: 1,
                  scale: 1,
                });
              } else {
                hit = true;
                break;
              }
            }
          }

          if (hit) gameOver();
        }

        // ================= XỬ LÝ VẼ RA CANVAS =================
        ctx.save();

        // Hiệu ứng Rung màn hình (Screen Shake)
        if (s.shake > 0) {
          const sx = (Math.random() - 0.5) * s.shake;
          const sy = (Math.random() - 0.5) * s.shake;
          ctx.translate(sx, sy);
          s.shake *= 0.88;
          if (s.shake < 0.5) s.shake = 0;
        }

        ctx.clearRect(0, 0, W, H);

        // 1. Vẽ bối cảnh Parallax đa tầng
        drawEnvironment(ctx, s.distance);

        // 2. Vẽ các hạt bụi / tia lửa / confetti
        for (const p of s.particles) {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
          if (p.type === 'confetti' && p.rotation !== undefined) {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 3. Vẽ vật phẩm thu thập
        for (const item of s.items) {
          drawItem(ctx, item, s.frame);
        }

        // 4. Vẽ chướng ngại vật
        for (const ob of s.obstacles) {
          drawObstacle(ctx, ob, s.frame);
        }

        // 5. Vẽ nhân vật vận động viên
        drawRunner(
          ctx,
          s.y,
          s.frame,
          s.airborne,
          s.sliding,
          s.shield,
          s.frame < s.boosterUntil,
          phaseRef.current === 'over',
        );

        // 6. Vệt gió tốc độ cao khi chạy siêu nhanh
        if (s.speed > 8.5 && phaseRef.current === 'playing') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            const ly = 30 + ((i * 47 + s.frame * 4) % 190);
            const lx = ((i * 241 + s.frame * 8) % (W + 200)) - 100;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + 65, ly);
            ctx.stroke();
          }
        }

        // 7. Vẽ chữ bay nổi (Floating score/milestone texts)
        for (const ft of s.floatingTexts) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, ft.alpha);
          ctx.fillStyle = ft.color;
          ctx.font = `bold ${Math.floor(18 * ft.scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 6;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }

        // 8. BẢNG HUD HIỂN THỊ ĐIỂM & CHỈ SỐ TRONG CANVAS
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        roundRect(ctx, W - 210, 12, 196, 68, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`${Math.floor(s.score)} m`, W - 26, 38);

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fbbf24';
        const speedKmh = (s.speed * 3.2).toFixed(1);
        ctx.fillText(`Tốc độ: ${speedKmh} km/h`, W - 26, 56);

        if (s.combo > 1) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`Combo x${s.combo}`, W - 26, 72);
        }

        // Icon chỉ báo trạng thái năng lực góc trái trên
        let buffX = 16;
        if (s.shield) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.85)';
          roundRect(ctx, buffX, 14, 96, 30, 8);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('🛡 KHIÊN ON', buffX + 10, 34);
          buffX += 104;
        }
        if (s.frame < s.boosterUntil) {
          const timeLeft = ((s.boosterUntil - s.frame) / 60).toFixed(1);
          ctx.fillStyle = 'rgba(202, 138, 4, 0.85)';
          roundRect(ctx, buffX, 14, 102, 30, 8);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`⚡ BOOST ${timeLeft}s`, buffX + 8, 34);
        }

        // Màn hình khởi động (Ready)
        if (phaseRef.current === 'ready') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(0, 0, W, H);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          roundRect(ctx, W / 2 - 250, H / 2 - 80, 500, 160, 20);
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText('🏃 GEOENV RUN 2026', W / 2, H / 2 - 32);

          ctx.font = '15px sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText('Nhảy: Phím Cách / Mũi tên lên (Nhấn 2 lần để nhảy kép)', W / 2, H / 2);
          ctx.fillText('Cúi trượt: Mũi tên xuống / Phím S', W / 2, H / 2 + 24);

          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('👉 Bấm vào khung hoặc nhấn Phím Cách để BẮT ĐẦU!', W / 2, H / 2 + 56);
        }

        ctx.restore();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [gameOver, activeBooster, activeShield]);

  /* Bắt phím điều khiển bàn phím (Cách, Mũi tên lên, Mũi tên xuống, W, S) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        slide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, slide]);

  /* Tải bảng xếp hạng từ Supabase */
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

  /* Lưu điểm vào bảng xếp hạng Supabase */
  const saveScore = async () => {
    const name = nameInput.trim();
    if (!name) {
      setSaveError('Vui lòng nhập tên để lưu điểm.');
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
      setSaveError('Không lưu được điểm, vui lòng thử lại sau.');
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(TEAM_KEY, teamInput.trim());
    setSaved(true);
    void loadScores();
  };

  return (
    <div className="relative">
      {/* Khung Canvas Trò Chơi */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-2 ring-slate-800">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={() => {
            if (phase === 'ready' || phase === 'playing') jump();
          }}
          className="block h-auto w-full cursor-pointer touch-manipulation select-none"
        />

        {/* Nút Bật/Tắt Âm Thanh góc trên */}
        <button
          onClick={toggleSound}
          title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
          className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-md transition-all hover:bg-slate-850 hover:scale-105 active:scale-95"
        >
          {soundOn ? <Volume2 className="h-5 w-5 text-emerald-400" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
        </button>

        {/* Nút cảm ứng trên điện thoại / màn hình chạm */}
        {phase === 'playing' && (
          <div className="absolute bottom-3 right-3 flex items-center gap-3 sm:hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                slide();
              }}
              className="flex h-12 w-14 items-center justify-center rounded-xl bg-slate-900/80 font-bold text-white shadow-lg backdrop-blur-md border border-white/20 active:bg-orange-600"
            >
              <ArrowDown className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                jump();
              }}
              className="flex h-12 w-14 items-center justify-center rounded-xl bg-geoenv-600 font-bold text-white shadow-lg backdrop-blur-md border border-white/20 active:bg-geoenv-700"
            >
              <ArrowUp className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Bảng điều khiển nút bấm dưới Game */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={startGame}
            className="flex items-center gap-2 rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-geoenv-600/30 transition-all hover:bg-geoenv-700 hover:scale-102 active:scale-98"
          >
            {phase === 'ready' ? <Play className="h-4 w-4 fill-white" /> : <RotateCcw className="h-4 w-4" />}
            {phase === 'ready' ? 'Bắt đầu chạy' : 'Chạy lại'}
          </button>

          <button
            onClick={jump}
            disabled={phase !== 'playing'}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4 text-geoenv-600" /> Nhảy (Nhấn 2 lần: Nhảy kép)
          </button>

          <button
            onClick={slide}
            disabled={phase !== 'playing'}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowDown className="h-4 w-4 text-orange-600" /> Cúi trượt
          </button>
        </div>

        {best > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 border border-amber-200 text-sm font-bold text-amber-800">
            <Trophy className="h-4 w-4 text-amber-600" /> Kỷ lục cá nhân: <span className="tabular-nums text-base">{best} m</span>
          </div>
        )}
      </div>

      {/* Thẻ hướng dẫn vật phẩm */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200">
          <span className="text-base">💧</span>
          <span><b>Chai nước:</b> +50 điểm & tăng combo</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200">
          <span className="text-base">🏅</span>
          <span><b>Huy chương:</b> +150 điểm thưởng</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200">
          <Shield className="h-4 w-4 text-sky-600" />
          <span><b>Khiên ngọc:</b> Đỡ 1 lần va chạm</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200">
          <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span><b>Booster:</b> Tốc độ cao + Hút điểm</span>
        </div>
      </div>

      {/* Màn hình kết thúc trò chơi (Game Over) */}
      {phase === 'over' && (
        <div className="card mt-6 p-6 text-center border-2 border-geoenv-500/20 shadow-xl sm:p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-2">
            💥
          </div>
          <p className="text-xl font-bold text-slate-900">Vấp ngã rồi!</p>
          <p className="mt-1 text-6xl font-black tabular-nums text-geoenv-700">{finalScore} <span className="text-2xl font-bold text-slate-400">m</span></p>

          {isNewBest && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-800 shadow-sm animate-bounce">
              <Sparkles className="h-4 w-4 text-amber-600" /> Kỷ lục mới của bạn!
            </p>
          )}

          {finalScore > 0 && !saved && (
            <div className="mx-auto mt-6 max-w-md rounded-2xl bg-slate-50 p-5 text-left border border-slate-200">
              <h4 className="text-sm font-bold text-slate-900">Ghi danh vào Bảng Vàng GEOENV RUN</h4>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Tên của bạn *</span>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={30}
                    placeholder="VD: Nguyễn Văn A"
                    className="input-field mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Đội (không bắt buộc)</span>
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
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-geoenv-700 disabled:opacity-60"
              >
                {saving ? 'Đang lưu điểm...' : 'Lưu điểm vào bảng xếp hạng'}
              </button>
              {saveError && <p className="mt-2 text-center text-sm font-semibold text-red-600">{saveError}</p>}
            </div>
          )}

          {saved && (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 border border-emerald-200">
              ✓ Đã lưu thành công vào Bảng Xếp Hạng!
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={startGame}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition shadow-lg"
            >
              <RotateCcw className="h-4 w-4" /> Thử sức lại ván mới
            </button>
          </div>
        </div>
      )}

      {/* Bảng Xếp Hạng Top 10 */}
      <div className="card mt-6 p-6 sm:p-7">
        <h3 className="flex items-center justify-between text-lg font-bold text-slate-900">
          <span className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Bảng Vàng Vận Động Viên Xuất Sắc
          </span>
          <button
            onClick={() => void loadScores()}
            className="text-xs font-semibold text-geoenv-600 hover:underline"
          >
            Làm mới
          </button>
        </h3>

        {scoresError ? (
          <p className="mt-3 text-sm text-slate-500">
            Bảng xếp hạng sẽ sẵn sàng sau khi kích hoạt cơ sở dữ liệu điểm.
          </p>
        ) : scores === null ? (
          <p className="mt-3 text-sm text-slate-500">Đang tải bảng xếp hạng…</p>
        ) : scores.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có thành tích nào — hãy là người đầu tiên ghi danh!</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {scores.map((row, i) => (
              <li
                key={row.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  i === 0
                    ? 'bg-amber-50/80 border border-amber-200'
                    : i === 1
                    ? 'bg-slate-100/80 border border-slate-200'
                    : i === 2
                    ? 'bg-orange-50/60 border border-orange-200'
                    : 'bg-slate-50'
                }`}
              >
                <span
                  className={`w-7 text-center text-base font-black tabular-nums ${
                    i === 0 ? 'text-amber-600' : i === 1 ? 'text-slate-500' : i === 2 ? 'text-amber-700' : 'text-slate-400'
                  }`}
                >
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900">{row.player_name}</span>
                  {row.team_name && <span className="text-slate-500 font-medium"> · Đội {row.team_name}</span>}
                  <span className="block text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span className="text-base font-black tabular-nums text-geoenv-700">{row.score} m</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
