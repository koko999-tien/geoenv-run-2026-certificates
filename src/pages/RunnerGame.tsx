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
  Download,
  Palette,
  Flame,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* =========================================================================
   GEOENV RUN 2026 — MASTER V4 STUDIO AAA UPGRADE
   - Shader Engine: Bộ xử lý hậu kỳ WebGL với Shockwave Ripple khúc xạ,
     quang sai Chromatic Aberration RGB split, Luminance Bloom & Film Grain.
   - Hoạt ảnh Nhân vật: Rig 14 khớp xương thủ tục, độ nghiêng khí động học,
     squash & stretch đàn hồi, lộn vòng 360° nhảy kép, dải ruy băng 12 điểm,
     3 Trang phục VĐV độc quyền (GeoEnv Pro, Cyber Neon, Golden Champion).
   - Đường chạy & Lát cắt địa chất: Mặt đường tartan 3 làn chạy chân thực,
     gờ giảm tốc FIA 3D, vệt phản quang specular, dải đèn LED dẫn hướng;
     lòng đất đa tầng với mạch thạch anh, đá phiến, hóa thạch và vỉa magma.
   - Bối cảnh Parallax 6 tầng: Bầu trời 4 pha mượt mà, tia nắng God Rays,
     cực quang đêm, thành phố tương lai, khán đài SVĐ khán giả cổ vũ.
   - Cổng chào Marathon 3D mỗi 500m với pháo hoa giấy & kèn đồng chiến thắng.
   - Tạo ảnh Chứng nhận Thành tích PNG chuẩn 1200x630px ngoại tuyến.
   ========================================================================= */

const W = 960;
const H = 320;
const GROUND = 260;
const RUNNER_X = 90;
const RUNNER_H = 50;
const MAX_SCORE = 100000;
const BEST_KEY = 'geoenv-runner-best';
const NAME_KEY = 'geoenv-runner-name';
const TEAM_KEY = 'geoenv-runner-team';
const SOUND_KEY = 'geoenv-runner-sound';

export type RunnerSkin = 'geoenv' | 'cyber' | 'champion';
type Phase = 'ready' | 'playing' | 'paused' | 'over';
type ObKind = 'hurdle' | 'rock' | 'puddle' | 'drone' | 'barrel' | 'branch' | 'sign';
type ItemKind = 'bottle' | 'medal' | 'shield' | 'booster' | 'eco' | 'crystal';

interface Obstacle {
  x: number;
  kind: ObKind;
  seed: number;
  nearMissed?: boolean;
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

interface ArchGate {
  x: number;
  distanceMark: number;
  passed: boolean;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind: 'petal' | 'rain' | 'firefly';
  rot: number;
  vRot: number;
}

interface ScoreRow {
  id: number;
  player_name: string;
  team_name: string | null;
  score: number;
  created_at: string;
}

/* =========================================================================
   ÂM THANH TỔNG HỢP WEB AUDIO SYNTHESIZER
   ========================================================================= */
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

  unlock() { this.ensure(); }
  click() { this.tone(660, 0.06, 'sine', 0.5); }
  jump() { this.tone(280, 0.16, 'sine', 0.7, 620); }
  doubleJump() { this.tone(520, 0.22, 'triangle', 0.75, 1080); }
  slide() { this.tone(240, 0.18, 'triangle', 0.6, 110); }
  land() { this.tone(140, 0.1, 'sine', 0.6, 70); }
  coin() {
    this.tone(880, 0.09, 'sine', 0.6);
    this.tone(1320, 0.12, 'sine', 0.5);
  }
  powerup() {
    this.tone(523, 0.1, 'triangle', 0.6);
    this.tone(784, 0.14, 'triangle', 0.6);
  }
  shieldBreak() { this.tone(900, 0.25, 'sawtooth', 0.5, 180); }
  crash() { this.tone(220, 0.35, 'sawtooth', 0.8, 55); }
  milestone() {
    this.tone(659, 0.12, 'triangle', 0.6);
    this.tone(880, 0.2, 'triangle', 0.6);
  }
  fever() {
    [440, 554, 659, 880, 1108, 1318].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.14, 'sawtooth', 0.6), i * 35);
    });
  }
  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.25, 'triangle', 0.75), i * 110);
    });
  }
  whoosh() { this.tone(420, 0.25, 'sine', 0.4, 120); }
}

const soundEngine = new SoundEngine();

/* =========================================================================
   BỘ XỬ LÝ HẬU KỲ SHADER WEBGL (POST-PROCESSING ENGINE)
   ========================================================================= */
const VS_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FS_SHADER = `
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_fever;
uniform float u_boost;
uniform float u_shockwave;
uniform vec2 u_shockwave_center;
uniform float u_chromatic;
uniform float u_vignette;
uniform float u_bloom;

varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;

  // 1. Shockwave refraction ripple
  if (u_shockwave > 0.001) {
    vec2 diff = uv - u_shockwave_center;
    diff.x *= u_resolution.x / u_resolution.y;
    float dist = length(diff);
    float waveRadius = u_shockwave * 0.85;
    float waveThickness = 0.08;
    if (dist >= waveRadius - waveThickness && dist <= waveRadius + waveThickness) {
      float diffWave = (dist - waveRadius) / waveThickness;
      float powDiff = 1.0 - pow(abs(diffWave), 0.75);
      float diffFactor = powDiff * 0.035 * (1.0 - u_shockwave);
      vec2 diffNorm = normalize(diff);
      uv += diffNorm * diffFactor;
    }
  }

  // 2. Chromatic Aberration (RGB Split)
  vec2 center = vec2(0.5);
  vec2 dir = uv - center;
  float chromaticFactor = (u_chromatic + (u_boost > 0.0 ? 0.6 : 0.0) + (u_fever > 0.0 ? 1.0 : 0.0)) * 0.008;
  chromaticFactor *= (1.0 + u_speed * 0.035);

  float r = texture2D(u_image, uv - dir * chromaticFactor).r;
  float g = texture2D(u_image, uv).g;
  float b = texture2D(u_image, uv + dir * chromaticFactor).b;
  vec4 color = vec4(r, g, b, 1.0);

  // 3. Luminance Bloom
  vec3 bright = max(color.rgb - vec3(0.62), vec3(0.0));
  color.rgb += bright * (u_bloom + (u_fever > 0.0 ? 0.7 : 0.25)) * 0.65;

  // 4. Subtle Film Grain
  float grain = (fract(sin(dot(uv * (u_time + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
  color.rgb += grain;

  // 5. Cinematic Vignette
  float distVig = length(uv - vec2(0.5));
  float vig = smoothstep(0.85, 0.35, distVig);
  color.rgb *= mix(1.0, vig, u_vignette);

  // 6. Super Fever Flame Tint
  if (u_fever > 0.0) {
    color.rgb += vec3(0.07, 0.015, 0.0) * vig;
  } else if (u_boost > 0.0) {
    color.rgb += vec3(0.05, 0.04, 0.0) * vig;
  }

  gl_FragColor = color;
}
`;

class WebGLShaderEngine {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  public available = false;

  init(canvas: HTMLCanvasElement): boolean {
    try {
      this.gl = canvas.getContext('webgl', { antialias: false, depth: false, preserveDrawingBuffer: false });
      if (!this.gl) return false;
      const gl = this.gl;

      const compileShader = (type: number, src: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = compileShader(gl.VERTEX_SHADER, VS_SHADER);
      const fs = compileShader(gl.FRAGMENT_SHADER, FS_SHADER);
      if (!vs || !fs) return false;

      const prog = gl.createProgram();
      if (!prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      this.program = prog;

      const vertices = new Float32Array([
        -1, -1,  0, 1,
         1, -1,  1, 1,
        -1,  1,  0, 0,
        -1,  1,  0, 0,
         1, -1,  1, 1,
         1,  1,  1, 0,
      ]);

      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  render(
    sourceCanvas: HTMLCanvasElement,
    params: {
      time: number;
      speed: number;
      fever: boolean;
      boost: boolean;
      shockwave: number;
      shockCenter: [number, number];
      chromatic: number;
      bloom: number;
      vignette: number;
    }
  ) {
    if (!this.available || !this.gl || !this.program || !this.texture) return;
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    const aTex = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    const setU1f = (name: string, val: number) => {
      const loc = gl.getUniformLocation(this.program!, name);
      if (loc) gl.uniform1f(loc, val);
    };
    const setU2f = (name: string, x: number, y: number) => {
      const loc = gl.getUniformLocation(this.program!, name);
      if (loc) gl.uniform2f(loc, x, y);
    };

    setU2f('u_resolution', gl.canvas.width, gl.canvas.height);
    setU1f('u_time', params.time);
    setU1f('u_speed', params.speed);
    setU1f('u_fever', params.fever ? 1.0 : 0.0);
    setU1f('u_boost', params.boost ? 1.0 : 0.0);
    setU1f('u_shockwave', params.shockwave);
    setU2f('u_shockwave_center', params.shockCenter[0], params.shockCenter[1]);
    setU1f('u_chromatic', params.chromatic);
    setU1f('u_vignette', params.vignette);
    setU1f('u_bloom', params.bloom);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

/* =========================================================================
   CÁC HÀM TIỆN ÍCH ĐỒ HỌA VECTOR & NỘI SUY
   ========================================================================= */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spikes = 5) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

/* =========================================================================
   CỔNG CHÀO MARATHON 3D (ARCH GATES MỖI 500M)
   ========================================================================= */
function drawArchGate(ctx: CanvasRenderingContext2D, arch: ArchGate, time: number) {
  const gx = arch.x;
  if (gx < -140 || gx > W + 140) return;

  const archTop = GROUND - 126;
  const archW = 110;
  const archH = 126;

  // Cột trụ giàn thép truss hai bên
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(gx - 14, archTop, 16, archH);
  ctx.fillRect(gx + archW - 2, archTop, 16, archH);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  for (let ty = archTop; ty < GROUND; ty += 20) {
    ctx.beginPath();
    ctx.moveTo(gx - 14, ty); ctx.lineTo(gx + 2, ty + 20);
    ctx.moveTo(gx + archW - 2, ty); ctx.lineTo(gx + archW + 14, ty + 20);
    ctx.stroke();
  }

  // Cầu vượt gantry trên cùng
  const beamGrad = ctx.createLinearGradient(gx - 22, archTop, gx + archW + 22, archTop);
  beamGrad.addColorStop(0, '#047857');
  beamGrad.addColorStop(0.5, '#10b981');
  beamGrad.addColorStop(1, '#047857');
  ctx.fillStyle = beamGrad;
  roundRectPath(ctx, gx - 22, archTop - 28, archW + 44, 30, 6);
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bảng LED điện tử
  ctx.fillStyle = '#090d16';
  roundRectPath(ctx, gx - 16, archTop - 24, archW + 32, 22, 4);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`🏁 MỐC ${arch.distanceMark}M 🏁`, gx + archW / 2, archTop - 9);

  // Đèn tín hiệu nhấp nháy 2 bên
  const blink = Math.floor(time * 3) % 2 === 0;
  ctx.fillStyle = blink ? '#ef4444' : '#22c55e';
  ctx.beginPath(); ctx.arc(gx - 10, archTop - 13, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = blink ? '#22c55e' : '#ef4444';
  ctx.beginPath(); ctx.arc(gx + archW + 10, archTop - 13, 4, 0, Math.PI * 2); ctx.fill();

  // Dải cờ đuôi nheo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx - 8, archTop + 2);
  ctx.quadraticCurveTo(gx + archW / 2, archTop + 16, gx + archW + 8, archTop + 2);
  ctx.stroke();

  const flagColors = ['#ef4444', '#3b82f6', '#fbbf24', '#10b981', '#a855f7'];
  for (let fi = 0; fi < 6; fi++) {
    const ft = (fi + 1) / 7;
    const fx = gx - 8 + (archW + 16) * ft;
    const fy = archTop + 2 + Math.sin(ft * Math.PI) * 14;
    ctx.fillStyle = flagColors[fi % flagColors.length];
    ctx.beginPath();
    ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 4, fy); ctx.lineTo(fx, fy + 8);
    ctx.closePath();
    ctx.fill();
  }

  // Cột ánh sáng Spotlight
  const spotGrad = ctx.createLinearGradient(gx + archW / 2, archTop, gx + archW / 2, GROUND);
  spotGrad.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
  spotGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.moveTo(gx + 12, archTop);
  ctx.lineTo(gx + archW - 12, archTop);
  ctx.lineTo(gx + archW + 28, GROUND);
  ctx.lineTo(gx - 28, GROUND);
  ctx.closePath();
  ctx.fill();
}

/* =========================================================================
   HỆ THỐNG HẠT THỜI TIẾT DYNAMIC (WEATHER PARTICLES)
   ========================================================================= */
function drawWeatherParticles(ctx: CanvasRenderingContext2D, particles: WeatherParticle[]) {
  for (const wp of particles) {
    ctx.save();
    if (wp.kind === 'petal') {
      ctx.translate(wp.x, wp.y);
      ctx.rotate(wp.rot);
      ctx.fillStyle = wp.color;
      ctx.beginPath();
      ellipse(ctx, 0, 0, wp.r * 1.5, wp.r * 0.7);
      ctx.fill();
    } else if (wp.kind === 'rain') {
      ctx.strokeStyle = wp.color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(wp.x, wp.y);
      ctx.lineTo(wp.x + wp.vx * 1.8, wp.y + wp.vy * 1.8);
      ctx.stroke();
    } else if (wp.kind === 'firefly') {
      ctx.fillStyle = wp.color;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* =========================================================================
   RIG NHÂN VẬT THỦ TỤC V4 & 3 BỘ TRANG PHỤC SKINS
   ========================================================================= */
interface RunnerPose {
  top: number;
  runCycle: number;
  lean: number;
  squashX: number;
  squashY: number;
  flip: number;
  sliding: boolean;
  airborne: boolean;
  skin?: RunnerSkin;
  inFever?: boolean;
}

function drawRunner(ctx: CanvasRenderingContext2D, p: RunnerPose) {
  const isCyber = p.skin === 'cyber';
  const isChampion = p.skin === 'champion';
  const inFever = !!p.inFever;

  const cx = RUNNER_X + 18;
  const feetY = p.top + RUNNER_H;
  const heightAbove = Math.max(0, GROUND - RUNNER_H - p.top);

  // 1. Bóng đổ mềm dưới mặt đất
  const shScale = Math.max(0.3, 1 - heightAbove / 300);
  ctx.fillStyle = `rgba(15, 23, 42, ${0.28 * shScale})`;
  ellipse(ctx, cx, GROUND + 4, 22 * shScale, 4.5 * shScale);
  ctx.fill();

  // 2. Hào quang Super Fever lửa rực cháy quanh nhân vật
  if (inFever) {
    const pulseF = Math.sin(p.runCycle * 4) * 4;
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ellipse(ctx, RUNNER_X + 18, p.top + 25, 42 + pulseF, 34 + pulseF);
    ctx.fill();
    ctx.fillStyle = 'rgba(249, 115, 22, 0.18)';
    ctx.beginPath();
    ellipse(ctx, RUNNER_X + 18, p.top + 25, 32 + pulseF, 26 + pulseF);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.rotate(p.sliding ? 0 : p.lean);
  ctx.scale(p.sliding ? 1 : p.squashX, p.sliding ? 1 : p.squashY);
  ctx.translate(0, -RUNNER_H);

  // Lộn vòng 360° khi nhảy kép
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

  // =============== TƯ THẾ CÚI TRƯỢT (SLIDE DRIFT) ===============
  if (p.sliding) {
    const grad = ctx.createLinearGradient(0, 8, 0, 30);
    if (isCyber) {
      grad.addColorStop(0, '#06b6d4');
      grad.addColorStop(1, '#0f172a');
    } else if (isChampion) {
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(1, '#b45309');
    } else {
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#059669');
    }
    ctx.fillStyle = grad;
    roundRectPath(ctx, 2, 16, 34, 13, 6);
    ctx.fill();

    ctx.strokeStyle = isCyber ? '#0891b2' : isChampion ? '#78350f' : '#1e3a5f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30, 22);
    ctx.lineTo(48, 30);
    ctx.moveTo(30, 26);
    ctx.lineTo(46, 36);
    ctx.stroke();

    ctx.fillStyle = isCyber ? '#06b6d4' : isChampion ? '#fbbf24' : '#f97316';
    roundRectPath(ctx, 46, 28, 11, 5, 2);
    ctx.fill();
    roundRectPath(ctx, 44, 34, 11, 5, 2);
    ctx.fill();

    ctx.fillStyle = isCyber ? '#fef08a' : '#f2c79b';
    ctx.beginPath();
    ctx.arc(8, 14, 8, 0, Math.PI * 2);
    ctx.fill();

    if (isCyber) {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(8, 12, 6, 3);
    }
    ctx.fillStyle = isCyber ? '#ec4899' : isChampion ? '#e11d48' : '#ef4444';
    ctx.fillRect(1, 8, 14, 4);
    ctx.restore();
    return;
  }

  // =============== TƯ THẾ CHẠY & NHẢY BÌNH THƯỜNG ===============
  // Chân & tay xa
  ctx.strokeStyle = isCyber ? '#0369a1' : isChampion ? '#92400e' : '#172554';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x + swingB * 0.6, hip.y + 10);
  ctx.lineTo(hip.x + swingB, 48 - liftB);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + swingA * 0.5, shoulder.y + 10);
  ctx.stroke();

  // Thân áo BIB theo Skin
  const torsoGrad = ctx.createLinearGradient(0, 14, 0, 34);
  if (isCyber) {
    torsoGrad.addColorStop(0, '#06b6d4');
    torsoGrad.addColorStop(0.55, '#0f172a');
    torsoGrad.addColorStop(1, '#1e1b4b');
  } else if (isChampion) {
    torsoGrad.addColorStop(0, '#fbbf24');
    torsoGrad.addColorStop(0.55, '#f59e0b');
    torsoGrad.addColorStop(1, '#b45309');
  } else {
    torsoGrad.addColorStop(0, '#38bdf8');
    torsoGrad.addColorStop(0.55, '#059669');
    torsoGrad.addColorStop(1, '#065f46');
  }
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(9, 15);
  ctx.quadraticCurveTo(18, 11, 27, 15);
  ctx.lineTo(25, 33);
  ctx.quadraticCurveTo(18, 36, 11, 33);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Quần đùi thể thao
  ctx.fillStyle = isCyber ? '#020617' : isChampion ? '#78350f' : '#1e293b';
  roundRectPath(ctx, 11, 30, 14, 7, 2);
  ctx.fill();

  // Số BIB '06'
  ctx.fillStyle = '#f8fafc';
  roundRectPath(ctx, 13, 20, 10, 9, 2);
  ctx.fill();
  ctx.fillStyle = isCyber ? '#06b6d4' : isChampion ? '#b45309' : '#059669';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('06', 18, 27);

  // Đầu, tóc & Băng đô
  ctx.fillStyle = isCyber ? '#fef08a' : '#f2c79b';
  ctx.beginPath();
  ctx.arc(19, 8, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = isCyber ? '#e2e8f0' : isChampion ? '#fde047' : '#1e293b';
  ctx.beginPath();
  ctx.arc(19, 4.5, 8.5, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isCyber ? '#ec4899' : isChampion ? '#e11d48' : '#ef4444';
  ctx.fillRect(11, 2.5, 16, 3.5);

  if (isCyber) {
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 6;
    roundRectPath(ctx, 20, 6.5, 7, 3.5, 1);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(23, 9, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tay gần + Chân gần + Giày đế phát sáng
  ctx.strokeStyle = isCyber ? '#0891b2' : isChampion ? '#b45309' : '#1e3a5f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + swingB * 0.5, shoulder.y + 10);
  ctx.stroke();

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x + swingA * 0.6, hip.y + 10);
  ctx.lineTo(hip.x + swingA, 48 - liftA);
  ctx.stroke();

  const glowColor = isCyber ? 'rgba(6, 182, 212, 0.65)' : isChampion ? 'rgba(251, 191, 36, 0.65)' : 'rgba(249, 115, 22, 0.55)';
  const shoeGlow = ctx.createRadialGradient(
    hip.x + swingA, 48 - liftA, 1,
    hip.x + swingA, 48 - liftA, 12,
  );
  shoeGlow.addColorStop(0, glowColor);
  shoeGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shoeGlow;
  ellipse(ctx, hip.x + swingA, 48 - liftA, 12, 6);
  ctx.fill();

  ctx.fillStyle = isCyber ? '#06b6d4' : isChampion ? '#fbbf24' : '#f97316';
  roundRectPath(ctx, hip.x + swingA - 2, 46 - liftA, 11, 5, 2);
  ctx.fill();

  ctx.restore();
}

/* =========================================================================
   DẢI RUY BĂNG ĐẦU VẬT LÝ SÓNG GIÓ (10-12 ĐIỂM)
   ========================================================================= */
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

/* =========================================================================
   MÔI TRƯỜNG PARALLAX 6 TẦNG & MẶT ĐƯỜNG CHẠY OLYMPIC CHI TIẾT
   ========================================================================= */
const SKY_PHASES: [string, string][] = [
  ['#fb923c', '#fef3c7'], // Bình minh
  ['#38bdf8', '#e0f2fe'], // Ngày
  ['#7e22ce', '#fb7185'], // Hoàng hôn
  ['#090d16', '#0f766e'], // Đêm Cực quang
];

function drawEnvironment(ctx: CanvasRenderingContext2D, dist: number, time: number) {
  const phaseFloat = (dist / 12000) % 4;
  const phaseIdx = Math.floor(phaseFloat);
  const phaseNext = (phaseIdx + 1) % 4;
  const rawT = phaseFloat - phaseIdx;
  const t = rawT * rawT * (3 - 2 * rawT);
  const top = lerpColor(SKY_PHASES[phaseIdx][0], SKY_PHASES[phaseNext][0], t);
  const horizon = lerpColor(SKY_PHASES[phaseIdx][1], SKY_PHASES[phaseNext][1], t);
  const nightFactor = phaseIdx === 3 ? 1 : phaseIdx === 2 ? t * 0.6 : 0;

  // Lớp 0: Bầu trời
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, top);
  sky.addColorStop(1, horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  // Tia nắng God Rays
  if (nightFactor < 0.7) {
    ctx.save();
    ctx.fillStyle = 'rgba(254, 243, 199, 0.08)';
    for (let r = 0; r < 4; r++) {
      const angle = 0.35 + r * 0.2 + Math.sin(time * 0.5 + r) * 0.04;
      ctx.beginPath();
      ctx.moveTo(800, 62);
      ctx.lineTo(800 - Math.cos(angle) * 550, GROUND);
      ctx.lineTo(800 - Math.cos(angle + 0.1) * 550, GROUND);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Mặt trời / Mặt trăng
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
    // Mặt trăng đêm
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(800, 62, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(794, 58, 5, 0, Math.PI * 2);
    ctx.arc(806, 68, 4, 0, Math.PI * 2);
    ctx.fill();

    // Dải Cực quang đêm (Aurora Borealis)
    ctx.save();
    ctx.fillStyle = 'rgba(20, 184, 166, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 40);
    for (let ax = 0; ax <= W; ax += 80) {
      const ay = 40 + Math.sin(ax * 0.008 + time * 0.8) * 26 + Math.cos(ax * 0.015 - time) * 16;
      ctx.lineTo(ax, ay);
    }
    ctx.lineTo(W, 110);
    ctx.lineTo(0, 110);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Sao đêm
  if (nightFactor > 0.2) {
    for (let i = 0; i < 40; i++) {
      const sx = (i * 197) % W;
      const sy = (i * 47) % 110;
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 3 + i * 1.7));
      ctx.fillStyle = `rgba(255, 255, 255, ${nightFactor * tw * 0.85})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }

  // Lớp 1: Dãy núi tuyết xa xăm (0.05x)
  const off1 = dist * 0.05;
  ctx.fillStyle = nightFactor > 0.5 ? '#134e4a' : '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W + 60; x += 60) {
    const nx = x - (off1 % 60);
    const my = GROUND - 110 - Math.sin((x + off1) * 0.004) * 35;
    ctx.lineTo(nx, my);
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();

  // Lớp 2: Thành phố Eco-Cyber (0.2x)
  const off2 = dist * 0.2;
  const bldgCol = nightFactor > 0.5 ? '#0f172a' : '#94a3b8';
  ctx.fillStyle = bldgCol;
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 85 - off2) % (W + 120)) - 60;
    const bh = 55 + ((i * 37) % 65);
    ctx.fillRect(bx, GROUND - bh, 65, bh);
    // Cửa sổ phát sáng đêm
    if (nightFactor > 0.3) {
      ctx.fillStyle = (i % 2 === 0) ? '#fef08a' : '#38bdf8';
      ctx.globalAlpha = 0.35 * nightFactor;
      for (let wy = GROUND - bh + 6; wy < GROUND - 10; wy += 12) {
        ctx.fillRect(bx + 8, wy, 6, 6);
        ctx.fillRect(bx + 26, wy, 6, 6);
        ctx.fillRect(bx + 44, wy, 6, 6);
      }
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = bldgCol;
    }
  }

  // Lớp 3: Hàng cây & Biển quảng cáo (0.6x)
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
    ctx.fillStyle = nightFactor > 0.5 ? '#064e3b' : '#15803d';
    ctx.beginPath();
    ctx.arc(tx + sway - 8, GROUND - 40, 12, 0, Math.PI * 2);
    ctx.arc(tx + sway + 8, GROUND - 40, 12, 0, Math.PI * 2);
    ctx.arc(tx + sway, GROUND - 50, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // Biển hiệu LED đường đua
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

  // Lớp 4: Khán đài SVĐ khán giả cổ vũ
  const crowdOff = (dist * 0.35) % 80;
  const crowdColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
  for (let cx = -80 - crowdOff; cx < W + 80; cx += 40) {
    const ci = Math.abs(Math.floor(cx * 0.05)) % crowdColors.length;
    const wave = Math.sin(time * 4 + cx) * 2.5;
    ctx.fillStyle = crowdColors[ci];
    ctx.beginPath();
    ctx.arc(cx + 10, GROUND - 18 + wave, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + 7, GROUND - 14 + wave, 6, 8);
  }

  // Lớp 5: MẶT ĐƯỜNG TARTAN ĐIỀN KINH OLYMPIC CHI TIẾT
  const trackHeight = 22;
  const trackTop = GROUND - 10;
  const trackGrad = ctx.createLinearGradient(0, trackTop, 0, trackTop + trackHeight);
  trackGrad.addColorStop(0, '#c2410c');
  trackGrad.addColorStop(0.3, '#ea580c');
  trackGrad.addColorStop(0.85, '#9a3412');
  trackGrad.addColorStop(1, '#7c2d12');
  ctx.fillStyle = trackGrad;
  ctx.fillRect(0, trackTop, W, trackHeight);

  // Vệt phản quang Specular trên mặt đường
  const specGrad = ctx.createLinearGradient(0, trackTop, 0, trackTop + 6);
  specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = specGrad;
  ctx.fillRect(0, trackTop, W, 6);

  // 3 Làn chạy phân cách bằng vạch sơn trắng
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let x = -60; x < W + 60; x += 50) {
    const dx = x - (dist % 50);
    // Vạch làn 1
    ctx.fillRect(dx, trackTop + 5, 24, 2);
    // Vạch làn 2
    ctx.fillRect(dx + 12, trackTop + 14, 24, 2);
  }

  // Gờ giảm tốc FIA 3D (Đỏ & Trắng đan xen)
  for (let x = -40; x < W + 40; x += 24) {
    const cx = x - (dist % 24);
    const isRed = Math.floor((x + dist) / 24) % 2 === 0;
    ctx.fillStyle = isRed ? '#ef4444' : '#ffffff';
    ctx.fillRect(cx, trackTop + trackHeight - 4, 24, 4);
  }

  // Dải LED dẫn hướng rìa đường chạy
  const ledGlow = Math.sin(time * 6) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(56, 189, 248, ${ledGlow})`;
  ctx.fillRect(0, trackTop - 1, W, 1.5);

  // Lớp 6: LÁT CẮT ĐỊA CHẤT ĐA TẦNG DƯỚI LÒNG ĐẤT
  const strata: [number, string][] = [
    [12, '#78350f'], // Tầng đất mùn
    [22, '#475569'], // Tầng đá phiến
    [H - GROUND - 10, '#0f172a'], // Tầng đá huyền thạch obsidian
  ];
  let sy = trackTop + trackHeight;
  for (const [hgt, col] of strata) {
    ctx.fillStyle = col;
    ctx.fillRect(0, sy, W, hgt);
    sy += hgt;
  }

  // Mạch tinh thể thạch anh & ngọc bích phát sáng trong lòng đất
  for (let i = 0; i < 12; i++) {
    const qx = ((i * 163 - dist) % (W + 60)) - 30;
    const qy = GROUND + 16 + ((i * 31) % 36);
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 4 + i * 2.3));
    ctx.save();
    ctx.translate(qx, qy);
    ctx.rotate(0.55);
    ctx.fillStyle = i % 2 === 0 ? `rgba(165, 243, 252, ${0.25 + 0.65 * tw})` : `rgba(167, 243, 208, ${0.25 + 0.65 * tw})`;
    ctx.fillRect(-3, -7, 6, 14);
    drawStar(ctx, 0, 0, 5);
    ctx.fill();
    ctx.restore();
  }

  // Vỉa Magma địa nhiệt phát sáng đáy lòng đất
  const magmaY = H - 8;
  const magmaGrad = ctx.createLinearGradient(0, magmaY, 0, H);
  magmaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
  magmaGrad.addColorStop(1, 'rgba(249, 115, 22, 0.85)');
  ctx.fillStyle = magmaGrad;
  ctx.fillRect(0, magmaY, W, 8);

  // Cỏ lau rung rinh bên đường
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < W; x += 14) {
    const near = Math.max(0, 1 - Math.abs(x - RUNNER_X) / 70);
    const bend = Math.sin(time * 2 + x * 0.05) * 2 + near * 5;
    ctx.beginPath();
    ctx.moveTo(x, trackTop);
    ctx.quadraticCurveTo(x + bend * 0.6, trackTop - 7, x + bend, trackTop - 13);
    ctx.stroke();
  }
}

/* =========================================================================
   HỆ THỐNG VẼ CHƯỚNG NGẠI VẬT CHI TIẾT CAO
   ========================================================================= */
const OB_BOX: Record<ObKind, { w: number; h: number; yTop: number }> = {
  hurdle: { w: 32, h: 36, yTop: GROUND - 36 },
  rock: { w: 36, h: 26, yTop: GROUND - 26 },
  puddle: { w: 46, h: 10, yTop: GROUND - 6 },
  barrel: { w: 26, h: 34, yTop: GROUND - 34 },
  drone: { w: 42, h: 24, yTop: GROUND - 66 },
  branch: { w: 50, h: 20, yTop: GROUND - 68 },
  sign: { w: 40, h: 22, yTop: GROUND - 64 },
};

function drawObstacle(ctx: CanvasRenderingContext2D, ob: Obstacle, time: number) {
  const x = ob.x;
  ctx.save();

  if (ob.kind === 'hurdle') {
    // Rào chắn thể thao với dải phản quang
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 2, GROUND - 36, 4, 36);
    ctx.fillRect(x + 26, GROUND - 36, 4, 36);
    const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#f97316');
    ctx.fillStyle = grad;
    roundRectPath(ctx, x, GROUND - 34, 32, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (ob.kind === 'rock') {
    // Tảng đá Geode nứt mở phát sáng
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + 8, GROUND - 24);
    ctx.lineTo(x + 24, GROUND - 26);
    ctx.lineTo(x + 36, GROUND - 14);
    ctx.lineTo(x + 36, GROUND);
    ctx.closePath();
    ctx.fill();

    // Mạch thạch anh tím nứt mở
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(x + 12, GROUND - 18);
    ctx.lineTo(x + 22, GROUND - 10);
    ctx.lineTo(x + 16, GROUND - 4);
    ctx.closePath();
    ctx.fill();
  } else if (ob.kind === 'puddle') {
    // Vũng nước phản chiếu có sóng gợn
    const pGrad = ctx.createRadialGradient(x + 23, GROUND - 1, 2, x + 23, GROUND - 1, 22);
    pGrad.addColorStop(0, '#38bdf8');
    pGrad.addColorStop(0.7, '#0284c7');
    pGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = pGrad;
    ellipse(ctx, x + 23, GROUND - 1, 23, 5);
    ctx.fill();

    const rip = (Math.sin(time * 5 + ob.seed * 3) + 1) * 0.5;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * rip})`;
    ctx.lineWidth = 1;
    ellipse(ctx, x + 23, GROUND - 1, 14 * rip + 4, 3 * rip + 1);
    ctx.stroke();
  } else if (ob.kind === 'barrel') {
    // Thùng phi công nghiệp có decal cảnh báo
    ctx.fillStyle = '#eab308';
    roundRectPath(ctx, x + 2, GROUND - 34, 22, 34, 4);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 2, GROUND - 24, 22, 4);
    ctx.fillRect(x + 2, GROUND - 14, 22, 4);
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x + 13, GROUND - 26);
  } else if (ob.kind === 'drone') {
    // Drone an ninh với cánh quạt xoay tít và đèn laser quét
    const dy = GROUND - 58 + Math.sin(time * 6 + ob.seed) * 5;
    // Chùm laser quét
    const laserGrad = ctx.createLinearGradient(x + 21, dy + 10, x + 21, GROUND);
    laserGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    laserGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = laserGrad;
    ctx.beginPath();
    ctx.moveTo(x + 18, dy + 10);
    ctx.lineTo(x + 24, dy + 10);
    ctx.lineTo(x + 34, GROUND);
    ctx.lineTo(x + 8, GROUND);
    ctx.closePath();
    ctx.fill();

    // Thân drone
    ctx.fillStyle = '#0f172a';
    roundRectPath(ctx, x + 8, dy + 4, 26, 12, 4);
    ctx.fill();

    // Đèn LED đỏ nhấp nháy
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + 21, dy + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // 2 Cánh quạt xoay
    const propW = Math.abs(Math.sin(time * 30)) * 14 + 4;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 6 - propW / 2, dy + 2);
    ctx.lineTo(x + 6 + propW / 2, dy + 2);
    ctx.moveTo(x + 36 - propW / 2, dy + 2);
    ctx.lineTo(x + 36 + propW / 2, dy + 2);
    ctx.stroke();
  } else if (ob.kind === 'branch') {
    // Cành cây trên cao
    const by = GROUND - 64;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 50, by - 6);
    ctx.quadraticCurveTo(x + 25, by + 4, x, by);
    ctx.stroke();
    ctx.fillStyle = '#15803d';
    ellipse(ctx, x + 16, by + 4, 7, 4);
    ctx.fill();
  } else if (ob.kind === 'sign') {
    // Biển báo chỉ dẫn trên cao
    const sy = GROUND - 62;
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 18, sy + 18, 4, 44);
    ctx.fillStyle = '#0284c7';
    roundRectPath(ctx, x, sy, 40, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SLIDE ↓', x + 20, sy + 12);
  }

  ctx.restore();
}

/* =========================================================================
   HỆ THỐNG VẼ VẬT PHẨM V4
   ========================================================================= */
const ITEM_VALUE: Record<ItemKind, number> = {
  bottle: 50,
  medal: 150,
  eco: 30,
  crystal: 80,
  shield: 0,
  booster: 0,
};

function drawItem(ctx: CanvasRenderingContext2D, item: Item, time: number) {
  const x = item.x;
  const bob = Math.sin(time * 4 + item.bob) * 4;
  const y = item.y + bob;
  ctx.save();

  if (item.kind === 'bottle') {
    // Chai nước khoáng với bong bóng
    ctx.fillStyle = '#0284c7';
    roundRectPath(ctx, x + 6, y + 4, 12, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 8, y + 7, 8, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 9, y + 2, 6, 3);
  } else if (item.kind === 'medal') {
    // Huy chương vàng quay 3D
    ctx.save();
    ctx.translate(x + 12, y + 12);
    ctx.scale(Math.cos(time * 3 + item.bob), 1);
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ca8a04';
    drawStar(ctx, 0, 0, 5);
    ctx.fill();
    ctx.restore();
  } else if (item.kind === 'eco') {
    // Cầu năng lượng sinh thái Eco Orb
    const orbGrad = ctx.createRadialGradient(x + 12, y + 12, 2, x + 12, y + 12, 13);
    orbGrad.addColorStop(0, '#86efac');
    orbGrad.addColorStop(0.7, '#16a34a');
    orbGrad.addColorStop(1, 'rgba(22, 163, 74, 0)');
    ctx.fillStyle = orbGrad;
    ellipse(ctx, x + 12, y + 12, 13, 13);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, x + 12, y + 12, 4);
    ctx.fill();
  } else if (item.kind === 'crystal') {
    // Tinh thể Geo Crystal bát diện
    ctx.save();
    ctx.translate(x + 12, y + 12);
    ctx.rotate(time * 2);
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3e8ff';
    drawStar(ctx, 0, 0, 4);
    ctx.fill();
    ctx.restore();
  } else if (item.kind === 'shield') {
    // Khiên năng lượng
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡', x + 12, y + 15);
  } else if (item.kind === 'booster') {
    // Tăng tốc Booster
    ctx.fillStyle = '#f59e0b';
    roundRectPath(ctx, x + 4, y + 4, 16, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x + 12, y + 16);
  }

  ctx.restore();
}

/* =========================================================================
   TRẠNG THÁI GAMESTATE & OBJECT POOLING
   ========================================================================= */
interface GameState {
  y: number;
  vy: number;
  airborne: boolean;
  jumps: number;
  sliding: boolean;
  slideTime: number;
  speed: number;
  score: number;
  scroll: number;
  distM: number;
  slowTime: number;
  comboTimer: number;
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
  fever: number;
  feverTime: number;
  shockwaveTime: number;
  shockwaveCenter: [number, number];
  hitStopTime: number;
  archGates: ArchGate[];
  weatherParticles: WeatherParticle[];
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
  for (let i = 0; i < 12; i++) ribbon.push({ x: RUNNER_X - 6 - i * 7, y: GROUND - 46 });
  return {
    y: GROUND - RUNNER_H,
    vy: 0,
    airborne: false,
    jumps: 0,
    sliding: false,
    slideTime: 0,
    speed: 4.8,
    score: 0,
    scroll: 0,
    distM: 0,
    slowTime: 0,
    comboTimer: 0,
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
    fever: 0,
    feverTime: 0,
    shockwaveTime: 0,
    shockwaveCenter: [0.15, 0.75],
    hitStopTime: 0,
    archGates: [],
    weatherParticles: [],
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

/* =========================================================================
   BỘ TẠO CHỨNG NHẬN THÀNH TÍCH MARATHON ĐIỆN TỬ (OFFSCREEN 1200x630 CANVAS)
   ========================================================================= */
function generateCertificate(
  stats: FinalStats,
  playerName: string,
  teamName: string,
  skinName: RunnerSkin,
) {
  const cW = 1200;
  const cH = 630;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = cW;
  offCanvas.height = cH;
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return;

  const bgGrad = ctx.createLinearGradient(0, 0, cW, cH);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#022c22');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cW, cH);

  // Lưới trang trí
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < cW; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cH); ctx.stroke();
  }
  for (let y = 0; y < cH; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cW, y); ctx.stroke();
  }

  // Khung viền kim loại đôi
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 4;
  roundRectPath(ctx, 24, 24, cW - 48, cH - 48, 16);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 32, 32, cW - 64, cH - 64, 12);
  ctx.stroke();

  // Tiêu đề
  ctx.textAlign = 'center';
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('★ GIẢI CHẠY THỂ THAO TRỰC TUYẾN GEOENV RUN 2026 ★', cW / 2, 74);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 38px sans-serif';
  ctx.fillText('CHỨNG NHẬN HOÀN THÀNH CỰ LY', cW / 2, 122);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px sans-serif';
  ctx.fillText('Chứng nhận thành tích vận động viên xuất sắc đã nỗ lực chinh phục cung đường chạy', cW / 2, 152);

  const displayName = playerName.trim() || 'Vận Động Viên Khuyết Danh';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(displayName.toUpperCase(), cW / 2, 206);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px sans-serif';
  const displayTeam = teamName.trim() ? `Đội thi đấu: ${teamName}` : 'Hạng mục: Cá Nhân Chuyên Nghiệp';
  ctx.fillText(displayTeam, cW / 2, 234);

  // Ô điểm nhấn cự ly
  const boxW = 540;
  const boxH = 92;
  const boxX = cW / 2 - boxW / 2;
  const boxY = 262;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('TỔNG QUÃNG ĐƯỜNG CHINH PHỤC', cW / 2, boxY + 28);

  ctx.fillStyle = '#10b981';
  ctx.font = '900 46px sans-serif';
  ctx.fillText(`${stats.km.toFixed(2)} KM (${stats.score.toLocaleString('vi-VN')} ĐIỂM)`, cW / 2, boxY + 74);

  // 4 Thẻ chỉ số thành tích
  const cardW = 230;
  const cardH = 88;
  const startX = 115;
  const cardY = 382;
  const metrics = [
    { label: 'DANH HIỆU', val: stats.title, color: '#f59e0b' },
    { label: 'TỐC ĐỘ MAX', val: `${stats.maxSpeedKmh.toFixed(1)} km/h`, color: '#f97316' },
    { label: 'VẬT PHẨM THU THẬP', val: `${stats.items} vật phẩm`, color: '#38bdf8' },
    { label: 'CHUỖI COMBO MAX', val: `×${stats.maxCombo.toFixed(2)} Perfect`, color: '#ec4899' },
  ];

  metrics.forEach((m, idx) => {
    const cx = startX + idx * (cardW + 18);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    roundRectPath(ctx, cx, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(m.label, cx + cardW / 2, cardY + 28);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(m.val, cx + cardW / 2, cardY + 62);
  });

  // Dấu mộc số hóa xác thực
  const stampX = cW - 145;
  const stampY = 530;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(stampX, stampY, 46, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(stampX, stampY, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GEOENV RUN', stampX, stampY - 14);
  ctx.font = '900 12px sans-serif';
  ctx.fillText('★ VERIFIED ★', stampX, stampY + 2);
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('BAN TỔ CHỨC', stampX, stampY + 16);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  ctx.fillText(`Ngày xác lập: ${dateStr}`, 60, 520);
  ctx.fillText(`Trang phục: ${skinName.toUpperCase()} · Phiên bản: GEOENV RUN V4.0`, 60, 542);
  const certId = `GER-2026-${Math.abs(stats.score * 31 + 7919).toString(36).toUpperCase()}`;
  ctx.fillText(`Mã chứng nhận điện tử: #${certId}`, 60, 564);

  const link = document.createElement('a');
  link.download = `chung-nhan-geoenv-run-${displayName.replace(/\s+/g, '-').toLowerCase()}-${stats.score}d.png`;
  link.href = offCanvas.toDataURL('image/png');
  link.click();
}

/* =========================================================================
   COMPONENT CHÍNH: RUNNER GAME
   ========================================================================= */
export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const shaderEngineRef = useRef<WebGLShaderEngine>(new WebGLShaderEngine());

  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [best, setBest] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(window.localStorage.getItem(BEST_KEY) ?? 0);
    return Number.isFinite(v) ? v : 0;
  });
  const [soundOn, setSoundOn] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(SOUND_KEY) : null;
    if (saved !== null) {
      soundEngine.enabled = saved === 'true';
    }
    return soundEngine.enabled;
  });
  const [hud, setHud] = useState({
    km: 0,
    pace: '0:00',
    score: 0,
    speedKmh: 0,
    combo: 1,
    banner: null as string | null,
    fever: 0,
    feverTime: 0,
  });
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [skin, setSkin] = useState<RunnerSkin>(() => {
    const saved = typeof window !== 'undefined' ? (window.localStorage.getItem('geoenv-runner-skin') as RunnerSkin) : 'geoenv';
    return saved === 'cyber' || saved === 'champion' ? saved : 'geoenv';
  });

  const selectSkin = (newSkin: RunnerSkin) => {
    setSkin(newSkin);
    if (typeof window !== 'undefined') window.localStorage.setItem('geoenv-runner-skin', newSkin);
  };

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scoresError, setScoresError] = useState(false);
  const [name, setName] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(NAME_KEY) ?? '' : '',
  );
  const [team, setTeam] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(TEAM_KEY) ?? '' : '',
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const stateRef = useRef<GameState>(initialState());
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef<number>(0);
  const hudAccRef = useRef<number>(0);

  const spawnParticle = useCallback(
    (cfg: Omit<Particle, 'alive' | 'life'>) => {
      const s = stateRef.current;
      const p = s.particles[s.pCursor];
      s.pCursor = (s.pCursor + 1) % s.particles.length;
      p.alive = true;
      p.x = cfg.x;
      p.y = cfg.y;
      p.vx = cfg.vx;
      p.vy = cfg.vy;
      p.r = cfg.r;
      p.life = 0;
      p.maxLife = cfg.maxLife;
      p.color = cfg.color;
      p.additive = cfg.additive;
      p.gravity = cfg.gravity;
      p.rot = cfg.rot;
      p.vRot = cfg.vRot;
      p.shape = cfg.shape;
    },
    [],
  );

  const burst = useCallback(
    (x: number, y: number, color: string, count: number, additive = false) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 1.2 + Math.random() * 4.5;
        spawnParticle({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          r: 1.5 + Math.random() * 2.5,
          maxLife: 0.35 + Math.random() * 0.35,
          color,
          additive,
          gravity: 2.5,
          rot: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 8,
          shape: Math.random() < 0.4 ? 'rect' : 'dot',
        });
      }
    },
    [spawnParticle],
  );

  const spawnText = useCallback((x: number, y: number, text: string, color: string) => {
    const s = stateRef.current;
    const ft = s.texts[s.tCursor];
    s.tCursor = (s.tCursor + 1) % s.texts.length;
    ft.alive = true;
    ft.x = x;
    ft.y = y;
    ft.vy = -38;
    ft.life = 0;
    ft.maxLife = 1.1;
    ft.text = text;
    ft.color = color;
  }, []);

  const loadScores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_scores')
        .select('id, player_name, team_name, score, created_at')
        .order('score', { ascending: false })
        .limit(10);
      if (error) {
        setScoresError(true);
        return;
      }
      setScores((data ?? []) as ScoreRow[]);
      setScoresError(false);
    } catch {
      setScoresError(true);
    }
  }, []);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
      lastTimeRef.current = performance.now();
    }
  }, []);

  const finishRun = useCallback(() => {
    phaseRef.current = 'over';
    setPhase('over');
    soundEngine.crash();
    const s = stateRef.current;
    s.trauma = 1;
    s.crashed = true;
    burst(RUNNER_X + 18, s.y + 20, '#ef4444', 36, true);
    burst(RUNNER_X + 18, s.y + 20, '#f97316', 24, false);
    const finalScore = Math.floor(s.score);
    const rk = rankFor(finalScore);
    const stats: FinalStats = {
      score: finalScore,
      km: s.distM / 1000,
      time: clockRef.current,
      maxSpeedKmh: s.maxSpeed * 3.6,
      maxCombo: s.maxCombo,
      items: s.bottles + s.medals + s.orbs + s.crystals,
      rank: rk.rank,
      title: rk.title,
    };
    setFinalStats(stats);
    if (finalScore > best) {
      setBest(finalScore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(finalScore));
      }
    }
  }, [best, burst]);

  const startGame = useCallback(() => {
    soundEngine.unlock();
    soundEngine.click();
    stateRef.current = initialState();
    clockRef.current = 0;
    lastTimeRef.current = performance.now();
    phaseRef.current = 'playing';
    setPhase('playing');
    setFinalStats(null);
    setSaved(false);
  }, []);

  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (s.sliding) {
      s.sliding = false;
      s.slideTime = 0;
    }
    if (!s.airborne) {
      s.airborne = true;
      s.vy = -16.2;
      s.jumps = 1;
      s.squashX = 0.78;
      s.squashY = 1.35;
      s.squashRecover = 0.22;
      soundEngine.jump();
      burst(RUNNER_X + 18, GROUND, '#ea580c', 8, false);
    } else if (s.jumps < 2) {
      s.jumps = 2;
      s.vy = -14.2;
      s.flipping = true;
      s.flip = 0;
      s.squashX = 0.85;
      s.squashY = 1.25;
      s.squashRecover = 0.2;
      s.shockwaveTime = 0.01;
      s.shockwaveCenter = [(RUNNER_X + 18) / W, (s.y + 25) / H];
      soundEngine.doubleJump();
      burst(RUNNER_X + 18, s.y + 25, '#38bdf8', 16, true);
      s.rings.push({ x: RUNNER_X + 18, y: s.y + 25, r: 8, maxR: 38, alpha: 0.85 });
      spawnText(RUNNER_X + 18, s.y - 12, 'LỘN VÒNG!', '#38bdf8');
    }
  }, [burst, spawnText]);

  const pressJump = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s.airborne || s.jumps < 2) doJump();
    else s.buffer = 0.12;
  }, [doJump]);

  const cutJump = useCallback(() => {
    const s = stateRef.current;
    if (s.airborne && s.vy < -4) s.vy *= 0.45;
  }, []);

  const pressSlide = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (s.airborne) {
      s.fastFall = true;
      s.vy = Math.max(s.vy, 14);
      soundEngine.whoosh();
    } else {
      s.sliding = true;
      s.slideTime = 0.55;
      s.squashX = 1.45;
      s.squashY = 0.6;
      soundEngine.slide();
    }
  }, []);

  /* =========================================================================
     CẬP NHẬT VẬT LÝ & GAMEPLAY CHÍNH
     ========================================================================= */
  const updateGame = useCallback(
    (dtSec: number) => {
      const s = stateRef.current;
      if (s.crashed) return;

      // Xử lý Hit-stop (Micro-pause tạo cảm giác va chạm)
      if (s.hitStopTime > 0) {
        s.hitStopTime -= dtSec;
        return;
      }

      const dt60 = dtSec * 60;
      s.runTime += dtSec;

      if (s.shockwaveTime > 0) {
        s.shockwaveTime += dtSec * 1.8;
        if (s.shockwaveTime > 1.0) s.shockwaveTime = 0;
      }

      if (s.buffer > 0) s.buffer = Math.max(0, s.buffer - dtSec);

      const isBoosted = s.boostTime > 0;
      if (s.boostTime > 0) s.boostTime -= dtSec;

      if (s.comboTimer > 0) {
        s.comboTimer -= dtSec;
        if (s.comboTimer <= 0) s.combo = 1;
      }

      if (s.sliding) {
        s.slideTime -= dtSec;
        if (s.slideTime <= 0) s.sliding = false;
      }

      // Trọng lực rơi
      if (s.airborne) {
        const g = s.fastFall ? 2.2 : 0.88;
        s.vy += g * dt60;
        s.y += s.vy * dt60;
        if (s.y >= GROUND - RUNNER_H) {
          const impact = Math.min(1.5, Math.abs(s.vy) / 14);
          s.airborne = false;
          s.jumps = 0;
          s.fastFall = false;
          s.vy = 0;
          s.y = GROUND - RUNNER_H;
          s.squashX = 1 + 0.25 * impact;
          s.squashY = 1 - 0.22 * impact;
          s.squashRecover = 0.12 + 0.08 * impact;
          s.shockwaveTime = 0.01;
          s.shockwaveCenter = [(RUNNER_X + 18) / W, 0.85];
          soundEngine.land();
          burst(RUNNER_X + 18, GROUND, '#b45309', 6 + Math.round(10 * impact), false);
          s.rings.push({ x: RUNNER_X + 18, y: GROUND + 1, r: 4, maxR: 24 + 16 * impact, alpha: 0.7 });
          if (s.buffer > 0) {
            s.buffer = 0;
            doJump();
          }
        }
      } else {
        s.y = GROUND - RUNNER_H;
        s.vy = 0;
      }

      if (!s.airborne && !s.sliding) s.runCycle += dtSec * (7 + s.speed * 0.9);

      if (s.flipping) {
        s.flip += dtSec * 9;
        if (s.flip >= Math.PI * 2) {
          s.flip = 0;
          s.flipping = false;
        }
      }

      if (s.squashRecover > 0) s.squashRecover -= dtSec;
      const targetX = s.sliding ? 1.35 : s.squashRecover > 0 ? 1.25 : 1;
      const targetY = s.sliding ? 0.65 : s.squashRecover > 0 ? 0.78 : 1;
      const k = 1 - Math.exp(-14 * dtSec);
      s.squashX += (targetX - s.squashX) * k;
      s.squashY += (targetY - s.squashY) * k;

      // Super Fever Decay
      if (s.feverTime > 0) {
        s.feverTime -= dtSec;
        s.fever = 0;
      }

      // Tính toán tốc độ
      if (s.slowTime > 0) s.slowTime -= dtSec;
      const baseSpeed = Math.min(4.8 + s.score * 0.0028, 15.5);
      const slowFactor = s.slowTime > 0 ? 0.7 : 1;
      const feverSpeedMult = s.feverTime > 0 ? 1.45 : isBoosted ? 1.35 : 1;
      s.speed = baseSpeed * feverSpeedMult * slowFactor;
      if (s.speed > s.maxSpeed) s.maxSpeed = s.speed;

      // Điểm số (Super Fever x3 điểm)
      if (s.score < MAX_SCORE) {
        const feverPointMult = s.feverTime > 0 ? 3 : 1;
        s.score = Math.min(s.score + s.speed * 0.24 * s.combo * feverPointMult * dt60, MAX_SCORE);
      }

      s.scroll += s.speed * dt60;
      s.distM += s.speed * dtSec;

      // Cổng chào Marathon 3D mỗi 500M
      const nextGateMark = (Math.floor(s.distM / 500) + 1) * 500;
      if (!s.archGates.some((ag) => ag.distanceMark === nextGateMark) && nextGateMark - s.distM < 500) {
        s.archGates.push({
          x: W + (nextGateMark - s.distM) * 3,
          distanceMark: nextGateMark,
          passed: false,
        });
      }

      for (const arch of s.archGates) {
        arch.x -= s.speed * dt60;
        if (arch.x <= RUNNER_X + 18 && !arch.passed) {
          arch.passed = true;
          soundEngine.fanfare();
          s.score = Math.min(s.score + 200, MAX_SCORE);
          spawnText(W / 2, 70, `🏁 VƯỢT CỔNG ${arch.distanceMark}M! +200Đ`, '#f59e0b');
          burst(RUNNER_X + 18, s.y, '#f43f5e', 16, true);
          burst(RUNNER_X + 18, s.y, '#38bdf8', 16, true);
          burst(RUNNER_X + 18, s.y, '#fbbf24', 16, true);
        }
      }
      s.archGates = s.archGates.filter((ag) => ag.x + 160 > 0);

      // Hạt thời tiết dynamic
      const desiredWeatherCount = 26;
      while (s.weatherParticles.length < desiredWeatherCount) {
        let kind: 'petal' | 'rain' | 'firefly' = 'petal';
        let color = '#fbcfe8';
        let vy = 1 + Math.random() * 1.5;
        let vx = -1.5 - Math.random() * 2;
        let r = 2.5 + Math.random() * 2.5;

        if (s.distM < 1300) {
          kind = 'petal';
          color = Math.random() > 0.4 ? '#fbcfe8' : '#86efac';
          vy = 0.8 + Math.random() * 1.2;
          vx = -1.2 - Math.random() * 2;
        } else if (s.distM < 2500) {
          kind = 'petal';
          color = Math.random() > 0.5 ? '#f59e0b' : '#f97316';
          vy = 1.2 + Math.random() * 1.5;
          vx = -2 - Math.random() * 2.5;
        } else if (s.distM < 3500) {
          kind = 'firefly';
          color = Math.random() > 0.5 ? '#67e8f9' : '#a7f3d0';
          vy = (Math.random() - 0.5) * 0.8;
          vx = -0.6 - Math.random() * 0.8;
          r = 2 + Math.random() * 2;
        } else {
          kind = 'rain';
          color = 'rgba(125, 211, 252, 0.7)';
          vy = 7 + Math.random() * 5;
          vx = -4 - Math.random() * 3;
          r = 1.5;
        }

        s.weatherParticles.push({
          x: Math.random() * (W + 200),
          y: Math.random() * (GROUND - 20),
          vx,
          vy,
          r,
          color,
          kind,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.1,
        });
      }

      for (const wp of s.weatherParticles) {
        wp.x += wp.vx - s.speed * 0.15 * dt60;
        wp.y += wp.vy * dt60;
        wp.rot += wp.vRot * dt60;
        if (wp.y >= GROUND || wp.x < -20) {
          wp.x = W + Math.random() * 100;
          wp.y = Math.random() * (GROUND - 50);
        }
      }

      // Mốc cự ly Finisher
      for (const km of [0.5, 1, 2, 5]) {
        if (s.distM >= km * 1000 && !s.passedKm.has(km)) {
          s.passedKm.add(km);
          s.banner = { text: km === 0.5 ? '500M!' : `${km}KM FINISHER!`, t: 0 };
          soundEngine.milestone();
          burst(RUNNER_X + 18, s.y, '#f59e0b', 14, true);
          burst(RUNNER_X + 18, s.y, '#22c55e', 14, true);
        }
      }
      if (s.banner) {
        s.banner.t += dtSec;
        if (s.banner.t > 2.2) s.banner = null;
      }

      // Sinh chướng ngại vật
      if (s.scroll - s.lastObDist > s.nextGap) {
        const low: ObKind[] = ['hurdle', 'rock', 'puddle', 'barrel'];
        const high: ObKind[] = ['drone', 'branch', 'sign'];
        const pool = Math.random() < 0.65 ? low : high;
        const kind = pool[Math.floor(Math.random() * pool.length)];
        s.obstacles.push({ x: W + 30, kind, seed: Math.random() });
        s.lastObDist = s.scroll;
        s.nextGap = s.speed * (55 + Math.random() * 45);
      }

      // Sinh vật phẩm
      if (s.scroll - s.lastItemDist > s.nextItemGap) {
        const r = Math.random();
        let kind: ItemKind = 'bottle';
        if (r < 0.35) kind = 'bottle';
        else if (r < 0.55) kind = 'medal';
        else if (r < 0.7) kind = 'eco';
        else if (r < 0.8) kind = 'crystal';
        else if (r < 0.92) kind = 'shield';
        else kind = 'booster';
        const itemY = kind === 'medal' || kind === 'crystal' ? GROUND - 85 : GROUND - 40;
        const blocked = s.obstacles.some((o) => Math.abs(o.x - (W + 20)) < 130);
        if (!blocked) {
          s.items.push({ x: W + 20, y: itemY, kind, taken: false, bob: Math.random() * Math.PI });
        }
        s.lastItemDist = s.scroll;
        s.nextItemGap = blocked ? 200 : s.speed * (90 + Math.random() * 80);
      }

      // Di chuyển chướng ngại & vật phẩm (Nam châm hút khi Boost hoặc Fever)
      for (const ob of s.obstacles) {
        ob.x -= s.speed * dt60;
        if (!ob.nearMissed && ob.x < RUNNER_X && ob.x > RUNNER_X - 25 && s.airborne) {
          ob.nearMissed = true;
          s.fever = Math.min(100, s.fever + 8);
          spawnText(RUNNER_X + 18, s.y - 12, '⚡ LƯỚT KHÉO! +8 FEVER', '#a855f7');
        }
      }
      for (const item of s.items) {
        item.x -= s.speed * dt60;
        if ((isBoosted || s.feverTime > 0) && !item.taken) {
          const magnetForce = s.feverTime > 0 ? 0.22 : 0.12;
          item.x += (RUNNER_X + 18 - item.x) * magnetForce * dt60;
          item.y += (s.y + 20 - item.y) * magnetForce * dt60;
        }
      }
      s.obstacles = s.obstacles.filter((o) => o.x + 80 > 0);
      s.items = s.items.filter((item) => item.x + 40 > 0 && !item.taken);

      // Bụi & Tia lửa trượt
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

      // Hạt & chữ bay
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

      if (isBoosted || s.feverTime > 0 || s.flipping) {
        s.ghostTimer += dtSec;
        if (s.ghostTimer > 0.07) {
          s.ghostTimer = 0;
          s.ghosts.push({ x: RUNNER_X, y: s.y, pose: s.runCycle, life: 0.35 });
        }
      }
      for (const g of s.ghosts) g.life -= dtSec;
      s.ghosts = s.ghosts.filter((g) => g.life > 0);

      // Ruy băng
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

      // Camera
      const heightAbove = Math.max(0, GROUND - RUNNER_H - s.y);
      const targetScale = s.speed > 11 || heightAbove > 60 ? 0.94 : 1;
      s.camScale += (targetScale - s.camScale) * (1 - Math.exp(-3 * dtSec));
      const targetCamY = s.airborne ? -heightAbove * 0.22 : 0;
      s.camY += (targetCamY - s.camY) * (1 - Math.exp(-4 * dtSec));
      s.trauma = Math.max(0, s.trauma - dtSec * 1.6);

      s.displayScore += (s.score - s.displayScore) * (1 - Math.exp(-8 * dtSec));

      // Đồng bộ HUD
      hudAccRef.current += dtSec;
      if (hudAccRef.current > 0.1) {
        hudAccRef.current = 0;
        const paceMin = 60 / Math.max(1, s.speed * 3.6);
        const paceMm = Math.floor(paceMin);
        const paceSs = Math.floor((paceMin - paceMm) * 60);
        setHud({
          km: s.distM / 1000,
          pace: `${paceMm}:${String(paceSs).padStart(2, '0')}`,
          score: Math.floor(s.displayScore),
          speedKmh: s.speed * 3.6,
          combo: s.combo,
          banner: s.banner ? s.banner.text : null,
          fever: s.fever,
          feverTime: s.feverTime,
        });
      }

      // Va chạm chướng ngại vật
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

        if (s.feverTime > 0) {
          s.score = Math.min(s.score + 100, MAX_SCORE);
          s.obstacles = s.obstacles.filter((o) => o !== ob);
          s.hitStopTime = 0.035;
          burst(ob.x + 18, obBox.y + 10, '#f97316', 16, true);
          spawnText(ob.x + 18, obBox.y - 12, '🔥 FEVER CRUSH! +100', '#ef4444');
          continue;
        }

        if (ob.kind === 'puddle') {
          s.slowTime = 0.6;
          s.obstacles = s.obstacles.filter((o) => o !== ob);
          burst(ob.x + 22, GROUND - 4, '#38bdf8', 10, false);
          spawnText(RUNNER_X + 18, s.y - 10, 'CHẬM!', '#0284c7');
          continue;
        }

        if (s.shield) {
          s.shield = false;
          s.combo = 1;
          s.comboTimer = 0;
          s.obstacles = s.obstacles.filter((o) => o !== ob);
          s.trauma = 0.6;
          s.hitStopTime = 0.03;
          soundEngine.shieldBreak();
          spawnText(RUNNER_X + 18, s.y - 10, 'KHIÊN VỠ!', '#f59e0b');
          s.rings.push({ x: RUNNER_X + 18, y: s.y + 25, r: 10, maxR: 46, alpha: 0.6 });
        } else {
          finishRun();
          return;
        }
      }

      // Ăn vật phẩm
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
          s.comboTimer = 4;
          if (s.combo > s.maxCombo) s.maxCombo = s.combo;
          soundEngine.coin();
        } else {
          soundEngine.powerup();
        }

        if (item.kind === 'bottle') s.fever = Math.min(100, s.fever + 14);
        else if (item.kind === 'medal') s.fever = Math.min(100, s.fever + 24);
        else if (item.kind === 'eco') s.fever = Math.min(100, s.fever + 12);
        else if (item.kind === 'crystal') s.fever = Math.min(100, s.fever + 20);

        if (s.fever >= 100 && s.feverTime <= 0) {
          s.fever = 0;
          s.feverTime = 6;
          s.shockwaveTime = 0.01;
          s.shockwaveCenter = [(RUNNER_X + 18) / W, 0.75];
          soundEngine.fever();
          s.trauma = 0.55;
          spawnText(W / 2, 80, '🔥 SUPER FEVER MODE! ×3 ĐIỂM!', '#ef4444');
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

  /* =========================================================================
     VẼ TOÀN CẢNH: 2D RENDER -> WEBGL SHADER POST-PROCESS
     ========================================================================= */
  const drawScene = useCallback(() => {
    let offCanvas = offscreenRef.current;
    if (!offCanvas) {
      offCanvas = document.createElement('canvas');
      offCanvas.width = W;
      offCanvas.height = H;
      offscreenRef.current = offCanvas;
    }
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    const time = clockRef.current;
    ctx.clearRect(0, 0, W, H);

    // Camera: zoom + lia Y + rung giảm chấn
    const sh = s.trauma * s.trauma * 12;
    const shX = (Math.random() - 0.5) * 2 * sh;
    const shY = (Math.random() - 0.5) * 2 * sh;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s.camScale, s.camScale);
    ctx.translate(-W / 2 + shX, -H / 2 + s.camY + shY);

    // 1. Môi trường Parallax & Mặt đường chạy Olympic Pro
    drawEnvironment(ctx, s.scroll, time);

    // 2. Hạt thời tiết dynamic
    drawWeatherParticles(ctx, s.weatherParticles);

    // 3. Cổng Chào Marathon 3D mỗi 500M
    for (const arch of s.archGates) {
      drawArchGate(ctx, arch, time);
    }

    // 4. Vết trượt cao su
    for (const sm of s.skidMarks) {
      ctx.fillStyle = `rgba(15, 23, 42, ${sm.alpha * 0.5})`;
      ctx.fillRect(sm.x, GROUND - 2, 16, 3);
    }

    // 5. Dư ảnh tốc độ (Ghost Trail)
    for (const g of s.ghosts) {
      const alpha = (g.life / 0.35) * 0.3;
      ctx.fillStyle = s.feverTime > 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(6, 182, 212, ${alpha})`;
      roundRectPath(ctx, g.x + 2, g.y + 8, 32, 40, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(g.x + 18, g.y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Ruy băng đầu & Nhân vật VĐV V4
    drawRibbon(ctx, s.ribbon);
    drawRunner(ctx, {
      top: s.y + (!s.airborne && !s.sliding ? Math.sin(s.runCycle * 2) * 1.5 : 0),
      runCycle: s.runCycle,
      lean: Math.min(0.22, s.speed * 0.012),
      squashX: s.squashX,
      squashY: s.squashY,
      flip: s.flip,
      sliding: s.sliding,
      airborne: s.airborne,
      skin,
      inFever: s.feverTime > 0,
    });

    // 7. Khiên bảo vệ & Hào quang Booster
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

    // 8. Chướng ngại vật & Vật phẩm
    for (const ob of s.obstacles) drawObstacle(ctx, ob, time);
    for (const item of s.items) {
      if (!item.taken) drawItem(ctx, item, time);
    }

    // 9. Hạt năng lượng (Additive Blending)
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

    // 10. Chữ bay nổi
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

    // 11. Vệt xé gió Warp Speed
    if (phaseRef.current === 'playing' && (s.feverTime > 0 || s.boostTime > 0)) {
      ctx.strokeStyle = s.feverTime > 0 ? 'rgba(255, 120, 50, 0.85)' : 'rgba(250, 204, 21, 0.8)';
      ctx.lineWidth = s.feverTime > 0 ? 2.5 : 2;
      for (let i = 0; i < 8; i++) {
        const ly = 24 + ((i * 37) % (GROUND - 40));
        const lx = W - ((time * 650 + i * 181) % (W + 300)) + 100;
        const len = s.feverTime > 0 ? 90 + (i % 3) * 35 : 65 + (i % 3) * 20;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + len, ly);
        ctx.stroke();
      }
    } else if (phaseRef.current === 'playing' && s.speed > 9) {
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

    // 12. RENDER RA WEBGL SHADER CANVAS (Hoặc 2D Fallback)
    const displayCanvas = canvasRef.current;
    if (!displayCanvas) return;

    const shader = shaderEngineRef.current;
    if (shader.available) {
      shader.render(offCanvas, {
        time,
        speed: s.speed,
        fever: s.feverTime > 0,
        boost: s.boostTime > 0,
        shockwave: s.shockwaveTime,
        shockCenter: s.shockwaveCenter,
        chromatic: s.feverTime > 0 ? 0.9 : s.boostTime > 0 ? 0.6 : 0.2,
        bloom: s.feverTime > 0 ? 0.8 : 0.35,
        vignette: 0.22,
      });
    } else {
      // 2D Fallback nếu không hỗ trợ WebGL
      const dctx = displayCanvas.getContext('2d');
      if (dctx) {
        dctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        dctx.drawImage(offCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
      }
    }
  }, [skin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      if (offscreenRef.current) {
        offscreenRef.current.width = Math.floor(W * dpr);
        offscreenRef.current.height = Math.floor(H * dpr);
      }
    };
    resize();
    shaderEngineRef.current.init(canvas);

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
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        cutJump();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pressJump, pressSlide, togglePause, startGame, cutJump]);

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
          onPointerUp={() => cutJump()}
          className="block h-auto w-full cursor-pointer touch-none select-none"
        />

        {/* HUD HTML THỂ THAO CAO CẤP */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
          <div className="rounded-xl bg-white/80 px-3 py-2 shadow-lg ring-1 ring-slate-900/10 backdrop-blur-md">
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

            {/* Thanh Adrenaline / Super Fever */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-900/20 sm:w-36">
                <div
                  className={`h-full rounded-full transition-all ${
                    stateRef.current.feverTime > 0
                      ? 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 animate-pulse'
                      : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                  }`}
                  style={{
                    width: `${
                      stateRef.current.feverTime > 0
                        ? (stateRef.current.feverTime / 6) * 100
                        : stateRef.current.fever
                    }%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-black tracking-tight text-slate-700">
                {stateRef.current.feverTime > 0
                  ? `🔥 FEVER ${stateRef.current.feverTime.toFixed(1)}s (×3)`
                  : `⚡ ${Math.floor(stateRef.current.fever)}%`}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/80 px-3 py-2 text-right shadow-lg ring-1 ring-slate-900/10 backdrop-blur-md">
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

      {/* Nút cảm ứng trên điện thoại */}
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
          onPointerUp={() => cutJump()}
          aria-label="Nhảy"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-geoenv-600 py-3.5 text-sm font-bold text-white shadow"
        >
          <ArrowUp className="h-5 w-5" />
          Nhảy
        </button>
      </div>

      {/* Bảng điều khiển nút bấm dưới game & Bộ chọn Skin */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bộ chọn Skin */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
            <span className="px-1.5 text-xs font-semibold text-slate-500 hidden sm:inline-flex items-center gap-1">
              <Palette className="h-3.5 w-3.5 text-geoenv-600" /> Skin:
            </span>
            <button
              onClick={() => selectSkin('geoenv')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                skin === 'geoenv' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block ring-1 ring-white" /> GeoEnv Pro
            </button>
            <button
              onClick={() => selectSkin('cyber')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                skin === 'cyber' ? 'bg-slate-900 text-cyan-400 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block ring-1 ring-white" /> Cyber Neon
            </button>
            <button
              onClick={() => selectSkin('champion')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                skin === 'champion' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block ring-1 ring-white" /> Golden Champ
            </button>
          </div>

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
            onClick={() => {
              soundEngine.enabled = !soundEngine.enabled;
              try {
                window.localStorage.setItem(SOUND_KEY, String(soundEngine.enabled));
              } catch {}
              setSoundOn(soundEngine.enabled);
            }}
            aria-label="Bật/tắt âm thanh"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-geoenv-300 hover:text-geoenv-700"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <span className="hidden text-sm text-slate-500 sm:inline">
            Cách: nhảy • ↓: trượt / rơi nhanh • P: tạm dừng
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Kỷ lục: {best.toLocaleString('vi-VN')}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            Khiên ngọc
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Booster
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <Flame className="h-3.5 w-3.5 text-rose-500" />
            Super Fever ×3
          </span>
        </div>
      </div>

      {phase === 'ready' && (
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          Nhảy qua rào chắn & tảng đá, trượt qua drone, cành cây và biển báo trên cao. Nhấn 2 lần
          để lộn vòng nhảy kép 360°.
        </p>
      )}

      {/* Bảng kết thúc ván chạy Game Over */}
      {phase === 'over' && finalStats && (
        <div className="card mt-4 p-5 sm:p-6 border-2 border-geoenv-500/30 shadow-2xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-800">
              <Medal className="h-3.5 w-3.5" />
              Hạng {finalStats.rank} — {finalStats.title}
            </span>
            <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Vấp ngã rồi!</h2>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
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

          {/* Nút Tải Chứng Nhận Thành Tích PNG */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => generateCertificate(finalStats, name, team, skin)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-5 py-2.5 text-xs font-bold text-amber-950 shadow-md transition hover:from-amber-300 hover:to-amber-200 active:scale-98"
            >
              <Download className="h-4 w-4 text-amber-900" />
              Tải Chứng Nhận Thành Tích (PNG)
            </button>
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
