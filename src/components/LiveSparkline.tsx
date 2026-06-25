// 画像のないマーケット用の静的プレースホルダ（以前はフェイクのアニメだった）。
// データと無関係に動かないよう、固定の穏やかなチャート風グラフィックを表示する。
const VALS = [0.5, 0.54, 0.49, 0.56, 0.62, 0.58, 0.64, 0.6, 0.67, 0.63, 0.7, 0.66]

export default function LiveSparkline({ className = '' }: { className?: string }) {
  const W = 100
  const H = 40
  const n = VALS.length
  const pts = VALS.map((v, i) => [(i / (n - 1)) * W, H - v * H] as const)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${W} ${H} L0 ${H} Z`

  return (
    <div className={`relative overflow-hidden bg-surface-hover ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-accent) / 0.22)" />
            <stop offset="100%" stopColor="rgb(var(--c-accent) / 0.02)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" />
        <path
          d={line}
          fill="none"
          stroke="rgb(var(--c-accent) / 0.7)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
