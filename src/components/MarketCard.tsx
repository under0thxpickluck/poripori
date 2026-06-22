import { Link } from 'react-router-dom'
import { Clock, BarChart2 } from 'lucide-react'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'
import MarketImage from './MarketImage'
import { useTilt } from '../hooks/useTilt'

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-blue-400 bg-blue-400/10',
  Crypto: 'text-orange-400 bg-orange-400/10',
  Sports: 'text-green-400 bg-green-400/10',
  AI: 'text-purple-400 bg-purple-400/10',
  Tech: 'text-cyan-400 bg-cyan-400/10',
  Science: 'text-sky-400 bg-sky-400/10',
  Entertainment: 'text-pink-400 bg-pink-400/10',
}

function formatDeadline(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return '締切済み'
  if (days === 0) return '本日締切'
  if (days <= 7) return `${days}日後`
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, string> = {
  open: '',
  closed: 'bg-surface-hover text-text-muted',
  resolved: 'bg-yes/20 text-yes',
  pending: 'bg-yellow-500/20 text-yellow-400',
}

type Props = { market: Market }

export default function MarketCard({ market }: Props) {
  const price = marketPrice(market)
  const yesPct = Math.round(price.yes * 100)
  const noPct = 100 - yesPct
  const catColor = CATEGORY_COLORS[market.category] ?? 'text-text-muted bg-surface-hover'
  const tilt = useTilt<HTMLAnchorElement>(7)

  return (
    <Link
      ref={tilt.ref}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      to={`/market/${market.id}`}
      style={{ transition: 'transform 150ms ease-out, border-color 200ms, background-color 200ms', willChange: 'transform' }}
      className="relative block overflow-hidden bg-surface hover:bg-surface-hover border border-border hover:border-accent/40 rounded-lg p-5 group"
    >
      <span
        className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          background:
            'radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgb(var(--c-accent) / 0.12), transparent 60%)',
        }}
      />
      <div className="relative z-10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
          {market.category}
        </span>
        {market.status !== 'open' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[market.status]}`}>
            {market.status === 'closed' ? '締切済み' : market.status === 'resolved' ? '解決済み' : '承認待ち'}
          </span>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <MarketImage
          src={market.imageUrl}
          category={market.category}
          className="w-12 h-12 rounded-md shrink-0"
        />
        <p className="text-sm font-medium text-text leading-snug line-clamp-3 group-hover:text-text transition-colors">
          {market.question}
        </p>
      </div>

      {market.status === 'pending' ? (
        <div className="text-xs text-text-muted italic mb-4">承認待ちのため価格は未確定</div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <button className="flex-1 py-2 rounded-lg bg-yes/10 border border-yes/20 text-yes text-sm font-semibold hover:bg-yes/20 transition-colors">
              YES {yesPct}¢
            </button>
            <button className="flex-1 py-2 rounded-lg bg-no/10 border border-no/20 text-no text-sm font-semibold hover:bg-no/20 transition-colors">
              NO {noPct}¢
            </button>
          </div>

          <div className="flex rounded-full overflow-hidden h-1 mb-4">
            <div className="bg-yes transition-all duration-300" style={{ width: `${yesPct}%` }} />
            <div className="bg-no flex-1" />
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <BarChart2 size={11} />
          <span>{market.volume.toLocaleString()} pt</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>{formatDeadline(market.deadline)}</span>
        </div>
      </div>

      {market.status === 'resolved' && market.resolved && (
        <div
          className={`mt-3 text-center text-xs font-bold py-1.5 rounded-lg ${
            market.resolved === 'YES'
              ? 'bg-yes/15 text-yes'
              : 'bg-no/15 text-no'
          }`}
        >
          結果: {market.resolved}
        </div>
      )}
      </div>
    </Link>
  )
}
