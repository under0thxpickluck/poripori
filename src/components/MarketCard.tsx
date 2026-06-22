import { Link } from 'react-router-dom'
import { Clock, BarChart2 } from 'lucide-react'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'

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
  closed: 'bg-slate-500/20 text-slate-400',
  resolved: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
}

type Props = { market: Market }

export default function MarketCard({ market }: Props) {
  const price = marketPrice(market)
  const yesPct = Math.round(price.yes * 100)
  const noPct = 100 - yesPct
  const catColor = CATEGORY_COLORS[market.category] ?? 'text-slate-400 bg-slate-400/10'

  return (
    <Link
      to={`/market/${market.id}`}
      className="block bg-[#13162d] hover:bg-[#1a1d3e] border border-[#2a2d4a] hover:border-indigo-500/40 rounded-2xl p-5 transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,102,241,0.08)] group"
    >
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

      <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-4 group-hover:text-indigo-100 transition-colors">
        {market.question}
      </p>

      {market.status === 'pending' ? (
        <div className="text-xs text-slate-500 italic mb-4">承認待ちのため価格は未確定</div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <button className="flex-1 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
              YES {yesPct}¢
            </button>
            <button className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">
              NO {noPct}¢
            </button>
          </div>

          <div className="flex rounded-full overflow-hidden h-1 mb-4">
            <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${yesPct}%` }} />
            <div className="bg-red-500 flex-1" />
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
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
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
          }`}
        >
          結果: {market.resolved}
        </div>
      )}
    </Link>
  )
}
