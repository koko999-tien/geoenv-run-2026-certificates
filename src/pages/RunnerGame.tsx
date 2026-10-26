import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Flame,
  Award,
  Copy,
  Check,
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

type Phase = 'ready' | 'playing' | 'paused' | 'over';
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

interface SkidMark {
  x: number;
  w: number;
  alpha: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

interface RoundStats {
  score: number;
  distance: number;
  bottles: number;
  medals: number;
  maxSpeedKmh: number;
  maxCombo: number;
  rank: 'S' | 'A' | 'B' | 'C';
  rankTitle: string;
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
   Phiên bản V3: Chuyển cảnh mượt mà (smooth lerp), cực quang, sao băng,
   bầy chim bay, đom đóm đêm, cỏ lau lay, cầu vồng, tia nắng, phản chiếu
   nước, hàng rào khán giả, khán giả cổ vũ, biển quảng cáo.
   ========================================================================= */

/* Helper nội suy mượt giữa hai hex color theo t ∈ [0,1] */
function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) * (1 - t) + ((pb >> 16) & 0xff) * t);
  const g = Math.round(((pa >> 8) & 0xff) * (1 - t) + ((pb >> 8) & 0xff) * t);
  const bl = Math.round((pa & 0xff) * (1 - t) + (pb & 0xff) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/* Helper vẽ ngôi sao 5 cánh thật */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spikes = 5) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.4;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

function drawEnvironment(ctx: CanvasRenderingContext2D, distance: number, frame: number) {
  /* ---- Tính toán thời gian trong ngày với nội suy mượt ---- */
  const timeProgress = (distance % 4200) / 4200;

  // Pha: 0→0.30 Ngày, 0.30→0.45 Chuyển hoàng hôn, 0.45→0.60 Hoàng hôn,
  //       0.60→0.72 Chuyển đêm, 0.72→1.0 Đêm
  let skyTop: string, skyMid: string, skyBot: string;
  let sunMoonColor: string, sunMoonGlow: string;
  let mountainFar: string, mountainNear: string;
  let treeFoliage: string, grassBright: string, grassDark: string;
  let isNight = false;
  let isSunset = false;
  let nightT = 0; // 0‒1 cho cường độ đêm (dùng cho sao, đom đóm…)

  if (timeProgress <= 0.30) {
    // Ban ngày
    skyTop = '#38bdf8'; skyMid = '#bae6fd'; skyBot = '#f0f9ff';
    sunMoonColor = '#fef08a'; sunMoonGlow = 'rgba(254, 240, 138, 0.35)';
    mountainFar = '#93c5fd'; mountainNear = '#60a5fa';
    treeFoliage = '#10b981'; grassBright = '#22c55e'; grassDark = '#15803d';
  } else if (timeProgress <= 0.45) {
    // Chuyển cảnh ngày → hoàng hôn (lerp mượt)
    isSunset = true;
    const t = (timeProgress - 0.30) / 0.15;
    skyTop = lerpColor('#38bdf8', '#f97316', t);
    skyMid = lerpColor('#bae6fd', '#fb923c', t);
    skyBot = lerpColor('#f0f9ff', '#fed7aa', t);
    sunMoonColor = lerpColor('#fef08a', '#fbbf24', t);
    sunMoonGlow = `rgba(251, ${Math.round(240 - 94 * t)}, ${Math.round(138 - 78 * t)}, ${(0.35 + 0.05 * t).toFixed(2)})`;
    mountainFar = lerpColor('#93c5fd', '#a855f7', t);
    mountainNear = lerpColor('#60a5fa', '#7c3aed', t);
    treeFoliage = lerpColor('#10b981', '#6d28d9', t);
    grassBright = lerpColor('#22c55e', '#a855f7', t);
    grassDark = lerpColor('#15803d', '#6d28d9', t);
  } else if (timeProgress <= 0.60) {
    // Hoàng hôn
    isSunset = true;
    const t = (timeProgress - 0.45) / 0.15;
    skyTop = lerpColor('#f97316', '#c026d3', t);
    skyMid = lerpColor('#fb923c', '#f43f5e', t);
    skyBot = '#fed7aa';
    sunMoonColor = '#fbbf24'; sunMoonGlow = 'rgba(251, 146, 60, 0.4)';
    mountainFar = lerpColor('#a855f7', '#7e22ce', t);
    mountainNear = lerpColor('#7c3aed', '#581c87', t);
    treeFoliage = '#6d28d9'; grassBright = '#a855f7'; grassDark = '#6d28d9';
  } else if (timeProgress <= 0.72) {
    // Chuyển cảnh hoàng hôn → đêm
    isNight = true;
    nightT = (timeProgress - 0.60) / 0.12;
    skyTop = lerpColor('#c026d3', '#090d16', nightT);
    skyMid = lerpColor('#f43f5e', '#172554', nightT);
    skyBot = lerpColor('#fed7aa', '#1e3a8a', nightT);
    sunMoonColor = lerpColor('#fbbf24', '#f1f5f9', nightT);
    sunMoonGlow = `rgba(241, 245, 249, ${(0.15 + 0.25 * nightT).toFixed(2)})`;
    mountainFar = lerpColor('#7e22ce', '#1e293b', nightT);
    mountainNear = lerpColor('#581c87', '#0f172a', nightT);
    treeFoliage = lerpColor('#6d28d9', '#064e3b', nightT);
    grassBright = lerpColor('#a855f7', '#065f46', nightT);
    grassDark = lerpColor('#6d28d9', '#064e3b', nightT);
  } else {
    // Đêm tối
    isNight = true; nightT = 1;
    skyTop = '#090d16'; skyMid = '#172554'; skyBot = '#1e3a8a';
    sunMoonColor = '#f1f5f9'; sunMoonGlow = 'rgba(241, 245, 249, 0.4)';
    mountainFar = '#1e293b'; mountainNear = '#0f172a';
    treeFoliage = '#064e3b'; grassBright = '#065f46'; grassDark = '#064e3b';
  }

  /* ==================== 1. BẦU TRỜI GRADIENT ==================== */
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(0.55, skyMid);
  sky.addColorStop(1, skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  /* ==================== 2. SAO ĐÊM + SAO BĂNG + CỰC QUANG ==================== */
  if (isNight || nightT > 0) {
    const starAlphaBase = nightT;
    // Ngàn sao lấp lánh 3 lớp (sáng, trung bình, mờ)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 55; i++) {
      const sx = (i * 83 + distance * 0.015) % W;
      const sy = 8 + ((i * 41 + i * i * 7) % (GROUND - 100));
      const layerR = i < 10 ? 2.2 : i < 25 ? 1.4 : 0.9;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(distance * 0.025 + i * 1.7));
      ctx.globalAlpha = Math.max(0.05, starAlphaBase * twinkle);
      if (i < 5) {
        // Sao sáng nhất vẽ hình ngôi sao thật
        ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#e0f2fe';
        drawStar(ctx, sx, sy, layerR + 1.5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, layerR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // Sao băng (xuất hiện ngẫu nhiên mỗi ~3 giây)
    const shootCycle = Math.floor(frame / 180);
    const shootPhase = (frame % 180) / 180;
    if (shootPhase < 0.25) {
      const sx0 = 200 + (shootCycle * 317) % 600;
      const sy0 = 15 + (shootCycle * 131) % 60;
      const len = 80 + (shootCycle * 53) % 50;
      const progress = shootPhase / 0.25;
      const headX = sx0 + len * progress;
      const headY = sy0 + len * 0.4 * progress;
      const tailLen = 45 * Math.min(1, progress * 3);
      const grad = ctx.createLinearGradient(headX, headY, headX - tailLen, headY - tailLen * 0.4);
      grad.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * starAlphaBase).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX, headY);
      ctx.lineTo(headX - tailLen, headY - tailLen * 0.4);
      ctx.stroke();
    }

    // Cực quang (Aurora Borealis) — dải sóng xanh lục mờ ảo uốn lượn
    if (nightT > 0.5) {
      const auroraAlpha = (nightT - 0.5) * 0.5;
      ctx.globalAlpha = auroraAlpha;
      const auroraColors = ['#22d3ee', '#34d399', '#a78bfa', '#67e8f9'];
      for (let band = 0; band < 3; band++) {
        ctx.strokeStyle = auroraColors[band];
        ctx.lineWidth = 18 - band * 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let px = 0; px <= W; px += 8) {
          const ay = 35 + band * 14 + Math.sin(px * 0.006 + distance * 0.004 + band) * 18
            + Math.sin(px * 0.015 + distance * 0.007) * 8;
          if (px === 0) ctx.moveTo(px, ay);
          else ctx.lineTo(px, ay);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }
  }

  /* ==================== 3. MẶT TRỜI / MẶT TRĂNG + TIA NẮNG ==================== */
  const celestialX = 820;
  const celestialY = 55;
  // Tia nắng (sun rays) xoay nhẹ lúc ban ngày / hoàng hôn
  if (!isNight) {
    ctx.save();
    ctx.translate(celestialX, celestialY);
    ctx.rotate(distance * 0.0003);
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (Math.PI * 2 / rayCount) * i;
      const innerR = 32;
      const outerR = 65 + Math.sin(distance * 0.02 + i) * 8;
      const grad = ctx.createLinearGradient(
        Math.cos(angle) * innerR, Math.sin(angle) * innerR,
        Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      grad.addColorStop(0, isSunset ? 'rgba(251, 191, 36, 0.22)' : 'rgba(254, 240, 138, 0.18)');
      grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Hào quang phát sáng nhiều lớp
  ctx.fillStyle = sunMoonGlow;
  ctx.beginPath(); ctx.arc(celestialX, celestialY, 52, 0, Math.PI * 2); ctx.fill();
  if (!isNight) {
    ctx.fillStyle = isSunset ? 'rgba(251, 146, 60, 0.15)' : 'rgba(254, 240, 138, 0.12)';
    ctx.beginPath(); ctx.arc(celestialX, celestialY, 70, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = sunMoonColor;
  ctx.beginPath(); ctx.arc(celestialX, celestialY, 28, 0, Math.PI * 2); ctx.fill();
  if (isNight) {
    // Miệng hố mặt trăng
    ctx.fillStyle = skyTop;
    ctx.beginPath(); ctx.arc(celestialX + 10, celestialY - 4, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200, 200, 200, 0.12)';
    ctx.beginPath(); ctx.arc(celestialX - 8, celestialY + 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(celestialX - 2, celestialY - 8, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Cầu vồng mờ sau mưa (xuất hiện ngẫu nhiên trong chu kỳ)
  if (timeProgress > 0.10 && timeProgress < 0.25) {
    const rainbowAlpha = Math.sin((timeProgress - 0.10) / 0.15 * Math.PI) * 0.18;
    const rainbowColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6'];
    for (let i = 0; i < rainbowColors.length; i++) {
      ctx.strokeStyle = rainbowColors[i];
      ctx.globalAlpha = rainbowAlpha;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(450, GROUND + 120, 230 + i * 5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  /* ==================== 4. MÂY TRÔI 3D (có bóng đổ) ==================== */
  const clouds = [
    { x: 80, y: 55, s: 1.0 },
    { x: 310, y: 32, s: 1.3 },
    { x: 540, y: 68, s: 0.85 },
    { x: 750, y: 42, s: 1.15 },
    { x: 920, y: 58, s: 0.75 },
  ];
  for (const c of clouds) {
    const cx = (((c.x - distance * 0.09) % (W + 300)) + W + 300) % (W + 300) - 150;
    const cy = c.y;
    const s = c.s;
    // Bóng mây mờ
    ctx.fillStyle = isNight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + 5, 38 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 21 * s, cy + 9, 20 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 29 * s, cy + 9, 22 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mây chính
    ctx.fillStyle = isNight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24 * s, cy + 4 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 26 * s, cy + 4 * s, 24 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Viền sáng đỉnh mây (highlight)
    if (!isNight) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy - 6 * s, 22 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ==================== 5. BẦY CHIM BAY (ban ngày / hoàng hôn) ==================== */
  if (!isNight) {
    const birdColor = isSunset ? '#581c87' : '#1e293b';
    ctx.strokeStyle = birdColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const birdData = [
      { ox: 150, oy: 38, count: 4, gap: 22 },
      { ox: 600, oy: 55, count: 3, gap: 18 },
    ];
    for (const flock of birdData) {
      const fx = (((flock.ox - distance * 0.12) % (W + 200)) + W + 200) % (W + 200) - 100;
      for (let b = 0; b < flock.count; b++) {
        const bx = fx + b * flock.gap + Math.sin(frame * 0.06 + b) * 3;
        const by = flock.oy + Math.sin(frame * 0.08 + b * 1.5) * 4 + b * 3;
        const wingFlap = Math.sin(frame * 0.18 + b * 2) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by + wingFlap);
        ctx.quadraticCurveTo(bx, by - 2, bx + 6, by + wingFlap);
        ctx.stroke();
      }
    }
  }

  /* ==================== 6. DÃY NÚI XA (Parallax lớp 1) — có tuyết đỉnh ==================== */
  const farOff = (distance * 0.18) % 480;
  ctx.fillStyle = mountainFar;
  for (let x = -480 - farOff; x < W + 480; x += 480) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + 160, GROUND - 118);
    ctx.lineTo(x + 240, GROUND - 80);
    ctx.lineTo(x + 320, GROUND - 105);
    ctx.lineTo(x + 420, GROUND - 55);
    ctx.lineTo(x + 480, GROUND);
    ctx.closePath();
    ctx.fill();
    // Tuyết đỉnh núi
    if (!isNight) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 148, GROUND - 108);
      ctx.lineTo(x + 160, GROUND - 118);
      ctx.lineTo(x + 172, GROUND - 108);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 310, GROUND - 96);
      ctx.lineTo(x + 320, GROUND - 105);
      ctx.lineTo(x + 330, GROUND - 96);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = mountainFar;
    }
  }

  /* ==================== 7. ĐỒI + CÂY CHI TIẾT (Parallax lớp 2) ==================== */
  const nearOff = (distance * 0.42) % 400;
  ctx.fillStyle = mountainNear;
  for (let x = -400 - nearOff; x < W + 400; x += 400) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.quadraticCurveTo(x + 100, GROUND - 80, x + 200, GROUND - 92);
    ctx.quadraticCurveTo(x + 300, GROUND - 70, x + 400, GROUND);
    ctx.closePath();
    ctx.fill();

    // Cây chi tiết (thân + tán lá nhiều lớp)
    const trees = [
      { tx: x + 90, th: 45, tw: 18 },
      { tx: x + 160, th: 55, tw: 22 },
      { tx: x + 250, th: 38, tw: 16 },
      { tx: x + 340, th: 42, tw: 17 },
    ];
    for (const tree of trees) {
      const treeBaseY = GROUND - 12;
      // Thân cây
      ctx.fillStyle = isNight ? '#3f2b1a' : '#92400e';
      ctx.fillRect(tree.tx - 3, treeBaseY - tree.th + 15, 6, tree.th - 12);
      // Tán lá 3 lớp tròn xếp chồng
      ctx.fillStyle = treeFoliage;
      ctx.beginPath();
      ctx.arc(tree.tx, treeBaseY - tree.th + 8, tree.tw * 0.55, 0, Math.PI * 2);
      ctx.arc(tree.tx - 6, treeBaseY - tree.th + 16, tree.tw * 0.5, 0, Math.PI * 2);
      ctx.arc(tree.tx + 7, treeBaseY - tree.th + 14, tree.tw * 0.48, 0, Math.PI * 2);
      ctx.fill();
      // Highlight lá sáng
      if (!isNight) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.arc(tree.tx + 2, treeBaseY - tree.th + 4, tree.tw * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ==================== 8. TÒA NHÀ HUMG CHI TIẾT ==================== */
  const humgOff = (distance * 0.3) % 900;
  for (let x = -900 - humgOff; x < W + 900; x += 900) {
    if (x + 320 < -120 || x + 320 > W + 120) continue;
    // Tòa nhà chính
    ctx.fillStyle = isNight ? '#1e293b' : '#94a3b8';
    roundRect(ctx, x + 380, GROUND - 95, 85, 95, 4);
    ctx.fill();
    // Tháp clock tower
    roundRect(ctx, x + 405, GROUND - 128, 34, 33, 3);
    ctx.fill();
    // Đỉnh mái tam giác
    ctx.beginPath();
    ctx.moveTo(x + 405, GROUND - 128);
    ctx.lineTo(x + 422, GROUND - 142);
    ctx.lineTo(x + 439, GROUND - 128);
    ctx.closePath();
    ctx.fill();
    // Mặt đồng hồ
    ctx.fillStyle = isNight ? '#fef08a' : '#f8fafc';
    ctx.beginPath();
    ctx.arc(x + 422, GROUND - 115, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isNight ? '#ca8a04' : '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 422, GROUND - 115);
    const hourAngle = (frame * 0.002) % (Math.PI * 2);
    ctx.lineTo(x + 422 + Math.cos(hourAngle) * 5, GROUND - 115 + Math.sin(hourAngle) * 5);
    ctx.stroke();
    // Cửa sổ sáng đèn 3 tầng
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const winOn = isNight ? ((row + col + Math.floor(frame / 120)) % 3 !== 0) : true;
        ctx.fillStyle = isNight
          ? (winOn ? '#fef08a' : '#1e293b')
          : '#f8fafc';
        ctx.fillRect(x + 390 + col * 18, GROUND - 84 + row * 24, 10, 14);
      }
    }
    // Biển trường "HUMG"
    ctx.fillStyle = isNight ? 'rgba(254, 240, 138, 0.6)' : 'rgba(15, 23, 42, 0.6)';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HUMG', x + 422, GROUND - 5);
  }

  /* ==================== 9. CỎ LAU RUNG NHẸ VIỀN ĐƯỜNG ==================== */
  const grassGrad = ctx.createLinearGradient(0, GROUND - 8, 0, GROUND);
  grassGrad.addColorStop(0, grassBright);
  grassGrad.addColorStop(1, grassDark);
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, GROUND - 7, W, 7);

  // Ngọn cỏ lau mảnh lay theo gió
  ctx.strokeStyle = grassBright;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const grassOff = (distance * 1.0) % 24;
  for (let gx = -24 - grassOff; gx < W + 24; gx += 24) {
    const windSway = Math.sin(gx * 0.15 + frame * 0.06) * 4;
    const bladeH = 8 + (gx * 7 + 11) % 6;
    ctx.beginPath();
    ctx.moveTo(gx, GROUND - 6);
    ctx.quadraticCurveTo(gx + windSway * 0.5, GROUND - 6 - bladeH * 0.6, gx + windSway, GROUND - 6 - bladeH);
    ctx.stroke();
  }

  /* ==================== 10. ĐƯỜNG CHẠY TARTAN CHUYÊN NGHIỆP ==================== */
  const track = ctx.createLinearGradient(0, GROUND, 0, H);
  track.addColorStop(0, '#c2410c');
  track.addColorStop(0.15, '#b45309');
  track.addColorStop(0.5, '#9a3412');
  track.addColorStop(1, '#7c2d12');
  ctx.fillStyle = track;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // Họa tiết hạt cao su tartan (chấm nhỏ mô phỏng texture)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  const texOff = (distance * 1.0) % 16;
  for (let ty = GROUND + 4; ty < H; ty += 8) {
    for (let tx = -16 - texOff; tx < W + 16; tx += 16) {
      ctx.fillRect(tx + ((ty * 3) % 7), ty, 2, 2);
    }
  }

  // Vạch biên trắng phản quang kép (2 vạch)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, GROUND, W, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(0, GROUND + 5, W, 1);

  // Số làn chạy
  const laneOff = (distance * 1.0) % 500;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  for (let lx = -500 - laneOff; lx < W + 500; lx += 500) {
    ctx.fillText('1', lx + 200, GROUND + 22);
    ctx.fillText('2', lx + 200, GROUND + 48);
  }

  // Làn phân cách nét đứt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  const dashOff = (distance * 1.0) % 140;
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(i * 140 - dashOff, GROUND + 29, 65, 3);
  }

  /* ==================== 11. CỘT MỐC CỰ LY + CỜ PHƯỚN + BIỂN QC ==================== */
  // Cột mốc cự ly
  const postDist = 580;
  const postOff = (distance * 1.0) % postDist;
  const currKm = Math.floor(distance / postDist) * 100;
  for (let x = -postDist - postOff; x < W + postDist; x += postDist) {
    if (x > -80 && x < W + 80) {
      // Cột trắng bo góc
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, x + 120, GROUND - 35, 26, 35, 3);
      ctx.fill();
      // Đầu đỏ
      ctx.fillStyle = '#ef4444';
      roundRect(ctx, x + 120, GROUND - 35, 26, 9, 3);
      ctx.fill();
      // Số mét
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.max(100, currKm)}m`, x + 133, GROUND - 12);
    }
  }

  // Cờ phướn cổ vũ (2 kiểu luân phiên)
  const bannerOff = (distance * 1.0) % 1100;
  for (let x = -1100 - bannerOff; x < W + 1100; x += 1100) {
    if (x > -150 && x < W + 150) {
      // Cột cờ metallic
      const gradPole = ctx.createLinearGradient(x + 280, 0, x + 284, 0);
      gradPole.addColorStop(0, '#94a3b8');
      gradPole.addColorStop(0.5, '#cbd5e1');
      gradPole.addColorStop(1, '#94a3b8');
      ctx.fillStyle = gradPole;
      ctx.fillRect(x + 280, GROUND - 72, 4, 72);
      // Quả cầu đầu cột
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(x + 282, GROUND - 72, 4, 0, Math.PI * 2); ctx.fill();
      // Lá cờ phấp phới (wave nhiều điểm)
      const t = distance * 0.08;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(x + 284, GROUND - 70);
      for (let px = 0; px <= 54; px += 6) {
        const wy = Math.sin(t + px * 0.12) * 3 + Math.sin(t * 1.5 + px * 0.08) * 1.5;
        ctx.lineTo(x + 284 + px, GROUND - 70 + wy);
      }
      for (let px = 54; px >= 0; px -= 6) {
        const wy = Math.sin(t + px * 0.12) * 3 + Math.sin(t * 1.5 + px * 0.08) * 1.5;
        ctx.lineTo(x + 284 + px, GROUND - 46 + wy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      const textWave = Math.sin(t) * 1.5;
      ctx.fillText('GEOENV', x + 311, GROUND - 55 + textWave);
      ctx.font = '6px sans-serif';
      ctx.fillText('RUN 2026', x + 311, GROUND - 48 + textWave);
    }
  }

  // Biển quảng cáo nhà tài trợ dọc đường
  const adOff = (distance * 1.0) % 1600;
  for (let x = -1600 - adOff; x < W + 1600; x += 1600) {
    if (x + 50 > -100 && x + 50 < W + 100) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      roundRect(ctx, x + 50, GROUND - 52, 110, 28, 4);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏫 ĐH MỎ - ĐỊA CHẤT', x + 105, GROUND - 35);
      ctx.fillStyle = '#475569';
      ctx.font = '7px sans-serif';
      ctx.fillText('HUMG • Khoa Môi trường', x + 105, GROUND - 27);
    }
  }

  /* ==================== 12. HÀNG RÀO + KHÁN GIẢ CỔ VŨ ==================== */
  // Hàng rào barrier
  const barrierOff = (distance * 1.0) % 140;
  ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
  for (let bx = -140 - barrierOff; bx < W + 140; bx += 140) {
    // Trụ rào
    ctx.fillRect(bx + 10, GROUND - 30, 3, 30);
    ctx.fillRect(bx + 50, GROUND - 30, 3, 30);
    // Thanh ngang
    ctx.fillRect(bx + 10, GROUND - 28, 43, 2);
    ctx.fillRect(bx + 10, GROUND - 18, 43, 2);
  }

  // Khán giả cổ vũ ngoài rào (chỉ vẽ đầu + tay vẫy)
  const specOff = (distance * 0.25) % 120;
  const specColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
  for (let sx = -120 - specOff; sx < W + 120; sx += 60) {
    const ci = Math.abs(Math.floor(sx * 0.017)) % specColors.length;
    const specY = GROUND - 38;
    const wave = Math.sin(frame * 0.12 + sx * 0.05) * 3;
    // Đầu tròn
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(sx + 28, specY - 2, 5, 0, Math.PI * 2); ctx.fill();
    // Thân áo
    ctx.fillStyle = specColors[ci];
    ctx.fillRect(sx + 24, specY + 3, 8, 8);
    // Tay vẫy
    ctx.strokeStyle = specColors[ci];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 26, specY + 5);
    ctx.lineTo(sx + 20, specY - 2 + wave);
    ctx.moveTo(sx + 30, specY + 5);
    ctx.lineTo(sx + 36, specY - 2 - wave);
    ctx.stroke();
  }

  /* ==================== 13. ĐOM ĐÓM ĐÊM LUNG LINH ==================== */
  if (isNight && nightT > 0.4) {
    const ffAlpha = (nightT - 0.4) * 1.2;
    for (let i = 0; i < 12; i++) {
      const fx = (i * 113 + frame * 0.3) % W;
      const fy = GROUND - 40 - (i * 31) % 80;
      const brightness = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.04 + i * 2.3));
      ctx.globalAlpha = ffAlpha * brightness;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
      // Hào quang đom đóm
      ctx.fillStyle = 'rgba(254, 240, 138, 0.3)';
      ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}

/* =========================================================================
   HỆ THỐNG VẼ VẬN ĐỘNG VIÊN (RUNNER ANIMATION RIG) V3
   - Chu kỳ chạy 8 bước mượt (sine interpolation)
   - Dải ruy băng bandana & tóc bay theo gió
   - Giọt mồ hôi bay ngược khi chạy nhanh
   - Biểu cảm khuôn mặt (bình thường / quyết tâm / chóng mặt)
   - Dáng cúi trượt với vệt lửa ma sát
   - Nhảy kép với vòng sóng không trung
   - Bóng đổ mềm & hào quang shield/booster nhiều lớp
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
  speed: number,
) {
  ctx.save();

  // 1. Bóng đổ gradient mềm dưới mặt đất
  const heightAbove = GROUND - RUNNER_H - y;
  const shadowScale = sliding ? 1.3 : Math.max(0.25, 1 - heightAbove / 260);
  const shadowAlpha = sliding ? 0.38 : Math.max(0.1, 0.3 * (1 - heightAbove / 300));
  const shadowGrad = ctx.createRadialGradient(
    RUNNER_X + (sliding ? 22 : 18), GROUND + 3, 0,
    RUNNER_X + (sliding ? 22 : 18), GROUND + 3, (sliding ? 30 : 24) * shadowScale,
  );
  shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(
    RUNNER_X + (sliding ? 22 : 18), GROUND + 3,
    (sliding ? 30 : 24) * shadowScale,
    (sliding ? 5 : 5.5) * shadowScale,
    0, 0, Math.PI * 2,
  );
  ctx.fill();

  // 2. Vệt hào quang năng lượng nếu Booster
  if (hasBooster) {
    // Vệt bóng ghost trail nhiều lớp
    for (let gi = 3; gi >= 1; gi--) {
      ctx.fillStyle = `rgba(250, 204, 21, ${0.08 * gi})`;
      ctx.beginPath();
      ctx.ellipse(RUNNER_X + 18 - gi * 12, y + 25 + gi, 22 - gi * 2, 20 - gi, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hào quang sáng chính
    const pulseB = Math.sin(frame * 0.2) * 3;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.beginPath();
    ctx.ellipse(RUNNER_X + 18, y + 25, 36 + pulseB, 30 + pulseB, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============ 3. TƯ THẾ TRƯỢT NGƯỜI (SLIDE) ============
  if (sliding) {
    const slideY = GROUND - 24;

    // Vệt lửa ma sát trượt lướt (tia sáng cam)
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
    ctx.lineWidth = 2;
    for (let fi = 0; fi < 4; fi++) {
      const fx = RUNNER_X + 36 + fi * 3;
      const fy = slideY + 18;
      const fLen = 8 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fLen, fy - 2 - Math.random() * 3);
      ctx.stroke();
    }

    // Chân trượt dài
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 2, slideY + 12);
    ctx.lineTo(RUNNER_X + 38, slideY + 16);
    ctx.stroke();

    // Giày chạy
    ctx.fillStyle = '#ea580c';
    roundRect(ctx, RUNNER_X + 35, slideY + 12, 12, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(RUNNER_X + 37, slideY + 17, 8, 2);

    // Thân áo
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, RUNNER_X + 6, slideY - 2, 28, 16, 5);
    ctx.fill();
    // Sọc ngang áo thể thao
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(RUNNER_X + 6, slideY + 6, 28, 3);

    // BIB 2026
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, RUNNER_X + 14, slideY, 12, 10, 1);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2026', RUNNER_X + 20, slideY + 7);

    // Tay chống phong cách
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 12, slideY + 4);
    ctx.lineTo(RUNNER_X - 2, slideY + 14);
    ctx.stroke();
    // Bàn tay
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(RUNNER_X - 2, slideY + 14, 3, 0, Math.PI * 2); ctx.fill();

    // Đầu
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(RUNNER_X + 34, slideY - 4, 9, 0, Math.PI * 2); ctx.fill();
    // Mắt quyết tâm (nheo lại)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(RUNNER_X + 36, slideY - 6, 4, 2);
    // Miệng nghiến răng
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 37, slideY - 1);
    ctx.lineTo(RUNNER_X + 40, slideY - 1);
    ctx.stroke();

    // Headband + ribbon
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(RUNNER_X + 26, slideY - 8, 14, 4);
    const bandWave = Math.sin(frame * 0.4) * 4;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 26, slideY - 7);
    ctx.quadraticCurveTo(RUNNER_X + 14, slideY - 9 + bandWave, RUNNER_X + 4, slideY - 6 + bandWave);
    ctx.lineTo(RUNNER_X + 4, slideY - 3 + bandWave);
    ctx.quadraticCurveTo(RUNNER_X + 14, slideY - 5 + bandWave, RUNNER_X + 26, slideY - 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  // ============ 4. TƯ THẾ GAME OVER (VẤP NGÃ) ============
  if (isOver) {
    const tumbleY = GROUND - 26;
    ctx.translate(RUNNER_X + 18, tumbleY);
    const tumbleAngle = Math.min(0.65, (frame % 30) * 0.022 + 0.3);
    ctx.rotate(tumbleAngle);

    // Chân giơ lên
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-18, -12);
    ctx.moveTo(4, 10);
    ctx.lineTo(-8, -20);
    ctx.stroke();
    // Giày
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-20, -14, 8, 5);
    ctx.fillRect(-10, -22, 8, 5);

    // Thân áo
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, -10, -6, 22, 20, 6);
    ctx.fill();

    // Đầu
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(8, -18, 9, 0, Math.PI * 2); ctx.fill();

    // Mắt xoáy xoáy chóng mặt (2 vòng tròn xoay)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    const dizzy1 = frame * 0.3;
    const dizzy2 = frame * 0.3 + Math.PI;
    ctx.beginPath();
    ctx.arc(5, -20, 3, dizzy1, dizzy1 + Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(11, -20, 3, dizzy2, dizzy2 + Math.PI * 1.5);
    ctx.stroke();

    // Miệng há hốc
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(8, -14, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Sao bay vòng quanh đầu
    ctx.fillStyle = '#fbbf24';
    for (let si = 0; si < 3; si++) {
      const sa = frame * 0.12 + si * (Math.PI * 2 / 3);
      const starX = 8 + Math.cos(sa) * 14;
      const starY = -22 + Math.sin(sa) * 6;
      drawStar(ctx, starX, starY, 3);
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  // ============ 5. TƯ THẾ CHẠY / NHẢY ============
  const hipY = y + 36;
  // Nội suy mượt giữa các bước (sine curve)
  const rawPhase = (frame % 32) / 32;
  const smoothSwing = Math.sin(rawPhase * Math.PI * 2) * 18;
  const swing = airborne ? 14 : smoothSwing;
  const backSwing = airborne ? -12 : -smoothSwing;

  // Chân sau + đầu gối (2 đoạn)
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const kneeBackX = RUNNER_X + 19 + backSwing * 0.5;
  const kneeBackY = y + 42;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 19, hipY);
  ctx.lineTo(kneeBackX, kneeBackY);
  ctx.lineTo(RUNNER_X + 19 + backSwing, y + 49);
  ctx.stroke();

  // Giày sau (chi tiết hơn)
  ctx.fillStyle = '#ea580c';
  roundRect(ctx, RUNNER_X + 15 + backSwing, y + 47, 11, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(RUNNER_X + 17 + backSwing, y + 50, 7, 2);

  // Chân trước + đầu gối
  const kneeFrontX = RUNNER_X + 15 + swing * 0.5;
  const kneeFrontY = y + 42;
  ctx.strokeStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 15, hipY);
  ctx.lineTo(kneeFrontX, kneeFrontY);
  ctx.lineTo(RUNNER_X + 15 + swing, y + 49);
  ctx.stroke();

  // Giày trước
  ctx.fillStyle = '#f97316';
  roundRect(ctx, RUNNER_X + 11 + swing, y + 47, 12, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(RUNNER_X + 13 + swing, y + 50, 8, 2);

  // Quần short thể thao
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, RUNNER_X + 9, y + 30, 21, 10, 4);
  ctx.fill();

  // Thân áo GEOENV xanh thể thao
  ctx.fillStyle = '#0284c7';
  roundRect(ctx, RUNNER_X + 7, y + 14, 24, 20, 7);
  ctx.fill();
  // Sọc bên sườn áo (chi tiết thể thao)
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(RUNNER_X + 7, y + 24, 3, 10);
  ctx.fillRect(RUNNER_X + 28, y + 24, 3, 10);
  // Cổ áo
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(RUNNER_X + 14, y + 13, 10, 3);

  // Số BIB "2026" viền
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, RUNNER_X + 12, y + 19, 14, 11, 1);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2026', RUNNER_X + 19, y + 27);

  // Tay sau
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 11, y + 18);
  ctx.lineTo(RUNNER_X + 11 + backSwing * 0.85, y + 31);
  ctx.stroke();
  // Bàn tay sau
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath(); ctx.arc(RUNNER_X + 11 + backSwing * 0.85, y + 31, 2.5, 0, Math.PI * 2); ctx.fill();

  // Tay trước
  ctx.strokeStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 27, y + 18);
  ctx.lineTo(RUNNER_X + 27 + swing * 0.85, y + 31);
  ctx.stroke();
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath(); ctx.arc(RUNNER_X + 27 + swing * 0.85, y + 31, 2.5, 0, Math.PI * 2); ctx.fill();

  // Cổ
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(RUNNER_X + 17, y + 11, 4, 5);

  // Đầu
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath(); ctx.arc(RUNNER_X + 20, y + 7, 10, 0, Math.PI * 2); ctx.fill();

  // Tai
  ctx.fillStyle = '#f5c542';
  ctx.beginPath(); ctx.arc(RUNNER_X + 10, y + 8, 3, 0, Math.PI * 2); ctx.fill();

  // Mái tóc thể thao (có chiều sâu)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(RUNNER_X + 20, y + 4, 10, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();
  // Mớ tóc bay
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 12, y + 2);
  ctx.quadraticCurveTo(RUNNER_X + 6, y + 1 + Math.sin(frame * 0.3) * 2, RUNNER_X + 4, y + 4);
  ctx.lineTo(RUNNER_X + 12, y + 5);
  ctx.closePath();
  ctx.fill();

  // Mắt (nheo khi tốc độ cao, tròn bình thường)
  if (speed > 10) {
    // Nheo mắt quyết tâm
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 22, y + 5);
    ctx.lineTo(RUNNER_X + 26, y + 6);
    ctx.stroke();
  } else {
    // Mắt tròn
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(RUNNER_X + 24, y + 6, 2, 0, Math.PI * 2); ctx.fill();
    // Tròng mắt sáng
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(RUNNER_X + 24.5, y + 5.5, 0.8, 0, Math.PI * 2); ctx.fill();
  }

  // Miệng (mở to khi nhảy, nghiến răng khi nhanh)
  if (airborne) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(RUNNER_X + 24, y + 11, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (speed > 10) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(RUNNER_X + 23, y + 11);
    ctx.lineTo(RUNNER_X + 26, y + 10.5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(RUNNER_X + 24, y + 10, 2, 0, Math.PI);
    ctx.stroke();
  }

  // Má hồng (blush)
  ctx.fillStyle = 'rgba(248, 113, 113, 0.3)';
  ctx.beginPath(); ctx.arc(RUNNER_X + 26, y + 9, 2.5, 0, Math.PI * 2); ctx.fill();

  // Băng đô thể thao đỏ
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(RUNNER_X + 10, y + 2, 20, 4);

  // Dải ruy băng bay + đuôi ribbon dài hơn
  const ribbonWave = Math.sin(frame * 0.35) * 5;
  const ribbonWave2 = Math.sin(frame * 0.5 + 1) * 3;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 10, y + 3);
  ctx.quadraticCurveTo(RUNNER_X - 4, y + 2 + ribbonWave, RUNNER_X - 16, y + 5 + ribbonWave);
  ctx.quadraticCurveTo(RUNNER_X - 22, y + 7 + ribbonWave2, RUNNER_X - 26, y + 4 + ribbonWave2);
  ctx.lineTo(RUNNER_X - 25, y + 8 + ribbonWave2);
  ctx.quadraticCurveTo(RUNNER_X - 20, y + 10 + ribbonWave2, RUNNER_X - 15, y + 8 + ribbonWave);
  ctx.quadraticCurveTo(RUNNER_X - 4, y + 6 + ribbonWave, RUNNER_X + 10, y + 7);
  ctx.closePath();
  ctx.fill();

  // Giọt mồ hôi bay ngược khi tốc độ cao
  if (speed > 7 && !airborne) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    const sweatPhase = (frame * 0.15) % (Math.PI * 2);
    const sweatX = RUNNER_X + 8 - Math.sin(sweatPhase) * 8;
    const sweatY = y + 2 - Math.abs(Math.cos(sweatPhase)) * 10;
    ctx.beginPath();
    ctx.moveTo(sweatX, sweatY);
    ctx.quadraticCurveTo(sweatX - 1.5, sweatY + 3, sweatX, sweatY + 5);
    ctx.quadraticCurveTo(sweatX + 1.5, sweatY + 3, sweatX, sweatY);
    ctx.fill();
    if (speed > 10) {
      const sw2X = sweatX + 6;
      const sw2Y = sweatY + 3;
      ctx.beginPath();
      ctx.moveTo(sw2X, sw2Y);
      ctx.quadraticCurveTo(sw2X - 1, sw2Y + 2, sw2X, sw2Y + 3.5);
      ctx.quadraticCurveTo(sw2X + 1, sw2Y + 2, sw2X, sw2Y);
      ctx.fill();
    }
  }

  // 6. HÀO QUANG KHIÊN BẢO VỆ (SHIELD BUBBLE) — nâng cấp đẹp hơn
  if (hasShield) {
    const pulse = Math.sin(frame * 0.15) * 3;
    const shieldR = 32 + pulse;
    // Hào quang nhiều lớp gradient
    const shieldGrad = ctx.createRadialGradient(
      RUNNER_X + 19, y + 24, shieldR * 0.6,
      RUNNER_X + 19, y + 24, shieldR,
    );
    shieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.02)');
    shieldGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
    shieldGrad.addColorStop(1, 'rgba(56, 189, 248, 0.3)');
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.arc(RUNNER_X + 19, y + 24, shieldR, 0, Math.PI * 2);
    ctx.fill();
    // Viền sáng
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Highlight phản chiếu
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(RUNNER_X + 12, y + 14, shieldR * 0.7, Math.PI * 1.2, Math.PI * 1.7);
    ctx.stroke();

    // 3 ngôi sao quay quanh khiên
    for (let si = 0; si < 3; si++) {
      const sa = frame * 0.08 + si * (Math.PI * 2 / 3);
      const sx = RUNNER_X + 19 + Math.cos(sa) * (shieldR + 2);
      const sy = y + 24 + Math.sin(sa) * (shieldR + 2);
      ctx.fillStyle = '#ffffff';
      drawStar(ctx, sx, sy, 3);
      ctx.fill();
    }
  }

  ctx.restore();
}

/* =========================================================================
   HỆ THỐNG VẼ CHƯỚNG NGẠI VẬT & VẬT PHẨM V3
   - Tất cả chướng ngại vật có bóng đổ mềm
   - Vật phẩm có hào quang phát sáng (glow) + hiệu ứng xoay/lấp lánh
   - Chai nước có bọt khí, huy chương có dây đeo, shield có vòng năng lượng
   ========================================================================= */

function drawObstacle(ctx: CanvasRenderingContext2D, ob: Obstacle, frame: number) {
  const { w, h, yOffset } = OB_CONFIG[ob.kind];
  const y = GROUND - yOffset;

  // Bóng đổ mềm cho tất cả chướng ngại vật
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(ob.x + w / 2 + 3, GROUND + 2, w / 2 + 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (ob.kind === 'hurdle') {
    // Rào chắn thể thao — nâng cấp với gradient và viền metallic
    // Chân đế kim loại
    ctx.fillStyle = '#475569';
    roundRect(ctx, ob.x - 5, GROUND - 5, 13, 5, 1);
    ctx.fill();
    roundRect(ctx, ob.x + w - 8, GROUND - 5, 13, 5, 1);
    ctx.fill();
    // Trụ đứng gradient metallic
    const poleMetal = ctx.createLinearGradient(ob.x + 2, 0, ob.x + 6, 0);
    poleMetal.addColorStop(0, '#94a3b8');
    poleMetal.addColorStop(0.5, '#cbd5e1');
    poleMetal.addColorStop(1, '#94a3b8');
    ctx.fillStyle = poleMetal;
    ctx.fillRect(ob.x + 2, y + 8, 4, h - 8);
    ctx.fillRect(ob.x + w - 6, y + 8, 4, h - 8);
    // Thanh rào chắn gradient cam
    const barGrad = ctx.createLinearGradient(0, y, 0, y + 10);
    barGrad.addColorStop(0, '#f97316');
    barGrad.addColorStop(0.5, '#ea580c');
    barGrad.addColorStop(1, '#c2410c');
    ctx.fillStyle = barGrad;
    roundRect(ctx, ob.x - 3, y, w + 6, 11, 3);
    ctx.fill();
    // Sọc phản quang trắng
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ob.x + 3, y + 1, 7, 9, 2); ctx.fill();
    roundRect(ctx, ob.x + w - 10, y + 1, 7, 9, 2); ctx.fill();
    // Viền sáng đỉnh rào
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ob.x - 2, y + 1);
    ctx.lineTo(ob.x + w + 2, y + 1);
    ctx.stroke();
  } else if (ob.kind === 'rock') {
    // Tảng đá địa chất 3D — nhiều lớp, vân đá, rêu, chi tiết khoáng vật
    // Thân đá tối
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(ob.x - 2, GROUND);
    ctx.lineTo(ob.x + 5, y + 10);
    ctx.lineTo(ob.x + 14, y + 3);
    ctx.lineTo(ob.x + 22, y);
    ctx.lineTo(ob.x + 30, y + 6);
    ctx.lineTo(ob.x + w + 2, GROUND);
    ctx.closePath();
    ctx.fill();
    // Mặt sáng (highlight face)
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(ob.x + 14, y + 3);
    ctx.lineTo(ob.x + 22, y);
    ctx.lineTo(ob.x + 30, y + 6);
    ctx.lineTo(ob.x + 26, y + 14);
    ctx.lineTo(ob.x + 16, y + 12);
    ctx.closePath();
    ctx.fill();
    // Phản chiếu sáng đỉnh
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(ob.x + 18, y + 1);
    ctx.lineTo(ob.x + 22, y);
    ctx.lineTo(ob.x + 26, y + 4);
    ctx.lineTo(ob.x + 22, y + 6);
    ctx.closePath();
    ctx.fill();
    // Vân đá (crack lines)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ob.x + 12, y + 8);
    ctx.lineTo(ob.x + 18, y + 16);
    ctx.lineTo(ob.x + 24, y + 20);
    ctx.stroke();
    // Rêu xanh
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(ob.x + 18, y + 2, 4, Math.PI, 0);
    ctx.fill();
    // Chấm khoáng vật lấp lánh
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(ob.x + 10, y + 12, 1.2, 0, Math.PI * 2);
    ctx.arc(ob.x + 28, y + 10, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (ob.kind === 'puddle') {
    // Vũng nước — phản chiếu bầu trời, sóng gợn đồng tâm, bọt khí
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 3, w / 2 + 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lớp trong (sâu hơn)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 3, w / 2 - 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Phản chiếu mặt trời / trăng nhỏ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2 - 6, GROUND - 5, 5, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Sóng gợn đồng tâm lan tỏa
    const rippleT = (frame * 0.06) % 1;
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.6 * (1 - rippleT)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 3, (w / 2 - 2) * (0.3 + 0.7 * rippleT), (3 + 4 * rippleT), 0, 0, Math.PI * 2);
    ctx.stroke();
    const ripple2T = ((frame * 0.06 + 0.5) % 1);
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.4 * (1 - ripple2T)})`;
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND - 3, (w / 2) * (0.2 + 0.8 * ripple2T), (2 + 5 * ripple2T), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ob.kind === 'drone') {
    // Drone bay quay phim — nâng cấp với bóng đổ, cánh quạt quay, antenna
    const droneY = y + Math.sin(frame * 0.15) * 6;
    // Bóng đổ drone trên mặt đất
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(ob.x + w / 2, GROUND + 2, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cần nối cánh quạt
    ctx.fillStyle = '#475569';
    ctx.fillRect(ob.x + 3, droneY - 2, 3, 5);
    ctx.fillRect(ob.x + w - 6, droneY - 2, 3, 5);
    // Cánh quạt quay tít (motion blur)
    const propAngle = frame * 0.5;
    ctx.save();
    for (const px of [ob.x + 5, ob.x + w - 5]) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.55)';
      ctx.beginPath();
      ctx.ellipse(px, droneY - 5, 12, 2.5, propAngle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Thân drone gradient
    const droneGrad = ctx.createLinearGradient(0, droneY, 0, droneY + 14);
    droneGrad.addColorStop(0, '#334155');
    droneGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = droneGrad;
    roundRect(ctx, ob.x + 3, droneY, w - 6, 15, 5);
    ctx.fill();
    // Viền sáng thân drone
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Ống kính camera
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(ob.x + w / 2, droneY + 13, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(ob.x + w / 2, droneY + 13, 3.5, 0, Math.PI * 2); ctx.fill();
    // Phản chiếu ống kính
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath(); ctx.arc(ob.x + w / 2 - 1, droneY + 12, 1.2, 0, Math.PI * 2); ctx.fill();
    // LED nhấp nháy
    const led1 = frame % 20 < 10 ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
    const led2 = frame % 20 < 10 ? 'rgba(34, 197, 94, 0.2)' : '#22c55e';
    ctx.fillStyle = led1;
    ctx.beginPath(); ctx.arc(ob.x + 6, droneY + 6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = led2;
    ctx.beginPath(); ctx.arc(ob.x + w - 6, droneY + 6, 2.5, 0, Math.PI * 2); ctx.fill();
    // Hào quang LED
    if (frame % 20 < 10) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.beginPath(); ctx.arc(ob.x + 6, droneY + 6, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.beginPath(); ctx.arc(ob.x + w - 6, droneY + 6, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Antenna nhỏ
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ob.x + w / 2, droneY);
    ctx.lineTo(ob.x + w / 2, droneY - 8);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(ob.x + w / 2, droneY - 8, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, frame: number) {
  const bobY = item.y + Math.sin(frame * 0.1 + item.bob) * 5;
  const glowPhase = Math.sin(frame * 0.12 + item.bob) * 0.4 + 0.6;

  if (item.kind === 'bottle') {
    // Hào quang nhẹ
    ctx.fillStyle = `rgba(125, 211, 252, ${0.15 * glowPhase})`;
    ctx.beginPath(); ctx.arc(item.x + 7, bobY + 10, 18, 0, Math.PI * 2); ctx.fill();
    // Chai nước sport — nắp, thân, nhãn, bọt khí
    // Nắp chai
    ctx.fillStyle = '#0ea5e9';
    roundRect(ctx, item.x + 3, bobY - 6, 9, 6, 2);
    ctx.fill();
    // Thân chai
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, item.x, bobY, 15, 24, 4);
    ctx.fill();
    // Nước bên trong (gradient)
    const waterGrad = ctx.createLinearGradient(0, bobY + 6, 0, bobY + 22);
    waterGrad.addColorStop(0, '#0ea5e9');
    waterGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = waterGrad;
    roundRect(ctx, item.x + 2, bobY + 6, 11, 16, 3);
    ctx.fill();
    // Nhãn chai
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(item.x + 2, bobY + 10, 11, 6);
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H₂O', item.x + 7, bobY + 15);
    // Phản chiếu sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(item.x + 2, bobY + 1, 3, 12);
    // Bọt khí
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const bubblePhase = (frame * 0.1 + item.bob) % (Math.PI * 2);
    ctx.beginPath(); ctx.arc(item.x + 6, bobY + 8 - Math.abs(Math.sin(bubblePhase)) * 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 12 - Math.abs(Math.sin(bubblePhase + 1)) * 3, 1, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'medal') {
    // Hào quang vàng
    ctx.fillStyle = `rgba(251, 191, 36, ${0.2 * glowPhase})`;
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 20, 0, Math.PI * 2); ctx.fill();
    // Dây đeo huy chương (ribbon)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(item.x + 5, bobY - 2);
    ctx.quadraticCurveTo(item.x + 10, bobY - 8, item.x + 15, bobY - 2);
    ctx.stroke();
    // Huy chương ngoài
    const medalGrad = ctx.createRadialGradient(item.x + 10, bobY + 9, 2, item.x + 10, bobY + 10, 12);
    medalGrad.addColorStop(0, '#fde68a');
    medalGrad.addColorStop(0.6, '#fbbf24');
    medalGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = medalGrad;
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 12, 0, Math.PI * 2); ctx.fill();
    // Viền huy chương
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Mặt huy chương trong
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 8, 0, Math.PI * 2); ctx.fill();
    // Ngôi sao 5 cánh
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, item.x + 10, bobY + 10, 5);
    ctx.fill();
    // Phản chiếu sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath(); ctx.arc(item.x + 7, bobY + 7, 4, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'shield') {
    // Vòng năng lượng xoay
    const shieldAngle = frame * 0.06;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 * glowPhase})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 16 + glowPhase * 2, shieldAngle, shieldAngle + Math.PI * 1.5);
    ctx.stroke();
    // Hào quang xanh
    ctx.fillStyle = `rgba(56, 189, 248, ${0.18 * glowPhase})`;
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 18, 0, Math.PI * 2); ctx.fill();
    // Viên ngọc xanh gradient
    const shieldGem = ctx.createRadialGradient(item.x + 8, bobY + 8, 2, item.x + 10, bobY + 10, 10);
    shieldGem.addColorStop(0, '#67e8f9');
    shieldGem.addColorStop(0.5, '#0ea5e9');
    shieldGem.addColorStop(1, '#0369a1');
    ctx.fillStyle = shieldGem;
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 10, 0, Math.PI * 2); ctx.fill();
    // Hình khiên bên trong
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(item.x + 10, bobY + 3);
    ctx.lineTo(item.x + 17, bobY + 7);
    ctx.lineTo(item.x + 15, bobY + 15);
    ctx.lineTo(item.x + 10, bobY + 18);
    ctx.lineTo(item.x + 5, bobY + 15);
    ctx.lineTo(item.x + 3, bobY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(item.x + 10, bobY + 5);
    ctx.lineTo(item.x + 15, bobY + 8);
    ctx.lineTo(item.x + 13, bobY + 14);
    ctx.lineTo(item.x + 10, bobY + 16);
    ctx.lineTo(item.x + 7, bobY + 14);
    ctx.lineTo(item.x + 5, bobY + 8);
    ctx.closePath();
    ctx.fill();
    // Phản chiếu
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(item.x + 7, bobY + 7, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'booster') {
    // Hào quang vàng xoay
    const boostAngle = frame * 0.08;
    ctx.strokeStyle = `rgba(234, 179, 8, ${0.4 * glowPhase})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 18, boostAngle, boostAngle + Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(item.x + 10, bobY + 10, 18, boostAngle + Math.PI, boostAngle + Math.PI * 2.2);
    ctx.stroke();
    // Hào quang sáng
    ctx.fillStyle = `rgba(250, 204, 21, ${0.2 * glowPhase})`;
    ctx.beginPath(); ctx.arc(item.x + 10, bobY + 10, 20, 0, Math.PI * 2); ctx.fill();
    // Lon nước tăng lực
    const boostGrad = ctx.createLinearGradient(item.x + 2, bobY, item.x + 18, bobY);
    boostGrad.addColorStop(0, '#ca8a04');
    boostGrad.addColorStop(0.5, '#eab308');
    boostGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = boostGrad;
    roundRect(ctx, item.x + 2, bobY, 16, 22, 4);
    ctx.fill();
    // Viền metallic
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Nhãn sét
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(item.x + 11, bobY + 3);
    ctx.lineTo(item.x + 7, bobY + 11);
    ctx.lineTo(item.x + 10, bobY + 11);
    ctx.lineTo(item.x + 9, bobY + 19);
    ctx.lineTo(item.x + 13, bobY + 11);
    ctx.lineTo(item.x + 10, bobY + 11);
    ctx.closePath();
    ctx.fill();
    // Phản chiếu sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(item.x + 3, bobY + 1, 3, 14);
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
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [copied, setCopied] = useState(false);
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
    maxCombo: 1,
    maxSpeed: 4.8,
    bottlesCount: 0,
    medalsCount: 0,
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
    skidMarks: [] as SkidMark[],
    shockwaves: [] as Shockwave[],
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

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setPhaseBoth('paused');
    } else if (phaseRef.current === 'paused') {
      setPhaseBoth('playing');
    }
  }, []);

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
      maxCombo: 1,
      maxSpeed: 4.8,
      bottlesCount: 0,
      medalsCount: 0,
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
      skidMarks: [],
      shockwaves: [],
      floatingTexts: [],
    };
    setActiveBooster(false);
    setActiveShield(false);
    setCopied(false);
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
    const dist = Math.floor(g.current.distance);
    const maxSpd = Number((g.current.maxSpeed * 3.2).toFixed(1));
    let rank: 'S' | 'A' | 'B' | 'C' = 'C';
    let rankTitle = '🥉 VĐV Triển Vọng';
    if (score >= 3000) {
      rank = 'S';
      rankTitle = '🏆 Kỷ Lục Gia';
    } else if (score >= 1500) {
      rank = 'A';
      rankTitle = '🥇 VĐV Xuất Sắc';
    } else if (score >= 800) {
      rank = 'B';
      rankTitle = '🥈 VĐV Bền Bỉ';
    }
    setRoundStats({
      score,
      distance: dist,
      bottles: g.current.bottlesCount,
      medals: g.current.medalsCount,
      maxSpeedKmh: maxSpd,
      maxCombo: g.current.maxCombo,
      rank,
      rankTitle,
    });
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
              // Vòng sóng xung kích tiếp đất (Shockwave)
              s.shockwaves.push({
                x: RUNNER_X + 18,
                y: GROUND + 1,
                r: 4,
                maxR: 28,
                alpha: 0.7,
              });
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
          if (s.speed > s.maxSpeed) s.maxSpeed = s.speed;

          // Điểm & Quãng đường
          const pointInc = s.speed * 0.24 * s.combo;
          s.score += pointInc;
          s.distance += s.speed;

          // Vết trượt bánh cao su khi cúi trượt (Skid marks)
          if (s.sliding && s.frame % 3 === 0) {
            s.skidMarks.push({
              x: RUNNER_X + 18,
              w: 16,
              alpha: 0.45,
            });
          }

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

          // Cập nhật vệt trượt cao su (Skid marks) & sóng xung kích (Shockwaves)
          for (const sm of s.skidMarks) {
            sm.x -= s.speed;
            sm.alpha -= 0.012;
          }
          s.skidMarks = s.skidMarks.filter((sm) => sm.alpha > 0 && sm.x + sm.w > 0);

          for (const sw of s.shockwaves) {
            sw.r += 1.8;
            sw.alpha -= 0.035;
          }
          s.shockwaves = s.shockwaves.filter((sw) => sw.alpha > 0);

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
                s.bottlesCount++;
                s.comboStreak++;
                if (s.comboStreak % 3 === 0) s.combo = Math.min(3, s.combo + 0.5);
                if (s.combo > s.maxCombo) s.maxCombo = s.combo;
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
                s.medalsCount++;
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
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
          canvas.width = Math.floor(W * dpr);
          canvas.height = Math.floor(H * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
        drawEnvironment(ctx, s.distance, s.frame);

        // 1b. Vẽ vệt trượt cao su (Skid marks) trên mặt đường
        for (const sm of s.skidMarks) {
          ctx.fillStyle = `rgba(30, 20, 10, ${sm.alpha * 0.45})`;
          ctx.fillRect(sm.x, GROUND + 1, sm.w, 3);
        }

        // 1c. Vẽ sóng xung kích tiếp đất (Shockwaves)
        for (const sw of s.shockwaves) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${sw.alpha * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(sw.x, sw.y, sw.r, sw.r * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

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
          s.speed,
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
          // Vệt gió ngắn phía dưới gần đường
          if (s.speed > 11) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
              const ly2 = GROUND + 8 + ((i * 31 + s.frame * 5) % 40);
              const lx2 = ((i * 173 + s.frame * 10) % (W + 150)) - 75;
              ctx.beginPath();
              ctx.moveTo(lx2, ly2);
              ctx.lineTo(lx2 + 45, ly2);
              ctx.stroke();
            }
          }
        }

        // 6b. VIGNETTE — hiệu ứng tối viền khung hình cinematic
        const vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
        vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, W, H);

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

        // 8b. THANH CỰ LY MINI (Mini Milestone Progress Bar ở giữa đỉnh)
        const nextMileDist = (Math.floor(s.distance / 500) + 1) * 500;
        const currSegment = s.distance % 500;
        const barW = 180;
        const barH = 12;
        const barX = W / 2 - barW / 2;
        const barY = 16;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        roundRect(ctx, barX - 10, barY - 4, barW + 20, barH + 8, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        roundRect(ctx, barX, barY, barW, barH, 5);
        ctx.fill();
        const fillW = Math.min(barW, Math.max(6, (currSegment / 500) * barW));
        const progGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        progGrad.addColorStop(0, '#0284c7');
        progGrad.addColorStop(1, '#38bdf8');
        ctx.fillStyle = progGrad;
        roundRect(ctx, barX, barY, fillW, barH, 5);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Mốc tiếp: ${nextMileDist}m`, W / 2, barY + 9);

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

          // Thanh đếm ngược năng lượng Booster dưới mini bar
          const boostFraction = (s.boosterUntil - s.frame) / 300;
          const bW = 120;
          const bX = W / 2 - bW / 2;
          const bY = 40;
          ctx.fillStyle = 'rgba(202, 138, 4, 0.25)';
          roundRect(ctx, bX - 4, bY - 2, bW + 8, 10, 5);
          ctx.fill();
          ctx.fillStyle = '#eab308';
          roundRect(ctx, bX, bY, Math.max(4, bW * boostFraction), 6, 3);
          ctx.fill();
        }

        // Màn hình tạm dừng (Paused)
        if (phaseRef.current === 'paused') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(0, 0, W, H);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          roundRect(ctx, W / 2 - 200, H / 2 - 70, 400, 140, 20);
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText('⏸️ ĐÃ TẠM DỪNG', W / 2, H / 2 - 20);

          ctx.font = '15px sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText('Nhấn Phím P hoặc bấm nút để tiếp tục chạy', W / 2, H / 2 + 10);

          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText('👉 Bấm vào khung để TIẾP TỤC', W / 2, H / 2 + 38);
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
          ctx.fillText('Cúi trượt: Mũi tên xuống / Phím S · Tạm dừng: Phím P', W / 2, H / 2 + 24);

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

  /* Bắt phím điều khiển bàn phím (Cách, Mũi tên lên, Mũi tên xuống, W, S, P) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        slide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, slide, togglePause]);

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
            else if (phase === 'paused') togglePause();
          }}
          className="block h-auto w-full cursor-pointer touch-manipulation select-none"
        />

        {/* Nút Bật/Tắt Âm Thanh góc trên */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <button
            onClick={toggleSound}
            title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-md transition-all hover:bg-slate-850 hover:scale-105 active:scale-95"
          >
            {soundOn ? <Volume2 className="h-5 w-5 text-emerald-400" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
          </button>

          {/* Nút Tạm Dừng / Tiếp tục */}
          {phase === 'playing' && (
            <button
              onClick={togglePause}
              title="Tạm dừng (Phím P)"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-md transition-all hover:bg-slate-850 hover:scale-105 active:scale-95"
            >
              <Pause className="h-4 w-4 text-amber-400" />
            </button>
          )}
          {phase === 'paused' && (
            <button
              onClick={togglePause}
              title="Tiếp tục chạy"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-md transition-all hover:bg-slate-850 hover:scale-105 active:scale-95 animate-pulse"
            >
              <Play className="h-4 w-4 text-emerald-400 fill-emerald-400" />
            </button>
          )}
        </div>

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

          {(phase === 'playing' || phase === 'paused') && (
            <button
              onClick={togglePause}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {phase === 'paused' ? <Play className="h-4 w-4 text-emerald-600 fill-emerald-600" /> : <Pause className="h-4 w-4 text-amber-600" />}
              {phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
            </button>
          )}

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

          {/* Thống kê chi tiết trận đấu & Danh hiệu phong độ */}
          {roundStats && (
            <div className="mt-5 flex flex-col items-center">
              <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                roundStats.rank === 'S'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                  : roundStats.rank === 'A'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : roundStats.rank === 'B'
                  ? 'bg-sky-100 text-sky-900 border border-sky-300'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}>
                <Award className="h-4 w-4" /> {roundStats.rankTitle}
              </span>

              {/* Grid 4 thẻ thống kê */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-center">
                  <span className="text-xs text-slate-500 font-medium">💧 Chai nước</span>
                  <p className="mt-0.5 text-lg font-black text-sky-600 tabular-nums">{roundStats.bottles}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-center">
                  <span className="text-xs text-slate-500 font-medium">🏅 Huy chương</span>
                  <p className="mt-0.5 text-lg font-black text-amber-600 tabular-nums">{roundStats.medals}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-center">
                  <span className="text-xs text-slate-500 font-medium">⚡ Tốc độ max</span>
                  <p className="mt-0.5 text-lg font-black text-orange-600 tabular-nums">{roundStats.maxSpeedKmh} <span className="text-xs font-semibold">km/h</span></p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-center">
                  <span className="text-xs text-slate-500 font-medium flex items-center justify-center gap-0.5">
                    <Flame className="h-3 w-3 text-rose-500" /> Max Combo
                  </span>
                  <p className="mt-0.5 text-lg font-black text-rose-600 tabular-nums">x{roundStats.maxCombo}</p>
                </div>
              </div>

              {/* Nút Sao chép thành tích chia sẻ */}
              <button
                onClick={() => {
                  const shareText = `🏃 Tôi vừa đạt ${finalScore}m tại Mini Game GEOENV RUN 2026! Đạt danh hiệu ${roundStats.rankTitle}!`;
                  void navigator.clipboard.writeText(shareText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-geoenv-700 hover:text-geoenv-800 bg-geoenv-50 hover:bg-geoenv-100 border border-geoenv-200 px-3.5 py-1.5 rounded-lg transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Đã sao chép thành tích!' : 'Sao chép thành tích để chia sẻ'}
              </button>
            </div>
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
