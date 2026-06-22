import { useEffect, useState } from 'react'

const N = 28 // 表示する点数（1分足の直近イメージ）
const TICK_MS = 700

function clamp(v: number) {
  return Math.min(0.92, Math.max(0.08, v))
}

function makeInitial() {
  let v = 0.4 + Math.random() * 0.2
  const arr: number[] = []
  for (let i = 0; i < N; i++) {
    v = clamp(v + (Math.random() - 0.5) * 0.12)
    arr.push(v)
  }
  return arr
}

// 画像のないマーケットのアイコン枠で、ランダムに動く1分足チャート風の表示
export default function LiveSparkline({ className = '' }: { className?: string }) {
  const [vals, setVals] = useState<number[]>(makeInitial)

  useEffect(() => {
    const id = setInterval(() => {
      setVals((prev) => {
        const last = prev[prev.length - 1]
        const next = clamp(last + (Math.random() - 0.5) * 0.16)
        return [...prev.slice(1), next]
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const W = 100
  const H = 40
  const up = vals[vals.length - 1] >= vals[0]
  const pts = vals.map((v, i) => [(i / (N - 1)) * W, H - v * H] as const)
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
  const area = `${line} L${W} ${H} L0 ${H} Z`
  const lastY = pts[pts.length - 1][1]

  return (
    <div className={`relative overflow-hidden bg-surface-hover ${up ? 'text-yes' : 'text-no'} ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <path d={area} fill="currentColor" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={W} cy={lastY} r={1.6} fill="currentColor" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute top-0.5 left-1 text-[8px] font-medium text-text-muted">1m</span>
    </div>
  )
}
