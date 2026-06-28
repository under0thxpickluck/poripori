import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'

function TickerItem({ m }: { m: Market }) {
  const yes = Math.round(marketPrice(m).yes * 100)
  const leadingYes = yes >= 50
  return (
    <Link to={`/market/${m.id}`} className="group flex shrink-0 items-center gap-2 rounded px-1.5">
      <span className="max-w-[180px] truncate text-xs font-medium text-text-muted transition-colors group-hover:text-text">
        {m.question}
      </span>
      <span className="text-xs font-bold text-text">{yes}%</span>
      <span
        className={`flex items-center gap-0.5 text-xs font-semibold ${
          leadingYes ? 'text-yes' : 'text-no'
        }`}
      >
        {leadingYes ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      </span>
    </Link>
  )
}

// 実データのライブティッカー（現在のYES確率を流す。フェイクの変動値は廃止）
export default function LiveTicker({ markets }: { markets: Market[] }) {
  const items = markets.slice(0, 16)
  if (items.length === 0) return null

  const loop = [...items, ...items] // シームレスループ用に2連結

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
          {loop.map((m, i) => (
            <TickerItem key={`${m.id}-${i}`} m={m} />
          ))}
        </div>
      </div>
    </div>
  )
}
