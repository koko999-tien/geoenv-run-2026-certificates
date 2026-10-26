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
  Medal,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* =========================================================================
   GEOENV RUN 2026 — TRÒ CHƠI CHẠY VÔ TẬN, BẢN REMAKE THEO ĐẶC TẢ NGHỆ THUẬT
   - Engine: delta-time clamp 0.05s, tọa độ float sub-pixel, HiDPI (dpr ≤ 2),
     object pooling (không cấp phát trong vòng lặp), camera zoom/pan + shake.
   - Nhân vật: rig xương khớp thủ tục (sine-wave, nghiêng theo tốc độ),
     squash & stretch đàn hồi, ruy băng 10 điểm bay sau đầu, lộn vòng nhảy kép.
   - Môi trường 6 lớp parallax + chu kỳ 4 pha: bình minh → ngày → hoàng hôn
     → đêm cực quang, lát cắt địa chất dưới đường chạy.
   - Gameplay: jump buffer 120ms, fast-fall ×2.5, khiên, booster, combo,
     vật phẩm Eco Orb / Geo Crystal, chướng ngại tầm thấp + tầm cao (trượt).
   - Bảo mật giữ nguyên: điểm chỉ lưu từ màn hình game over, trần 100000,
     bảng game_scores, khóa game do trang cha (RunnerPage) quản lý.
   ========================================================================= */

const W = 960;
const H = 320;
const GROUND = 265;
const RUNNER_X = 90;
const RUNNER_H = 50;
const MAX_SCORE = 100000;
const BEST_KEY = 'geoenv-runner-best';
const NAME_KEY = 'geoenv-runner-name';
const TEAM_KEY = 'geoenv-runner-team';
const SOUND_KEY = 'geoenv-runner-sound';

type Phase = 'ready' | 'playing' | 'paused' | 'over';
type ObKind = 'hurdle' | 'rock' | 'puddle' | 'drone' | 'barrel' | 'branch' | 'sign';
type ItemKind = 'bottle' | 'medal' | 'shield' | 'booster' | 'eco' | 'crystal';

interface Obstacle {
  x: number;
  kind: ObKind;
  seed: number;
}

interface Item {
  x: number;
  y: number;
  kind: ItemKind;
  taken: boolean;
  bob: number;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
  additive: boolean;
  gravity: number;
  rot: number;
  vRot: number;
  shape: 'dot' | 'rect' | 'spark';
}

interface FloatText {
  alive: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

interface Ghost {
  x: number;
  y: number;
  pose: number;
  life: number;
}

interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface ScoreRow {
  id: number;
  player_name: string;
  team_name: string | null;
  score: number;
  created_at: string;
}

/* Hộp va chạm: chướng ngại tầm thấp chiếm mặt đất, tầm cao chiếm vùng trên
   đầu (chỉ trượt mới lách được). Vật phẩm bay cao (huy chương) cần nhảy. */
const OB_BOX: Record<ObKind, { w: number; h: number; yTop: number }> = {
  hurdle: { w: 26, h: 32, yTop: GROUND - 32 },
  rock: { w: 34, h: 26, yTop: GROUND - 26 },
  puddle: { w: 44, h: 12, yTop: GROUND - 12 },
  drone: { w: 40, h: 40, yTop: GROUND - 70 },
  barrel: { w: 30, h: 34, yTop: GROUND - 34 },
  branch: { w: 56, h: 40, yTop: GROUND - 70 },
  sign: { w: 48, h: 40, yTop: GROUND - 70 },
};

const ITEM_VALUE: Record<ItemKind, number> = {
  bottle: 50,
  medal: 150,
  shield: 0,
  booster: 0,
  eco: 30,
  crystal: 80,
};

/* ---------------- Âm thanh tổng hợp Web Audio (đa kênh, có mute) -------- */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  unlock() {
    this.ensure();
  }
  click() {
    this.tone(660, 0.06, 'sine', 0.5);
  }
  jump() {
    this.tone(300, 0.16, 'sine', 0.7, 620);
  }
  doubleJump() {
    this.tone(520, 0.2, 'triangle', 0.7, 980);
  }
  land() {
    this.tone(140, 0.1, 'sine', 0.6, 70);
  }
  coin() {
    this.tone(880, 0.09, 'sine', 0.6);
    this.tone(1320, 0.12, 'sine', 0.5);
  }
  powerup() {
    this.tone(523, 0.1, 'triangle', 0.6);
    this.tone(784, 0.14, 'triangle', 0.6);
  }
  shieldBreak() {
    this.tone(900, 0.25, 'sawtooth', 0.5, 180);
  }
  crash() {
    this.tone(220, 0.35, 'sawtooth', 0.8, 55);
  }
  milestone() {
    this.tone(659, 0.12, 'triangle', 0.6);
    this.tone(880, 0.2, 'triangle', 0.6);
  }
}

const soundEngine = new SoundEngine();

/* ---------------- Helpers vẽ vector thủ tục ---------------------------- */
function roundRectPath(
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

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

/* ---------------- Nhân vật: rig xương khớp thủ tục --------------------- */
interface RunnerPose {
  top: number;
  runCycle: number;
  lean: number;
  squashX: number;
  squashY: number;
  flip: number;
  sliding: boolean;
  airborne: boolean;
}

function drawRunner(ctx: CanvasRenderingContext2D, p: RunnerPose) {
  const cx = RUNNER_X + 18;
  const feetY = p.top + RUNNER_H;
  const heightAbove = Math.max(0, GROUND - RUNNER_H - p.top);

  /* Bóng đổ elip mềm: càng cao càng nhỏ và càng mờ. */
  const shScale = Math.max(0.3, 1 - heightAbove / 300);
  ctx.fillStyle = `rgba(15, 23, 42, ${0.28 * shScale})`;
  ellipse(ctx, cx, GROUND + 4, 22 * shScale, 4.5 * shScale);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, feetY);
  /* Khi trượt đã có tư thế thấp riêng: không nghiêng, không nén thêm nữa
     kẻo hình bị bẹp dí. */
  ctx.rotate(p.sliding ? 0 : p.lean);
  ctx.scale(p.sliding ? 1 : p.squashX, p.sliding ? 1 : p.squashY);
  ctx.translate(0, -RUNNER_H);
  /* Lộn vòng nhảy kép: xoay quanh tâm thân. */
  if (p.flip !== 0) {
    ctx.translate(18, 25);
    ctx.rotate(p.flip);
    ctx.translate(-18, -25);
  }
  const hip = { x: 18, y: 32 };
  const shoulder = { x: 18, y: 17 };
  const phase = p.sliding ? 0 : p.runCycle;
  const swingA = Math.sin(phase) * 13;
  const swingB = Math.sin(phase + Math.PI) * 13;
  const liftA = Math.max(0, Math.cos(phase)) * 7;
  const liftB = Math.max(0, Math.cos(phase + Math.PI)) * 7;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (p.sliding) {
    /* Tư thế trượt: thân gần như nằm ngang, chân duỗi về trước. */
    const grad = ctx.createLinearGradient(0, 8, 0, 30);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    roundRectPath(ctx, 2, 16, 34, 13, 6);
    ctx.fill();
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30, 22);
    ctx.lineTo(48, 30);
    ctx.moveTo(30, 26);
    ctx.lineTo(46, 36);
    ctx.stroke();
    ctx.fillStyle = '#f97316';
    roundRectPath(ctx, 46, 28, 11, 5, 2);
    ctx.fill();
    roundRectPath(ctx, 44, 34, 11, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(8, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(1, 8, 14, 4);
    ctx.restore();
    return;
  }

  /* Chân xa + tay xa (tối hơn một tông). */
  ctx.strokeStyle = '#172554';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x + swingB * 0.6, hip.y + 10);
  ctx.lineTo(hip.x + swingB, 48 - liftB);
  ctx.stroke();
  ctx.strokeStyle = '#172554';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + swingA * 0.5, shoulder.y + 10);
  ctx.stroke();

  /* Thân: áo Bib giải chạy, gradient + sọc trắng + số Bib. */
  const torsoGrad = ctx.createLinearGradient(0, 14, 0, 34);
  torsoGrad.addColorStop(0, '#38bdf8');
  torsoGrad.addColorStop(0.55, '#1e5fc4');
  torsoGrad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(9, 15);
  ctx.quadraticCurveTo(18, 11, 27, 15);
  ctx.lineTo(25, 33);
  ctx.quadraticCurveTo(18, 36, 11, 33);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  roundRectPath(ctx, 13, 20, 10, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#1e5fc4';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('06', 18, 27);

  /* Đầu: da + tóc + băng đô đỏ + mắt. */
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(19, 8, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(19, 4.5, 8.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(11, 2.5, 16, 3.5);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(23, 9, 1.4, 0, Math.PI * 2);
  ctx.fill();

  /* Tay gần + chân gần, giày đế phát sáng. */
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + swingB * 0.5, shoulder.y + 10);
  ctx.stroke();
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x + swingA * 0.6, hip.y + 10);
  ctx.lineTo(hip.x + swingA, 48 - liftA);
  ctx.stroke();
  const shoeGlow = ctx.createRadialGradient(
    hip.x + swingA, 48 - liftA, 1,
    hip.x + swingA, 48 - liftA, 12,
  );
  shoeGlow.addColorStop(0, 'rgba(249, 115, 22, 0.55)');
  shoeGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = shoeGlow;
  ellipse(ctx, hip.x + swingA, 48 - liftA, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  roundRectPath(ctx, hip.x + swingA - 2, 46 - liftA, 11, 5, 2);
  ctx.fill();
  ctx.restore();
}

/* Dải ruy băng sau đầu: 10 điểm nối tiếp, sóng sin theo gió, chuyển sắc
   xanh lá → cam, thuôn dần về cuối. */
function drawRibbon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const wdt = 6.5 * (1 - i / pts.length) + 0.5;
    left.push({ x: pts[i].x, y: pts[i].y - wdt });
    right.push({ x: pts[i].x, y: pts[i].y + wdt });
  }
  const grad = ctx.createLinearGradient(pts[0].x, 0, pts[pts.length - 1].x, 0);
  grad.addColorStop(0, '#22c55e');
  grad.addColorStop(1, '#f97316');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const pt of left) ctx.lineTo(pt.x, pt.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

/* ---------------- Môi trường 6 lớp parallax + chu kỳ thời gian ---------- */
const SKY_PHASES: [string, string][] = [
  ['#fb923c', '#fef3c7'], // Bình minh vàng ấm
  ['#38bdf8', '#e0f2fe'], // Ngày xanh trong
  ['#7e22ce', '#fb7185'], // Hoàng hôn tím đỏ
  ['#0f172a', '#134e4a'], // Đêm cực quang sinh học
];

function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  dist: number,
  time: number,
) {
  /* Lớp 0 — Bầu trời: nội suy màu mượt qua 4 pha theo quãng đường. */
  const phaseFloat = (dist / 12000) % 4;
  const phaseIdx = Math.floor(phaseFloat);
  const phaseNext = (phaseIdx + 1) % 4;
  const rawT = phaseFloat - phaseIdx;
  const t = rawT * rawT * (3 - 2 * rawT); // smoothstep
  const top = lerpColor(SKY_PHASES[phaseIdx][0], SKY_PHASES[phaseNext][0], t);
  const horizon = lerpColor(SKY_PHASES[phaseIdx][1], SKY_PHASES[phaseNext][1], t);
  const nightFactor = phaseIdx === 3 ? 1 : phaseIdx === 2 ? t * 0.6 : 0;
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, top);
  sky.addColorStop(1, horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  /* Mặt trời / mặt trăng + sao lấp lánh khi tối. */
  if (nightFactor < 0.9) {
    const sunGlow = ctx.createRadialGradient(800, 62, 4, 800, 62, 70);
    sunGlow.addColorStop(0, 'rgba(254, 243, 199, 0.9)');
    sunGlow.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = sunGlow;
    ellipse(ctx, 800, 62, 70, 70);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(800, 62, 26, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(800, 62, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(794, 58, 5, 0, Math.PI * 2);
    ctx.arc(806, 68, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (nightFactor > 0.2) {
    for (let i = 0; i < 40; i++) {
      const sx = (i * 197) % W;
      const sy = (i * 89) % 150 + 10;
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.25 + 0.55 * tw) * nightFactor})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  /* Mây trôi bồng bềnh (parallax 0.05x). */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 420 - dist * 0.05) % (W + 240)) - 120 + time * 2;
    const cy = 40 + i * 34;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.arc(cx + 18, cy - 6, 22, 0, Math.PI * 2);
    ctx.arc(cx + 40, cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Lớp 1 — Dãy núi địa chất hùng vĩ (0.1x), sương mù chân núi. */
  const off1 = dist * 0.1;
  ctx.fillStyle = lerpColor('#64748b', horizon, 0.45);
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 16) {
    const wx = x + off1;
    const y = 190 + Math.sin(wx * 0.008) * 30 + Math.sin(wx * 0.021 + 2) * 13;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
  const mist = ctx.createLinearGradient(0, 210, 0, GROUND);
  mist.addColorStop(0, 'rgba(255, 255, 255, 0)');
  mist.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 210, W, GROUND - 210);

  /* Lớp 2 — Đồi địa tầng + rừng + tua-bin điện gió (0.3x). */
  const off2 = dist * 0.3;
  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 16) {
    ctx.lineTo(x, 232 + Math.sin((x + off2) * 0.012) * 12);
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const tx = ((i * 260 - off2) % (W + 200)) - 100;
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(tx - 2, 218, 4, 18);
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(tx - 13, 220);
    ctx.lineTo(tx, 192);
    ctx.lineTo(tx + 13, 220);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const bx = ((i * 430 - off2) % (W + 160)) - 80;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, 235);
    ctx.lineTo(bx, 195);
    ctx.stroke();
    const ang = time * 2 + i;
    for (let b = 0; b < 3; b++) {
      const a = ang + (b * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(bx, 195);
      ctx.lineTo(bx + Math.cos(a) * 14, 195 + Math.sin(a) * 14);
      ctx.stroke();
    }
  }

  /* Lớp 3 — Cận cảnh: cây đung đưa + biển cổ vũ GEOENV RUN (0.6x). */
  const off3 = dist * 0.6;
  for (let i = 0; i < 5; i++) {
    const tx = ((i * 300 - off3) % (W + 240)) - 120;
    const sway = Math.sin(time * 1.6 + i) * 2.5;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, GROUND);
    ctx.lineTo(tx + sway, GROUND - 34);
    ctx.stroke();
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(tx + sway - 8, GROUND - 40, 12, 0, Math.PI * 2);
    ctx.arc(tx + sway + 8, GROUND - 40, 12, 0, Math.PI * 2);
    ctx.arc(tx + sway, GROUND - 50, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    const bx = ((i * 700 - off3) % (W + 300)) - 150;
    ctx.fillStyle = '#334155';
    ctx.fillRect(bx, GROUND - 46, 4, 46);
    ctx.fillRect(bx + 96, GROUND - 46, 4, 46);
    const bannerGrad = ctx.createLinearGradient(bx, GROUND - 46, bx, GROUND - 20);
    bannerGrad.addColorStop(0, nightFactor > 0.5 ? '#0e7490' : '#22c55e');
    bannerGrad.addColorStop(1, nightFactor > 0.5 ? '#155e75' : '#16a34a');
    ctx.fillStyle = bannerGrad;
    roundRectPath(ctx, bx, GROUND - 46, 100, 26, 4);
    ctx.fill();
    ctx.fillStyle = nightFactor > 0.5 ? '#a5f3fc' : '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GEOENV RUN', bx + 50, GROUND - 28);
  }

  /* Lớp 4 — Mặt đường + lát cắt địa chất dưới lòng đất (1.0x). */
  const strata: [number, string][] = [
    [14, '#d6b98a'],
    [28, '#94a3b8'],
    [H - GROUND, '#475569'],
  ];
  let sy = GROUND;
  for (const [hgt, col] of strata) {
    ctx.fillStyle = col;
    ctx.fillRect(0, sy, W, hgt);
    sy += hgt;
  }
  /* Mạch tinh thể thạch anh phát sáng trong lòng đất. */
  for (let i = 0; i < 10; i++) {
    const qx = ((i * 173 - dist) % (W + 60)) - 30;
    const qy = GROUND + 18 + ((i * 37) % 30);
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 3 + i * 2.1));
    ctx.save();
    ctx.translate(qx, qy);
    ctx.rotate(0.6);
    ctx.fillStyle = `rgba(165, 243, 252, ${0.25 + 0.55 * tw})`;
    ctx.fillRect(-3, -7, 6, 14);
    ctx.restore();
  }
  /* Mặt đường tartan + vạch kẻ phân làn chạy theo tốc độ. */
  const trackGrad = ctx.createLinearGradient(0, GROUND - 5, 0, GROUND);
  trackGrad.addColorStop(0, '#c2410c');
  trackGrad.addColorStop(1, '#7c2d12');
  ctx.fillStyle = trackGrad;
  ctx.fillRect(0, GROUND - 5, W, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let x = -40; x < W; x += 40) {
    const dx = x - (dist % 40);
    ctx.fillRect(dx, GROUND - 4, 18, 2);
  }
  /* Ngọn cỏ uốn cong, cong mạnh hơn khi VĐV lướt qua. */
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < W; x += 14) {
    const near = Math.max(0, 1 - Math.abs(x - RUNNER_X) / 70);
    const bend = Math.sin(time * 2 + x * 0.05) * 2 + near * 5;
    ctx.beginPath();
    ctx.moveTo(x, GROUND - 4);
    ctx.quadraticCurveTo(x + bend, GROUND - 9, x + bend * 1.4, GROUND - 12);
    ctx.stroke();
  }

  /* Lớp 5 — Tiền cảnh khí quyển (1.25x): phấn hoa / lá / đom đóm. */
  const off5 = dist * 1.25;
  for (let i = 0; i < 24; i++) {
    const px = ((i * 97 - off5) % (W + 40)) - 20;
    const py = 40 + ((i * 53) % 200) + Math.sin(time + i) * 8;
    if (nightFactor > 0.5) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + i);
      const glow = ctx.createRadialGradient(px, py, 1, px, py, 10);
      glow.addColorStop(0, `rgba(253, 224, 71, ${0.5 + 0.4 * pulse})`);
      glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = glow;
      ellipse(ctx, px, py, 10, 10);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(254, 249, 195, 0.8)';
      ellipse(ctx, px, py, 2.5, 1.8);
      ctx.fill();
    }
  }
}

/* ---------------- Chướng ngại vật: vẽ bằng đa giác + gradient ------------ */
function drawObstacle(ctx: CanvasRenderingContext2D, ob: Obstacle, time: number) {
  const box = OB_BOX[ob.kind];
  const x = ob.x;
  const top = box.yTop;
  ctx.save();
  switch (ob.kind) {
    case 'hurdle': {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(x, GROUND);
      ctx.lineTo(x + 5, top + 6);
      ctx.lineTo(x + 9, GROUND);
      ctx.closePath();
      ctx.moveTo(x + 17, GROUND);
      ctx.lineTo(x + 22, top + 6);
      ctx.lineTo(x + 26, GROUND);
      ctx.closePath();
      ctx.fill();
      const barGrad = ctx.createLinearGradient(x, top, x, top + 8);
      barGrad.addColorStop(0, '#f8fafc');
      barGrad.addColorStop(0.5, '#ef4444');
      barGrad.addColorStop(1, '#b91c1c');
      ctx.fillStyle = barGrad;
      roundRectPath(ctx, x - 2, top, 30, 8, 3);
      ctx.fill();
      break;
    }
    case 'rock': {
      const grad = ctx.createLinearGradient(x, top, x, GROUND);
      grad.addColorStop(0, '#94a3b8');
      grad.addColorStop(1, '#475569');
      ctx.fillStyle = grad;
      ctx.beginPath();
      const j = ob.seed;
      ctx.moveTo(x, GROUND);
      ctx.lineTo(x + 4 + j, top + 8);
      ctx.lineTo(x + 14, top);
      ctx.lineTo(x + 26, top + 6);
      ctx.lineTo(x + 34, GROUND);
      ctx.closePath();
      ctx.fill();
      /* Vân nứt phát sáng trên tảng đá. */
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 14, top + 2);
      ctx.lineTo(x + 12, top + 12);
      ctx.lineTo(x + 18, top + 18);
      ctx.stroke();
      break;
    }
    case 'puddle': {
      const grad = ctx.createRadialGradient(x + 22, top + 6, 2, x + 22, top + 6, 24);
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ellipse(ctx, x + 22, top + 6, 24, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + 16, top + 4, 10, 2.5, -0.2, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'drone': {
      /* Tia laser quét xuống đất. */
      const scan = ctx.createLinearGradient(0, top + 20, 0, GROUND);
      scan.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      scan.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = scan;
      ctx.beginPath();
      ctx.moveTo(x + 16, top + 20);
      ctx.lineTo(x + 24, top + 20);
      ctx.lineTo(x + 30, GROUND);
      ctx.lineTo(x + 10, GROUND);
      ctx.closePath();
      ctx.fill();
      const bodyGrad = ctx.createLinearGradient(x, top, x, top + 22);
      bodyGrad.addColorStop(0, '#475569');
      bodyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = bodyGrad;
      ellipse(ctx, x + 20, top + 10, 20, 11);
      ctx.fill();
      /* Cánh quạt quay. */
      const ang = time * 18;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      for (const rx of [x + 6, x + 34]) {
        ctx.beginPath();
        ctx.moveTo(rx - 9 * Math.cos(ang), top + 2 - 3 * Math.sin(ang));
        ctx.lineTo(rx + 9 * Math.cos(ang), top + 2 + 3 * Math.sin(ang));
        ctx.stroke();
      }
      ctx.fillStyle = Math.sin(time * 6) > 0 ? '#ef4444' : '#fca5a5';
      ctx.beginPath();
      ctx.arc(x + 20, top + 16, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'barrel': {
      const grad = ctx.createLinearGradient(x, top, x, GROUND);
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(0.5, '#ea580c');
      grad.addColorStop(1, '#9a3412');
      ctx.fillStyle = grad;
      roundRectPath(ctx, x, top, 30, GROUND - top, 4);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x, top + 12, 30, 6);
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.moveTo(x + 4, top + 12);
      ctx.lineTo(x + 10, top + 18);
      ctx.lineTo(x + 4, top + 18);
      ctx.closePath();
      ctx.moveTo(x + 12, top + 12);
      ctx.lineTo(x + 18, top + 18);
      ctx.lineTo(x + 12, top + 18);
      ctx.closePath();
      ctx.fill();
      /* Khói độc bốc lên. */
      for (let s = 0; s < 3; s++) {
        const sy = top - 4 - ((time * 14 + s * 9) % 18);
        ctx.fillStyle = `rgba(120, 113, 108, ${0.35 - s * 0.08})`;
        ctx.beginPath();
        ctx.arc(x + 15 + Math.sin(time * 2 + s) * 3, sy, 3 + s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'branch': {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x - 6, top + 4);
      ctx.quadraticCurveTo(x + 28, top - 6, x + 62, top + 4);
      ctx.stroke();
      ctx.fillStyle = '#15803d';
      for (let l = 0; l < 4; l++) {
        ctx.beginPath();
        ctx.arc(x + 8 + l * 14, top - 2 + (l % 2) * 4, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 4, top + 26, 5, GROUND - top - 26);
      ctx.fillRect(x + 39, top + 26, 5, GROUND - top - 26);
      const boardGrad = ctx.createLinearGradient(x, top, x, top + 26);
      boardGrad.addColorStop(0, '#f8fafc');
      boardGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = boardGrad;
      roundRectPath(ctx, x, top, 48, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#1e5fc4';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GEOENV', x + 24, top + 17);
      break;
    }
  }
  ctx.restore();
}

/* ---------------- Vật phẩm: cầu năng lượng, tinh thể, khiên... ----------- */
function drawItem(ctx: CanvasRenderingContext2D, item: Item, time: number) {
  const bobY = Math.sin(time * 3 + item.bob) * 4;
  const y = item.y + bobY;
  const x = item.x;
  ctx.save();
  switch (item.kind) {
    case 'bottle': {
      ctx.fillStyle = '#38bdf8';
      roundRectPath(ctx, x, y, 14, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(x + 4, y - 5, 6, 5);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 2, y + 7, 10, 6);
      break;
    }
    case 'medal': {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 12, y + 12);
      ctx.lineTo(x + 20, y);
      ctx.stroke();
      const gold = ctx.createRadialGradient(x + 12, y + 20, 2, x + 12, y + 20, 12);
      gold.addColorStop(0, '#fef08a');
      gold.addColorStop(1, '#ca8a04');
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.arc(x + 12, y + 20, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(x + 12, y + 20, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shield': {
      const glow = ctx.createRadialGradient(x + 12, y + 12, 2, x + 12, y + 12, 20);
      glow.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
      glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = glow;
      ellipse(ctx, x + 12, y + 12, 20, 20);
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 12, y + 12, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + 12, y + 12, 11, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'booster': {
      const glow = ctx.createRadialGradient(x + 12, y + 12, 2, x + 12, y + 12, 22);
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.55)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ellipse(ctx, x + 12, y + 12, 22, 22);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(x + 15, y);
      ctx.lineTo(x + 7, y + 14);
      ctx.lineTo(x + 12, y + 14);
      ctx.lineTo(x + 9, y + 24);
      ctx.lineTo(x + 18, y + 10);
      ctx.lineTo(x + 13, y + 10);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'eco': {
      const glow = ctx.createRadialGradient(x + 12, y + 12, 2, x + 12, y + 12, 22);
      glow.addColorStop(0, 'rgba(34, 197, 94, 0.55)');
      glow.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = glow;
      ellipse(ctx, x + 12, y + 12, 22, 22);
      ctx.fill();
      const orb = ctx.createRadialGradient(x + 9, y + 8, 2, x + 12, y + 12, 12);
      orb.addColorStop(0, '#bbf7d0');
      orb.addColorStop(1, '#16a34a');
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(x + 12, y + 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 16);
      ctx.quadraticCurveTo(x + 12, y + 8, x + 12, y + 6);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 7, 4, 2.5, -0.5, 0, Math.PI * 2);
      ctx.ellipse(x + 16, y + 7, 4, 2.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crystal': {
      const grad = ctx.createLinearGradient(x, y, x + 24, y + 24);
      grad.addColorStop(0, '#e9d5ff');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + 12, y);
      ctx.lineTo(x + 24, y + 8);
      ctx.lineTo(x + 20, y + 22);
      ctx.lineTo(x + 4, y + 22);
      ctx.lineTo(x, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 12, y);
      ctx.lineTo(x + 12, y + 22);
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x + 24, y + 8);
      ctx.stroke();
      const spark = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * spark})`;
      ctx.beginPath();
      ctx.arc(x + 20, y + 4, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/* ---------------- Trạng thái game (ref, không re-render mỗi frame) ------- */
interface GameState {
  y: number;
  vy: number;
  airborne: boolean;
  jumps: number;
  sliding: boolean;
  slideTime: number;
  speed: number;
  score: number;
  dist: number;
  combo: number;
  shield: boolean;
  boostTime: number;
  runTime: number;
  runCycle: number;
  squashX: number;
  squashY: number;
  squashRecover: number;
  flip: number;
  flipping: boolean;
  buffer: number;
  fastFall: boolean;
  obstacles: Obstacle[];
  items: Item[];
  lastObDist: number;
  nextGap: number;
  lastItemDist: number;
  nextItemGap: number;
  particles: Particle[];
  pCursor: number;
  texts: FloatText[];
  tCursor: number;
  ghosts: Ghost[];
  ghostTimer: number;
  rings: ShockRing[];
  skidMarks: { x: number; alpha: number }[];
  ribbon: { x: number; y: number }[];
  trauma: number;
  camScale: number;
  camY: number;
  displayScore: number;
  passedKm: Set<number>;
  banner: { text: string; t: number } | null;
  dustTimer: number;
  sparkTimer: number;
  bottles: number;
  medals: number;
  orbs: number;
  crystals: number;
  maxSpeed: number;
  maxCombo: number;
  crashed: boolean;
}

function createParticles(): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < 200; i++) {
    arr.push({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, maxLife: 1,
      color: '#fff', additive: false, gravity: 0, rot: 0, vRot: 0, shape: 'dot',
    });
  }
  return arr;
}

function createTexts(): FloatText[] {
  const arr: FloatText[] = [];
  for (let i = 0; i < 32; i++) {
    arr.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff' });
  }
  return arr;
}

function initialState(): GameState {
  const ribbon: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) ribbon.push({ x: RUNNER_X - 6 - i * 7, y: GROUND - 46 });
  return {
    y: GROUND - RUNNER_H,
    vy: 0,
    airborne: false,
    jumps: 0,
    sliding: false,
    slideTime: 0,
    speed: 4.8,
    score: 0,
    dist: 0,
    combo: 1,
    shield: false,
    boostTime: 0,
    runTime: 0,
    runCycle: 0,
    squashX: 1,
    squashY: 1,
    squashRecover: 0,
    flip: 0,
    flipping: false,
    buffer: 0,
    fastFall: false,
    obstacles: [],
    items: [],
    lastObDist: 0,
    nextGap: 420,
    lastItemDist: 0,
    nextItemGap: 500,
    particles: createParticles(),
    pCursor: 0,
    texts: createTexts(),
    tCursor: 0,
    ghosts: [],
    ghostTimer: 0,
    rings: [],
    skidMarks: [],
    ribbon,
    trauma: 0,
    camScale: 1,
    camY: 0,
    displayScore: 0,
    passedKm: new Set<number>(),
    banner: null,
    dustTimer: 0,
    sparkTimer: 0,
    bottles: 0,
    medals: 0,
    orbs: 0,
    crystals: 0,
    maxSpeed: 4.8,
    maxCombo: 1,
    crashed: false,
  };
}

function rankFor(score: number): { rank: string; title: string } {
  if (score >= 10000) return { rank: 'S', title: 'Huyền thoại GEOENV' };
  if (score >= 6000) return { rank: 'A', title: 'VĐV xuất sắc' };
  if (score >= 3000) return { rank: 'B', title: 'VĐV triển vọng' };
  return { rank: 'C', title: 'Người mới bắt đầu' };
}

interface FinalStats {
  score: number;
  km: number;
  time: number;
  maxSpeedKmh: number;
  maxCombo: number;
  items: number;
  rank: string;
  title: string;
}

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(initialState());
  const phaseRef = useRef<Phase>('ready');
  const lastTimeRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('ready');
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  });
  const [best, setBest] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
  });
  const [name, setName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(NAME_KEY) ?? '';
  });
  const [team, setTeam] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(TEAM_KEY) ?? '';
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scoresError, setScoresError] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  /* HUD hiển thị bằng HTML (đọc được mọi màn hình) thay vì vẽ trong canvas:
     game chỉ đồng bộ khoảng 8 lần/giây để khỏi re-render mỗi frame. */
  const [hud, setHud] = useState({
    km: 0,
    pace: '0:00',
    score: 0,
    speedKmh: 0,
    combo: 1,
    banner: null as string | null,
  });
  const hudAccRef = useRef(0);

  useEffect(() => {
    soundEngine.enabled = soundOn;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    }
  }, [soundOn]);

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
    setScores((data ?? []) as ScoreRow[]);
  }, []);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const startGame = useCallback(() => {
    stateRef.current = initialState();
    setSaved(false);
    setFinalStats(null);
    setHud({ km: 0, pace: '0:00', score: 0, speedKmh: 0, combo: 1, banner: null });
    soundEngine.unlock();
    soundEngine.click();
    setPhaseBoth('playing');
  }, [setPhaseBoth]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') setPhaseBoth('paused');
    else if (phaseRef.current === 'paused') setPhaseBoth('playing');
  }, [setPhaseBoth]);

  /* ---- Pool: hạt / chữ nổi (tái sử dụng, không cấp phát trong loop) ---- */
  const spawnParticle = useCallback((p: Omit<Particle, 'alive' | 'life'>) => {
    const s = stateRef.current;
    const slot = s.particles[s.pCursor];
    s.pCursor = (s.pCursor + 1) % s.particles.length;
    Object.assign(slot, p, { alive: true, life: 0 });
  }, []);

  const spawnText = useCallback((x: number, y: number, text: string, color: string) => {
    const s = stateRef.current;
    const slot = s.texts[s.tCursor];
    s.tCursor = (s.tCursor + 1) % s.texts.length;
    Object.assign(slot, { alive: true, x, y, vy: -70, life: 0, maxLife: 1.1, text, color });
  }, []);

  const burst = useCallback(
    (x: number, y: number, color: string, count: number, additive: boolean) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        spawnParticle({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          r: 1.5 + Math.random() * 2.5,
          maxLife: 0.4 + Math.random() * 0.4,
          color,
          additive,
          gravity: 2.5,
          rot: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.4,
          shape: Math.random() > 0.5 ? 'spark' : 'dot',
        });
      }
    },
    [spawnParticle],
  );

  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (!s.airborne) {
      s.airborne = true;
      s.jumps = 1;
      s.vy = -16.5;
      s.squashX = 0.82;
      s.squashY = 1.22;
      soundEngine.jump();
      for (let i = 0; i < 6; i++) {
        spawnParticle({
          x: RUNNER_X + 6 + Math.random() * 20,
          y: GROUND,
          vx: -1 - Math.random() * 2,
          vy: -0.5 - Math.random(),
          r: 1.5 + Math.random() * 2,
          maxLife: 0.4,
          color: '#d97706',
          additive: false,
          gravity: 1,
          rot: 0,
          vRot: 0,
          shape: 'dot',
        });
      }
    } else if (s.jumps === 1) {
      /* Nhảy kép: lộn vòng 360° + vòng sóng xung kích dưới chân. */
      s.jumps = 2;
      s.vy = -15;
      s.flipping = true;
      s.flip = 0;
      s.rings.push({ x: RUNNER_X + 18, y: GROUND + 1, r: 4, maxR: 34, alpha: 0.7 });
      soundEngine.doubleJump();
    }
  }, [spawnParticle]);

  const pressJump = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s.airborne) {
      doJump();
    } else if (s.jumps === 1) {
      doJump();
    } else {
      /* Hết lượt nhảy: ghi nhớ phím 120ms để tự nhảy ngay khi chạm đất. */
      s.buffer = 0.12;
    }
  }, [doJump]);

  const pressSlide = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (s.airborne) {
      /* Fast-fall: rơi nhanh gấp 2.5 lần trọng lực. */
      s.fastFall = true;
    } else {
      s.sliding = true;
      s.slideTime = 0.55;
    }
  }, []);

  const finishRun = useCallback(() => {
    const s = stateRef.current;
    if (s.crashed) return;
    s.crashed = true;
    soundEngine.crash();
    const finalScore = Math.floor(s.score);
    const stats: FinalStats = {
      score: finalScore,
      km: s.dist / 1000,
      time: s.runTime,
      maxSpeedKmh: s.maxSpeed * 3.2,
      maxCombo: s.maxCombo,
      items: s.bottles + s.medals + s.orbs + s.crystals,
      ...rankFor(finalScore),
    };
    setFinalStats(stats);
    if (typeof window !== 'undefined') {
      const prevBest = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
      if (finalScore > prevBest) {
        window.localStorage.setItem(BEST_KEY, String(finalScore));
        setBest(finalScore);
      }
    }
    setPhaseBoth('over');
  }, [setPhaseBoth]);

/* ---------------- Vòng lặp game: vật lý dt + va chạm -------------------- */
  const clockRef = useRef(0);

  const updateGame = useCallback(
    (dtSec: number) => {
      const s = stateRef.current;
      const dt60 = dtSec * 60;
      const isBoosted = s.boostTime > 0;
      if (s.boostTime > 0) s.boostTime -= dtSec;
      if (s.buffer > 0) s.buffer -= dtSec;
      s.runTime += dtSec;

      /* Trượt: đếm ngược thời gian trượt. */
      if (s.sliding) {
        s.slideTime -= dtSec;
        if (s.slideTime <= 0) s.sliding = false;
      }

      /* Vật lý nhảy: trọng lực, fast-fall ×2.5, tiếp đất đàn hồi. */
      const gravity = (s.fastFall ? 2.5 : 1) * 0.9;
      s.vy += gravity * dt60;
      s.y += s.vy * dt60;
      if (s.y >= GROUND - RUNNER_H) {
        if (s.airborne) {
          s.airborne = false;
          s.jumps = 0;
          s.fastFall = false;
          s.vy = 0;
          s.y = GROUND - RUNNER_H;
          s.squashX = 1.25;
          s.squashY = 0.78;
          s.squashRecover = 0.15;
          soundEngine.land();
          burst(RUNNER_X + 18, GROUND, '#b45309', 8, false);
          s.rings.push({ x: RUNNER_X + 18, y: GROUND + 1, r: 4, maxR: 28, alpha: 0.7 });
          if (s.buffer > 0) {
            s.buffer = 0;
            doJump();
          }
        } else {
          s.y = GROUND - RUNNER_H;
          s.vy = 0;
        }
      }
      /* Chu kỳ chạy tỉ lệ thuận với tốc độ. */
      if (!s.airborne && !s.sliding) s.runCycle += dtSec * (7 + s.speed * 0.9);

      /* Lộn vòng nhảy kép: xoay 360° với tốc độ góc đều. */
      if (s.flipping) {
        s.flip += dtSec * 9;
        if (s.flip >= Math.PI * 2) {
          s.flip = 0;
          s.flipping = false;
        }
      }

      /* Squash & stretch: lò xo nội suy về mục tiêu (takeoff/apex/land/slide). */
      if (s.squashRecover > 0) s.squashRecover -= dtSec;
      const targetX = s.sliding ? 1.35 : s.squashRecover > 0 ? 1.25 : 1;
      const targetY = s.sliding ? 0.65 : s.squashRecover > 0 ? 0.78 : 1;
      const k = 1 - Math.exp(-14 * dtSec);
      s.squashX += (targetX - s.squashX) * k;
      s.squashY += (targetY - s.squashY) * k;

      /* Tốc độ: tăng theo điểm, boost ×1.35, trần 15.5. */
      const baseSpeed = Math.min(4.8 + s.score * 0.0028, 15.5);
      s.speed = isBoosted ? baseSpeed * 1.35 : baseSpeed;
      if (s.speed > s.maxSpeed) s.maxSpeed = s.speed;

      /* Điểm + quãng đường (trần 100000, khớp CHECK của bảng). */
      if (s.score < MAX_SCORE) {
        s.score = Math.min(s.score + s.speed * 0.24 * s.combo * dt60, MAX_SCORE);
      }
      s.dist += s.speed * dt60;

      /* Mốc KM: banner trượt từ trên xuống. */
      for (const km of [1, 3, 5, 10]) {
        if (s.dist >= km * 1000 && !s.passedKm.has(km)) {
          s.passedKm.add(km);
          s.banner = { text: `${km}KM FINISHER!`, t: 0 };
          soundEngine.milestone();
        }
      }
      if (s.banner) {
        s.banner.t += dtSec;
        if (s.banner.t > 2.2) s.banner = null;
      }

      /* Sinh chướng ngại: 65% tầm thấp, 35% tầm cao (phải trượt). */
      if (s.dist - s.lastObDist > s.nextGap) {
        const low: ObKind[] = ['hurdle', 'rock', 'puddle', 'barrel'];
        const high: ObKind[] = ['drone', 'branch', 'sign'];
        const pool = Math.random() < 0.65 ? low : high;
        const kind = pool[Math.floor(Math.random() * pool.length)];
        s.obstacles.push({ x: W + 30, kind, seed: Math.random() });
        s.lastObDist = s.dist;
        s.nextGap = 360 + Math.random() * 320;
      }

      /* Sinh vật phẩm. */
      if (s.dist - s.lastItemDist > s.nextItemGap) {
        const r = Math.random();
        let kind: ItemKind = 'bottle';
        if (r < 0.35) kind = 'bottle';
        else if (r < 0.55) kind = 'medal';
        else if (r < 0.7) kind = 'eco';
        else if (r < 0.8) kind = 'crystal';
        else if (r < 0.92) kind = 'shield';
        else kind = 'booster';
        const itemY = kind === 'medal' || kind === 'crystal' ? GROUND - 85 : GROUND - 40;
        s.items.push({ x: W + 20, y: itemY, kind, taken: false, bob: Math.random() * Math.PI });
        s.lastItemDist = s.dist;
        s.nextItemGap = 600 + Math.random() * 550;
      }

      /* Di chuyển thế giới + hút vật phẩm khi boost. */
      for (const ob of s.obstacles) ob.x -= s.speed * dt60;
      for (const item of s.items) {
        item.x -= s.speed * dt60;
        if (isBoosted && !item.taken) {
          item.x += (RUNNER_X + 18 - item.x) * 0.12 * dt60;
          item.y += (s.y + 20 - item.y) * 0.12 * dt60;
        }
      }
      s.obstacles = s.obstacles.filter((o) => o.x + 80 > 0);
      s.items = s.items.filter((item) => item.x + 40 > 0 && !item.taken);

      /* Bụi chân + tia lửa trượt + vệt trượt. */
      if (!s.airborne && !s.sliding) {
        s.dustTimer += dtSec;
        if (s.dustTimer > 0.08) {
          s.dustTimer = 0;
          spawnParticle({
            x: RUNNER_X + 6,
            y: GROUND,
            vx: -1.2 - Math.random() * 1.5,
            vy: -0.4 - Math.random() * 0.8,
            r: 1.5 + Math.random() * 2,
            maxLife: 0.35,
            color: '#d97706',
            additive: false,
            gravity: 1,
            rot: 0,
            vRot: 0,
            shape: 'dot',
          });
        }
      }
      if (s.sliding) {
        s.sparkTimer += dtSec;
        if (s.sparkTimer > 0.05) {
          s.sparkTimer = 0;
          spawnParticle({
            x: RUNNER_X + 30,
            y: GROUND,
            vx: -3 - Math.random() * 3,
            vy: -1 - Math.random() * 2,
            r: 1 + Math.random() * 1.5,
            maxLife: 0.3,
            color: '#fdba74',
            additive: true,
            gravity: 2,
            rot: 0,
            vRot: 0,
            shape: 'spark',
          });
          s.skidMarks.push({ x: RUNNER_X + 18, alpha: 0.45 });
          if (s.skidMarks.length > 40) s.skidMarks.shift();
        }
      }
      for (const sm of s.skidMarks) {
        sm.x -= s.speed * dt60;
        sm.alpha -= dtSec * 1.2;
      }
      s.skidMarks = s.skidMarks.filter((sm) => sm.alpha > 0);

      /* Hạt / chữ nổi / vòng sóng / dư ảnh. */
      for (const p of s.particles) {
        if (!p.alive) continue;
        p.x += p.vx * dt60;
        p.y += p.vy * dt60;
        p.vy += p.gravity * dt60;
        p.rot += p.vRot * dt60;
        p.life += dtSec;
        if (p.life >= p.maxLife) p.alive = false;
      }
      for (const ft of s.texts) {
        if (!ft.alive) continue;
        ft.y += ft.vy * dtSec;
        ft.vy += 25 * dtSec;
        ft.life += dtSec;
        if (ft.life >= ft.maxLife) ft.alive = false;
      }
      for (const ring of s.rings) {
        ring.r += 130 * dtSec;
        ring.alpha -= dtSec * 2.2;
      }
      s.rings = s.rings.filter((ring) => ring.alpha > 0);
      if (isBoosted || s.flipping) {
        s.ghostTimer += dtSec;
        if (s.ghostTimer > 0.08) {
          s.ghostTimer = 0;
          s.ghosts.push({ x: RUNNER_X, y: s.y, pose: s.runCycle, life: 0.35 });
        }
      }
      for (const g of s.ghosts) g.life -= dtSec;
      s.ghosts = s.ghosts.filter((g) => g.life > 0);

      /* Ruy băng: 10 điểm nối tiếp, trễ dần + sóng sin theo gió. */
      const anchor = { x: RUNNER_X + 4, y: s.y + 8 };
      const pts = s.ribbon;
      pts[0].x += (anchor.x - pts[0].x) * 0.6;
      pts[0].y += (anchor.y - pts[0].y) * 0.6;
      for (let i = 1; i < pts.length; i++) {
        const tx = pts[i - 1].x - 7;
        const ty = pts[i - 1].y + Math.sin(clockRef.current * 9 - i * 0.9) * 1.8;
        pts[i].x += (tx - pts[i].x) * 0.45;
        pts[i].y += (ty - pts[i].y) * 0.45;
      }

      /* Camera: zoom out khi nhanh/cao, lia Y theo độ cao, rung giảm chấn. */
      const heightAbove = Math.max(0, GROUND - RUNNER_H - s.y);
      const targetScale = s.speed > 11 || heightAbove > 60 ? 0.94 : 1;
      s.camScale += (targetScale - s.camScale) * (1 - Math.exp(-3 * dtSec));
      const targetCamY = s.airborne ? -heightAbove * 0.22 : 0;
      s.camY += (targetCamY - s.camY) * (1 - Math.exp(-4 * dtSec));
      s.trauma = Math.max(0, s.trauma - dtSec * 1.6);

      /* Điểm hiển thị lăn mượt về điểm thật (rolling counter). */
      s.displayScore += (s.score - s.displayScore) * (1 - Math.exp(-8 * dtSec));

      /* Đồng bộ HUD HTML khoảng 8 lần/giây. */
      hudAccRef.current += dtSec;
      if (hudAccRef.current > 0.12) {
        hudAccRef.current = 0;
        const paceMin = 60 / Math.max(1, s.speed * 3.2);
        const paceMm = Math.floor(paceMin);
        const paceSs = Math.floor((paceMin - paceMm) * 60);
        setHud({
          km: s.dist / 1000,
          pace: `${paceMm}:${String(paceSs).padStart(2, '0')}`,
          score: Math.floor(s.displayScore),
          speedKmh: s.speed * 3.2,
          combo: s.combo,
          banner: s.banner ? s.banner.text : null,
        });
      }

      /* Va chạm chướng ngại. */
      const runnerBox = s.sliding
        ? { x: RUNNER_X + 2, y: s.y + 26, w: 44, h: 22 }
        : { x: RUNNER_X + 4, y: s.y + 4, w: 28, h: 44 };
      for (const ob of s.obstacles) {
        const box = OB_BOX[ob.kind];
        const obBox = { x: ob.x, y: box.yTop, w: box.w, h: box.h };
        const hit =
          runnerBox.x < obBox.x + obBox.w &&
          runnerBox.x + runnerBox.w > obBox.x &&
          runnerBox.y < obBox.y + obBox.h &&
          runnerBox.y + runnerBox.h > obBox.y;
        if (!hit) continue;
        if (s.shield) {
          s.shield = false;
          s.obstacles = s.obstacles.filter((o) => o !== ob);
          s.trauma = 0.6;
          soundEngine.shieldBreak();
          spawnText(RUNNER_X + 18, s.y - 10, 'KHIÊN VỠ!', '#f59e0b');
        } else {
          finishRun();
          return;
        }
      }

      /* Nhặt vật phẩm. */
      for (const item of s.items) {
        if (item.taken) continue;
        const hit =
          runnerBox.x - 4 < item.x + 24 &&
          runnerBox.x + runnerBox.w + 4 > item.x &&
          runnerBox.y - 4 < item.y + 24 &&
          runnerBox.y + runnerBox.h + 4 > item.y;
        if (!hit) continue;
        item.taken = true;
        const value = ITEM_VALUE[item.kind];
        if (value > 0) {
          s.score = Math.min(s.score + value, MAX_SCORE);
          s.combo = Math.min(s.combo + 0.25, 3);
          if (s.combo > s.maxCombo) s.maxCombo = s.combo;
          soundEngine.coin();
        } else {
          soundEngine.powerup();
        }
        switch (item.kind) {
          case 'bottle':
            s.bottles += 1;
            spawnText(item.x, item.y - 8, '+50', '#0ea5e9');
            burst(item.x + 12, item.y + 12, '#38bdf8', 8, false);
            break;
          case 'medal':
            s.medals += 1;
            spawnText(item.x, item.y - 8, '+150', '#ca8a04');
            burst(item.x + 12, item.y + 12, '#facc15', 10, true);
            break;
          case 'eco':
            s.orbs += 1;
            spawnText(item.x, item.y - 8, '+30 ECO', '#16a34a');
            burst(item.x + 12, item.y + 12, '#22c55e', 12, true);
            break;
          case 'crystal':
            s.crystals += 1;
            spawnText(item.x, item.y - 8, '+80 GEO', '#a855f7');
            burst(item.x + 12, item.y + 12, '#c084fc', 20, true);
            break;
          case 'shield':
            s.shield = true;
            spawnText(item.x, item.y - 8, 'KHIÊN!', '#3b82f6');
            burst(item.x + 12, item.y + 12, '#60a5fa', 10, true);
            break;
          case 'booster':
            s.boostTime = 4;
            spawnText(item.x, item.y - 8, 'TĂNG TỐC!', '#f59e0b');
            burst(item.x + 12, item.y + 12, '#facc15', 12, true);
            break;
        }
      }
    },
    [burst, doJump, finishRun, spawnParticle, spawnText],
  );

/* ---------------- Vẽ toàn cảnh: camera + HUD thể thao -------------------- */
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = stateRef.current;
    const time = clockRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* Camera: zoom + lia Y + rung giảm chấn. */
    const sh = s.trauma * s.trauma * 12;
    const shX = (Math.random() - 0.5) * 2 * sh;
    const shY = (Math.random() - 0.5) * 2 * sh;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s.camScale, s.camScale);
    ctx.translate(-W / 2 + shX, -H / 2 + s.camY + shY);

    drawEnvironment(ctx, s.dist, time);

    for (const sm of s.skidMarks) {
      ctx.fillStyle = `rgba(15, 23, 42, ${sm.alpha * 0.5})`;
      ctx.fillRect(sm.x, GROUND - 2, 16, 3);
    }

    /* Dư ảnh tốc độ (ghost) khi boost hoặc lộn vòng. */
    for (const g of s.ghosts) {
      const alpha = (g.life / 0.35) * 0.3;
      ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
      roundRectPath(ctx, g.x + 2, g.y + 8, 32, 40, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(g.x + 18, g.y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    drawRibbon(ctx, s.ribbon);
    drawRunner(ctx, {
      top: s.y,
      runCycle: s.runCycle,
      lean: Math.min(0.22, s.speed * 0.012),
      squashX: s.squashX,
      squashY: s.squashY,
      flip: s.flip,
      sliding: s.sliding,
      airborne: s.airborne,
    });

    /* Vòng khiên + hào quang booster quanh VĐV. */
    if (s.shield) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(RUNNER_X + 18, s.y + 25, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
      ctx.beginPath();
      ctx.arc(RUNNER_X + 18, s.y + 25, 34, time * 3, time * 3 + 1.4);
      ctx.stroke();
    }
    if (s.boostTime > 0) {
      const aura = ctx.createRadialGradient(
        RUNNER_X + 18, s.y + 25, 4, RUNNER_X + 18, s.y + 25, 52,
      );
      aura.addColorStop(0, 'rgba(250, 204, 21, 0.35)');
      aura.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = aura;
      ellipse(ctx, RUNNER_X + 18, s.y + 25, 52, 52);
      ctx.fill();
    }

    for (const ob of s.obstacles) drawObstacle(ctx, ob, time);
    for (const item of s.items) {
      if (!item.taken) drawItem(ctx, item, time);
    }

    /* Hạt: vẽ hạt thường trước, hạt năng lượng bằng additive blending. */
    for (const pass of [false, true]) {
      ctx.save();
      if (pass) ctx.globalCompositeOperation = 'lighter';
      for (const p of s.particles) {
        if (!p.alive || p.additive !== pass) continue;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.shape === 'rect' || p.shape === 'spark') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const ring of s.rings) {
      ctx.strokeStyle = `rgba(34, 197, 94, ${ring.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* Chữ nổi: phóng to overshoot lúc mới xuất hiện, bay theo parabol. */
    ctx.textAlign = 'center';
    for (const ft of s.texts) {
      if (!ft.alive) continue;
      const scale =
        ft.life < 0.15 ? 0.6 + (ft.life / 0.15) * 0.6 : 1.2 - Math.min(0.2, (ft.life - 0.15) * 0.4);
      const alpha = ft.life > 0.7 ? Math.max(0, (ft.maxLife - ft.life) / 0.4) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(14 * scale)}px sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    /* Vệt xé gió khi tốc độ cao hoặc đang boost. */
    if (phaseRef.current === 'playing' && (s.speed > 9 || s.boostTime > 0)) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ly = 30 + ((i * 53) % 200);
        const lx = W - ((time * (380 + s.speed * 30) + i * 173) % (W + 240)) + 120;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 40 + (i % 3) * 20, ly);
        ctx.stroke();
      }
    }
    ctx.restore();

  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    const loop = (now: number) => {
      const dt = lastTimeRef.current
        ? Math.min((now - lastTimeRef.current) / 1000, 0.05)
        : 0.016;
      lastTimeRef.current = now;
      if (phaseRef.current === 'playing') updateGame(dt);
      if (phaseRef.current !== 'paused') clockRef.current += dt;
      drawScene();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [updateGame, drawScene]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (phaseRef.current === 'ready') startGame();
        else pressJump();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        pressSlide();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      } else if (e.code === 'Enter' && phaseRef.current === 'ready') {
        startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        stateRef.current.fastFall = false;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pressJump, pressSlide, togglePause, startGame]);

  const [saveError, setSaveError] = useState('');
  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!finalStats || saved || saving) return;
    const playerName = name.trim();
    if (!playerName) {
      setSaveError('Nhập tên trước khi lưu điểm.');
      return;
    }
    setSaving(true);
    setSaveError('');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NAME_KEY, playerName);
      window.localStorage.setItem(TEAM_KEY, team.trim());
    }
    const { error } = await supabase.from('game_scores').insert({
      player_name: playerName.slice(0, 30),
      team_name: team.trim() ? team.trim().slice(0, 30) : null,
      score: finalStats.score,
    });
    setSaving(false);
    if (error) {
      setSaveError('Lưu thất bại, thử lại sau.');
      return;
    }
    setSaved(true);
    void loadScores();
  };

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-2 ring-slate-800">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={() => {
            if (phaseRef.current === 'playing') pressJump();
          }}
          className="block h-auto w-full cursor-pointer touch-none select-none"
        />
        {/* HUD bằng HTML: chữ giữ nguyên cỡ thật trên mọi màn hình, không
            bị co nhỏ theo canvas như trước; pointer-events-none để vẫn bấm
            nhảy được khi chạm vào khung game. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
          <div className="rounded-xl bg-white/75 px-3 py-2 shadow ring-1 ring-slate-900/10 backdrop-blur-sm">
            <p className="text-[10px] font-semibold tracking-wide text-slate-500">QUÃNG ĐƯỜNG</p>
            <p className="text-base font-black tabular-nums text-slate-900 sm:text-lg">
              {hud.km.toFixed(2)} KM
            </p>
            <p className="text-[11px] font-medium text-slate-500">Pace {hud.pace} /km</p>
            {hud.combo > 1 && (
              <>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-900/15 sm:w-32">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${((hud.combo - 1) / 2) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] font-bold text-green-700">
                  COMBO ×{hud.combo.toFixed(2)}
                </p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-white/75 px-3 py-2 text-right shadow ring-1 ring-slate-900/10 backdrop-blur-sm">
            <p className="text-[10px] font-semibold tracking-wide text-slate-500">ĐIỂM</p>
            <p className="text-base font-black tabular-nums text-slate-900 sm:text-lg">
              {hud.score.toLocaleString('vi-VN')}
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              {hud.speedKmh.toFixed(1)} km/h
            </p>
          </div>
        </div>
        {hud.banner && (
          <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center sm:top-20">
            <span className="banner-drop rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-black text-white shadow-lg">
              {hud.banner}
            </span>
          </div>
        )}
      </div>

      {/* Nút cảm ứng trên điện thoại: đặt DƯỚI khung game thay vì đè lên
          đường chạy (trước đây nút che mất chướng ngại lao từ bên phải tới). */}
      <div className="mt-3 flex items-center gap-3 sm:hidden">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            pressSlide();
          }}
          onPointerUp={() => {
            stateRef.current.fastFall = false;
          }}
          aria-label="Trượt"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow"
        >
          <ArrowDown className="h-5 w-5" />
          Trượt
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            pressJump();
          }}
          aria-label="Nhảy"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-geoenv-600 py-3.5 text-sm font-bold text-white shadow"
        >
          <ArrowUp className="h-5 w-5" />
          Nhảy
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {phase === 'ready' && (
            <button
              onClick={startGame}
              className="flex items-center gap-2 rounded-xl bg-geoenv-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
            >
              <Play className="h-4 w-4" />
              Bắt đầu chạy
            </button>
          )}
          {phase === 'playing' && (
            <button
              onClick={togglePause}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-geoenv-300 hover:text-geoenv-700"
            >
              <Pause className="h-4 w-4" />
              Tạm dừng
            </button>
          )}
          {phase === 'paused' && (
            <button
              onClick={togglePause}
              className="flex items-center gap-2 rounded-xl bg-geoenv-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
            >
              <Play className="h-4 w-4" />
              Tiếp tục
            </button>
          )}
          {(phase === 'over' || phase === 'paused') && (
            <button
              onClick={startGame}
              className="flex items-center gap-2 rounded-xl bg-geoenv-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700"
            >
              <RotateCcw className="h-4 w-4" />
              Chạy lại
            </button>
          )}
          <button
            onClick={() => setSoundOn((v) => !v)}
            aria-label="Bật/tắt âm thanh"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-geoenv-300 hover:text-geoenv-700"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <span className="hidden text-sm text-slate-500 sm:inline">
            Cách nhảy • ↓ trượt / rơi nhanh • P tạm dừng
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Kỷ lục: {best.toLocaleString('vi-VN')}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            Khiên chặn 1 lần
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Tăng tốc 4 giây
          </span>
        </div>
      </div>

      {phase === 'ready' && (
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          Nhảy qua chướng ngại thấp, trượt qua drone, cành cây và biển báo trên cao. Nhấn 2 lần
          để lộn vòng nhảy kép.
        </p>
      )}

      {phase === 'over' && finalStats && (
        <div className="card mt-4 p-5 sm:p-6">
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg">
              <Medal className="h-8 w-8 text-white" />
            </span>
            <h2 className="mt-3 text-xl font-black tracking-wide text-slate-900 sm:text-2xl">
              FINISHER — GEOENV RUN
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Hạng {finalStats.rank} • {finalStats.title}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Điểm</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                {finalStats.score.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Quãng đường</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                {finalStats.km.toFixed(2)} KM
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Thời gian</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                {fmtTime(finalStats.time)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Tốc độ tối đa</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                {finalStats.maxSpeedKmh.toFixed(1)} km/h
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Combo tối đa</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                ×{finalStats.maxCombo.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500">Vật phẩm</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                {finalStats.items}
              </p>
            </div>
          </div>

          {!saved ? (
            <div className="mt-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên của bạn *"
                  aria-label="Tên của bạn"
                  maxLength={30}
                  className="input-field"
                />
                <input
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="Đội (không bắt buộc)"
                  aria-label="Đội (không bắt buộc)"
                  maxLength={30}
                  className="input-field"
                />
              </div>
              {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-geoenv-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-geoenv-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Lưu điểm lên bảng xếp hạng'}
              </button>
            </div>
          ) : (
            <p className="mt-5 text-center text-sm font-semibold text-emerald-700">
              Đã lưu điểm lên bảng xếp hạng!
            </p>
          )}

          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Trophy className="h-4 w-4 text-amber-500" />
              Bảng xếp hạng
            </h3>
            {scoresError ? (
              <p className="mt-2 text-sm text-slate-500">Không tải được bảng xếp hạng.</p>
            ) : scores.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có điểm nào.</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {scores.map((row, i) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="w-5 text-center font-black tabular-nums text-slate-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-semibold text-slate-800">
                      {row.player_name}
                      {row.team_name && (
                        <span className="ml-2 font-normal text-slate-500">{row.team_name}</span>
                      )}
                    </span>
                    <span className="font-black tabular-nums text-geoenv-700">
                      {row.score.toLocaleString('vi-VN')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
