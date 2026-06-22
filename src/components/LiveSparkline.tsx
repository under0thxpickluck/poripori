import { useEffect, useRef, useState } from 'react'

const N = 28 // 表示する点数（1分足の直近イメージ）
const TICK_MS = 700
const BASE = 0.5 // 中央を 0（基準）とする

function clamp(v: number) {
  return Math.min(0.95, Math.max(0.05, v))
}

// 基準線(0.5)へ緩やかに引き戻しつつランダムに動く
function step(v: number) {
  return clamp(v + (Math.random() - 0.5) * 0.18 + (BASE - v) * 0.08)
}

function makeInitial() {
  let v = BASE
  const arr: number[] = []
  for (let i = 0; i < N; i++) {
    v = step(v)
    arr.push(v)
  }
  return arr
}

type Pop = { id: number; delta: number; up: boolean; yPct: number }

// 画像のないマーケットのアイコン枠で、中央を0とした基準線つきの動く1分足チャート風表示
export default function LiveSparkline({ className = '' }: { className?: string }) {
  const [vals, setVals] = useState<number[]>(makeInitial)
  const valsRef = useRef(vals)
  const [pops, setPops] = useState<Pop[]>([])
  const popId = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      const prev = valsRef.current
      const next = step(prev[prev.length - 1])
      const arr = [...prev.slice(1), next]
      valsRef.current = arr
      setVals(arr)

      const delta = Math.round((next - BASE) * 200)
      const pid = popId.current++
      const pop: Pop = { id: pid, delta, up: next >= BASE, yPct: (1 - next) * 100 }
      setPops((p) => [...p.slice(-2), pop])
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== pid)), 1100)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const W = 100
  const H = 40
  const mid = H * (1 - BASE) // 基準線のy（v=0.5 → H/2）

  const last = vals[vals.length - 1]
  const up = last >= BASE
  const pts = vals.map((v, i) => [(i / (N - 1)) * W, H - v * H] as const)
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
  const area = `${line} L${W} ${mid} L0 ${mid} Z`
  const lastY = pts[pts.length - 1][1]

  const yesFill = 'rgb(var(--c-yes) / 0.22)'
  const noFill = 'rgb(var(--c-no) / 0.22)'
  const dotColor = up ? 'rgb(var(--c-yes))' : 'rgb(var(--c-no))'

  return (
    <div className={`relative overflow-hidden bg-surface-hover ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <clipPath id="lsTop" clipPathUnits="userSpaceOnUse">
            <rect x="0" y="0" width={W} height={mid} />
          </clipPath>
          <clipPath id="lsBot" clipPathUnits="userSpaceOnUse">
            <rect x="0" y={mid} width={W} height={H - mid} />
          </clipPath>
        </defs>

        <path d={area} fill={yesFill} clipPath="url(#lsTop)" />
        <path d={area} fill={noFill} clipPath="url(#lsBot)" />

        {/* 基準線 (0) */}
        <line
          x1="0"
          y1={mid}
          x2={W}
          y2={mid}
          stroke="rgb(var(--c-text-muted))"
          strokeWidth={0.75}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />

        <path
          d={line}
          fill="none"
          stroke="rgb(var(--c-text) / 0.75)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* 現在位置のガイドとドット */}
        <line
          x1={W}
          y1={mid}
          x2={W}
          y2={lastY}
          stroke={dotColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={W} cy={lastY} r={2} fill={dotColor} vectorEffect="non-scaling-stroke" />
      </svg>

      <span className="absolute top-0.5 left-1 text-[8px] font-medium text-text-muted">1m</span>

      {/* ポロンポロンと浮き出る数値 */}
      {pops.map((p) => (
        <span
          key={p.id}
          className="animate-ls-pop pointer-events-none absolute right-1.5 text-sm font-extrabold tabular-nums drop-shadow"
          style={{ top: `${p.yPct}%`, color: p.up ? 'rgb(var(--c-yes))' : 'rgb(var(--c-no))' }}
        >
          {p.delta >= 0 ? '+' : ''}
          {p.delta}
        </span>
      ))}
    </div>
  )
}
