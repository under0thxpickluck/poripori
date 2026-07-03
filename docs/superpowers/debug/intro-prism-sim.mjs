// introPrismScene.ts の破片シェーダーを忠実に再現し、終盤の画面上の動きを可視化する
// 変種: original = バグ当時のコード（重力 -0.55t^2・寿命一律1.8s）
//       fixed    = 出荷した修正（重力有界 t^2/(1+t^2)・寿命1.25〜2.1sランダム）
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const OUT = dirname(fileURLToPath(import.meta.url))

// ---- seeded RNG ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- particles (makeBurstPoints と同じ分布) ----
const N = 1100
const palette = [
  [1, 1, 1], [1, 1, 1],
  [0.812, 0.878, 1], [0.62, 0.773, 1],
  [1, 0.851, 0.627], [0.91, 0.784, 1],
]
function makeParticles(seed) {
  const rnd = mulberry32(seed)
  const parts = []
  for (let i = 0; i < N; i++) {
    const R = 1.05
    let x = 0, y = 0, z = 0
    do {
      x = (rnd() * 2 - 1) * R
      y = (rnd() * 2 - 1) * R
      z = (rnd() * 2 - 1) * R
    } while (Math.abs(x) + Math.abs(y) + Math.abs(z) > R)
    const up = 0.25 + rnd() * 0.55
    const len = Math.hypot(x, up, z)
    const speed = 0.9 + rnd() * 2.6
    parts.push({
      p0: [x, y, z],
      vel: [(x / len) * speed, (up / len) * speed, (z / len) * speed],
      col: palette[(rnd() * palette.length) | 0],
      size: 0.35 + rnd() * 1.15,
      phase: rnd() * Math.PI * 2,
    })
  }
  return parts
}

// ---- camera (PerspectiveCamera(38, 16/9), pos(0,1.05,4.9) lookAt(0,0.05,0)) ----
const camPos = [0, 1.05, 4.9]
const aspect = 16 / 9
const tanHalf = Math.tan((38 / 2) * (Math.PI / 180))
function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l) }
const zAxis = norm([0, 1.0, 4.9]) // pos - target
const yAxis = [0, zAxis[2], -zAxis[1]] // cross(z,x)
function project(p) {
  const rel = [p[0] - camPos[0], p[1] - camPos[1], p[2] - camPos[2]]
  const xc = rel[0]
  const yc = rel[1] * yAxis[1] + rel[2] * yAxis[2]
  const zc = rel[1] * zAxis[1] + rel[2] * zAxis[2]
  const mz = -zc // 手前が正
  if (mz < 0.1) return null // near clip（点は中心でクリップ）
  const xn = xc / (aspect * tanHalf * mz)
  const yn = yc / (tanHalf * mz)
  return { xn, yn, mz }
}

// ---- shader math variants ----
const VARIANTS = {
  original: {
    fall: (t) => 0.55 * t * t,
    life: () => 1.8,
  },
  fixed: {
    fall: (t) => (0.55 * t * t) / (1 + t * t),
    life: (pt) => 1.25 + 0.85 * (pt.phase / (Math.PI * 2)),
  },
}
function posAt(pt, t, v) {
  const damp = 1 - Math.exp(-t * 1.6)
  const k = damp * 1.2
  return [
    pt.p0[0] + pt.vel[0] * k,
    pt.p0[1] + pt.vel[1] * k - v.fall(t),
    pt.p0[2] + pt.vel[2] * k,
  ]
}
function envAt(pt, t, v) {
  const life = Math.min(t / v.life(pt), 1)
  return 1 - life * life
}
function alphaAt(pt, t, v) {
  const twinkle = 0.55 + 0.45 * Math.sin(t * 12 + pt.phase)
  return twinkle * envAt(pt, t, v)
}
function containerFade(t) {
  // FADE_START=3.6, TOTAL=4.6, burst at 2.7 → bt基準で0.9からフェード
  return Math.max(0, Math.min(1, 1 - (t - 0.9) / 1.0))
}
function pointSizePx(pt, t, mz, H, v) {
  const life = Math.min(t / v.life(pt), 1)
  const ps1080 = (pt.size * (36 + life * 14)) / Math.max(0.1, mz)
  return ps1080 * (H / 1080)
}

// ---- BMP writer (24bit) ----
function writeBMP(path, buf, W, H) {
  const rowSize = Math.ceil((W * 3) / 4) * 4
  const dataSize = rowSize * H
  const file = Buffer.alloc(54 + dataSize)
  file.write('BM', 0)
  file.writeUInt32LE(54 + dataSize, 2)
  file.writeUInt32LE(54, 10)
  file.writeUInt32LE(40, 14)
  file.writeInt32LE(W, 18)
  file.writeInt32LE(H, 22)
  file.writeUInt16LE(1, 26)
  file.writeUInt16LE(24, 28)
  file.writeUInt32LE(dataSize, 34)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      const o = 54 + (H - 1 - y) * rowSize + x * 3
      file[o] = Math.min(255, Math.round(buf[i + 2] * 255))
      file[o + 1] = Math.min(255, Math.round(buf[i + 1] * 255))
      file[o + 2] = Math.min(255, Math.round(buf[i] * 255))
    }
  }
  writeFileSync(path, file)
}

const W = 480, H = 270
function splat(buf, sx, sy, radius, col, w) {
  const r = Math.max(radius, 0.8)
  const x0 = Math.max(0, Math.floor(sx - r)), x1 = Math.min(W - 1, Math.ceil(sx + r))
  const y0 = Math.max(0, Math.floor(sy - r)), y1 = Math.min(H - 1, Math.ceil(sy + r))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - sx, y - sy) / r
      if (d > 1) continue
      const I = Math.exp(-5 * d * d) * w
      const i = (y * W + x) * 3
      buf[i] += col[0] * I
      buf[i + 1] += col[1] * I
      buf[i + 2] += col[2] * I
    }
  }
}

const parts = makeParticles(12345)

// ---- 1) frame renders ----
for (const [name, v] of Object.entries(VARIANTS)) {
  for (const t of [0.6, 1.0, 1.3, 1.6, 1.8]) {
    const buf = new Float32Array(W * H * 3)
    const fade = containerFade(t)
    for (const pt of parts) {
      const pr = project(posAt(pt, t, v))
      if (!pr) continue
      if (Math.abs(pr.xn) > 1 || Math.abs(pr.yn) > 1) continue // GLは点中心でクリップ
      const a = alphaAt(pt, t, v) * fade
      if (a <= 0.001) continue
      const sx = ((pr.xn + 1) / 2) * W
      const sy = ((1 - pr.yn) / 2) * H
      splat(buf, sx, sy, pointSizePx(pt, t, pr.mz, H, v) / 2, pt.col, a)
    }
    writeBMP(join(OUT, `frame_${name}_t${t.toFixed(1)}.bmp`), buf, W, H)
  }
}

// ---- 2) motion trails (t=1.0→1.8, 青→赤で時間を表現) ----
for (const [name, v] of Object.entries(VARIANTS)) {
  const buf = new Float32Array(W * H * 3)
  for (let t = 1.0; t <= 1.8; t += 0.04) {
    const prog = (t - 1.0) / 0.8
    const col = [prog, 0.15, 1 - prog] // 青→赤
    const fade = containerFade(t)
    for (const pt of parts) {
      const pr = project(posAt(pt, t, v))
      if (!pr) continue
      if (Math.abs(pr.xn) > 1 || Math.abs(pr.yn) > 1) continue
      const a = envAt(pt, t, v) * fade
      if (a <= 0.001) continue
      const sx = ((pr.xn + 1) / 2) * W
      const sy = ((1 - pr.yn) / 2) * H
      splat(buf, sx, sy, 1.2, col, a * 0.5)
    }
  }
  writeBMP(join(OUT, `trail_${name}.bmp`), buf, W, H)
}

// ---- 3) metrics ----
for (const [name, v] of Object.entries(VARIANTS)) {
  console.log(`\n=== ${name} ===`)
  console.log('  t   visible  meanR(重み付き)  inward%  central%(r<0.4の光量)  clipped')
  for (const t of [0.9, 1.1, 1.3, 1.5, 1.7]) {
    const fade = containerFade(t)
    let wsum = 0, rsum = 0, nvis = 0, inward = 0, moving = 0, clipped = 0
    let lumIn = 0, lumAll = 0
    for (const pt of parts) {
      const pr = project(posAt(pt, t, v))
      if (!pr || Math.abs(pr.xn) > 1 || Math.abs(pr.yn) > 1) { clipped++; continue }
      const env = envAt(pt, t, v) * fade // twinkleは平均0.55なので除外
      if (env <= 0.02) continue
      nvis++
      const r = Math.hypot(pr.xn, pr.yn)
      const wgt = env * pt.size
      wsum += wgt; rsum += r * wgt
      const sizePx = pointSizePx(pt, t, pr.mz, 1080, v)
      const lum = env * sizePx * sizePx
      lumAll += lum
      if (r < 0.4) lumIn += lum
      const pr2 = project(posAt(pt, t + 0.1, v))
      if (pr2) {
        const r2 = Math.hypot(pr2.xn, pr2.yn)
        moving++
        if (r2 < r - 0.005) inward++
      }
    }
    console.log(
      `  ${t.toFixed(1)}  ${String(nvis).padStart(5)}   ${(rsum / (wsum || 1)).toFixed(3)}          ${((inward / (moving || 1)) * 100).toFixed(0)}%      ${((lumIn / (lumAll || 1)) * 100).toFixed(0)}%                  ${clipped}`
    )
  }
}

// ---- 4) 画面端まで届いた粒子の追跡（ふちっこだったやつはどこへ行く？）----
console.log('\n=== 画面端(r>0.8)に居た粒子のその後 (fixed) ===')
const v = VARIANTS.fixed
const edgeAtT = 1.0
let tracked = 0
for (const pt of parts) {
  if (tracked >= 12) break
  const pr = project(posAt(pt, edgeAtT, v))
  if (!pr || Math.abs(pr.xn) > 1 || Math.abs(pr.yn) > 1) continue
  const r = Math.hypot(pr.xn, pr.yn)
  if (r < 0.8) continue
  tracked++
  const path = []
  for (let t = 1.0; t <= 1.8; t += 0.2) {
    const p2 = project(posAt(pt, t, v))
    if (!p2) { path.push('clip'); continue }
    const out = Math.abs(p2.xn) > 1 || Math.abs(p2.yn) > 1
    path.push(`${Math.hypot(p2.xn, p2.yn).toFixed(2)}${out ? '(外)' : ''}`)
  }
  console.log(`  vel=(${pt.vel.map((x) => x.toFixed(1))}) r: ${path.join(' → ')}`)
}
