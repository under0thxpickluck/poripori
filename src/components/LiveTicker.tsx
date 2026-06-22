import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'

const TICK_MS = 1500

// 金融端末風のライブ価格ティッカー（横に流れ続け、各銘柄の変化率がリアルタイムに動く）
export default function LiveTicker({ markets }: { markets: Market[] }) {
  const items = markets.slice(0, 16)
  const [deltas, setDeltas] = useState<number[]>(() => items.map(() => (Math.random() - 0.5) * 4))

  useEffect(() => {
    const id = setInterval(() => {
      setDeltas((ds) =>
        ds.map((d) => Math.max(-9, Math.min(9, d + (Math.random() - 0.5) * 1.4)))
      )
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  if (items.length === 0) return null

  const row = items.map((m, i) => ({
    m,
    yes: Math.round(marketPrice(m).yes * 100),
    d: deltas[i] ?? 0,
  }))
  const loop = [...row, ...row] // シームレスループ用に2連結

  return (
    <div className="relative mb-6 rounded-lg border border-border bg-surface/60 overflow-hidden">
      {/* LIVE バッジ */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-1.5 pl-3 pr-5 bg-surface border-r border-border">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-no opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-no" />
        </span>
        <span className="text-[10px] font-bold tracking-widest text-text">LIVE</span>
      </div>

      {/* スクロール本体 */}
      <div className="ticker-mask overflow-hidden pl-20">
        <div className="flex w-max gap-6 py-2.5 animate-ticker hover:[animation-play-state:paused]">
          {loop.map((it, i) => {
            const up = it.d >= 0
            return (
              <Link
                key={i}
                to={`/market/${it.m.id}`}
                className="group flex shrink-0 items-center gap-2"
              >
                <span className="max-w-[180px] truncate text-xs font-medium text-text-muted transition-colors group-hover:text-text">
                  {it.m.question}
                </span>
                <span className="text-xs font-bold text-text">{it.yes}%</span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                    up ? 'text-yes' : 'text-no'
                  }`}
                >
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? '+' : ''}
                  {it.d.toFixed(1)}%
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
