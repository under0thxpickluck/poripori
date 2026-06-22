import { useEffect, useState } from 'react'

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

// 画像のないマーケットのアイコン枠で、中央を0とした基準線つきの動く1分足チャート風表示
export default function LiveSparkline({ className = '' }: { className?: string }) {
  const [vals, setVals] = useState<number[]>(makeInitial)

  useEffect(() => {
    const id = setInterval(() => {
      setVals((prev) => [...prev.slice(1), step(prev[prev.length - 1])])
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
  // 折れ線と基準線の間を塗る（上側は緑・下側は赤にクリップ）
  const area = `${line} L${W} ${mid} L0 ${mid} Z`
  const lastY = pts[pts.length - 1][1]

  const yesFill = 'rgb(var(--c-yes) / 0.22)'
  const noFill = 'rgb(var(--c-no) / 0.22)'
  const dotColor = up ? 'rgb(var(--c-yes))' : 'rgb(var(--c-no))'
  const delta = Math.round((last - BASE) * 200) // 基準線からの位置 (-90〜+90)

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
      <span className="absolute top-0.5 right-1 text-[8px] font-bold" style={{ color: dotColor }}>
        {delta >= 0 ? '+' : ''}
        {delta}
      </span>
    </div>
  )
}
