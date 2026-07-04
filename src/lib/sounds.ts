// Web Audio による合成効果音（音源ファイル不要・すべて 100ms 前後の短音）。
// AudioContext はブラウザの自動再生制限のため「最初のユーザー操作時」に遅延初期化する。
// ミュート設定のみ localStorage に保存する（ポイント・履歴は保存しない）。

const MUTE_KEY = 'miraix_sound_muted'

let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  /* ignore */
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function isMuted(): boolean {
  return muted
}
export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

type ToneSpec = {
  freq: number
  /** 終了周波数（グライド）。省略時は freq のまま */
  to?: number
  type?: OscillatorType
  duration: number
  gain?: number
  delay?: number
}

function tone(spec: ToneSpec) {
  const c = ensureCtx()
  if (!c || muted) return
  const t0 = c.currentTime + (spec.delay ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = spec.type ?? 'sine'
  osc.frequency.setValueAtTime(spec.freq, t0)
  if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, t0 + spec.duration)
  const peak = spec.gain ?? 0.06
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + spec.duration + 0.02)
}

/** タイルを押した瞬間のブリップ（矩形波） */
export function playClick() {
  tone({ freq: 1800, type: 'square', duration: 0.025, gain: 0.018 })
}

/** データ採掘成功。開示数 k に応じて音程が上がっていく（気持ちよさの核）+ シンセアルペジオ */
export function playGem(k: number) {
  const base = 480 * Math.pow(1.06, Math.min(k, 20)) // 半音ずつ上昇
  tone({ freq: base, type: 'sawtooth', duration: 0.09, gain: 0.035 })
  tone({ freq: base * 1.5, type: 'square', duration: 0.07, gain: 0.02, delay: 0.04 })
  tone({ freq: base * 2, type: 'triangle', duration: 0.09, gain: 0.025, delay: 0.08 })
}

/** 倍率アップのFM風ピコ（高倍率帯で playGem に重ねる） */
export function playMultiplierUp() {
  tone({ freq: 1400, to: 2100, type: 'square', duration: 0.06, gain: 0.02 })
}

/** Cash Out 成功（2音上昇シンセ + 高域キラ） */
export function playCashout() {
  tone({ freq: 620, type: 'sawtooth', duration: 0.1, gain: 0.05 })
  tone({ freq: 930, type: 'sawtooth', duration: 0.14, gain: 0.045, delay: 0.08 })
  tone({ freq: 1860, type: 'sine', duration: 0.18, gain: 0.02, delay: 0.12 })
}

/** トラップ（ビットクラッシュ風: 矩形波の急降下 + 低域層） */
export function playBust() {
  tone({ freq: 220, to: 40, type: 'square', duration: 0.2, gain: 0.05 })
  tone({ freq: 120, to: 30, type: 'sawtooth', duration: 0.26, gain: 0.05, delay: 0.01 })
  tone({ freq: 3200, to: 300, type: 'square', duration: 0.08, gain: 0.015 })
}
