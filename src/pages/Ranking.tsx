import { useState } from 'react'
import { useStore } from '../store/useStore'
import { sellRefund } from '../lib/lmsr'
import { displayName } from '../lib/names'
import { Crown, TrendingUp, Target, Coins } from 'lucide-react'

type MetricKey = 'assets' | 'pnl' | 'hit'

const TABS: { key: MetricKey; label: string; Icon: typeof Coins }[] = [
  { key: 'assets', label: '総資産', Icon: Coins },
  { key: 'pnl', label: '損益', Icon: TrendingUp },
  { key: 'hit', label: '的中率', Icon: Target },
]

export default function Ranking() {
  const { users, markets, positions, getUserTrades, currentUser } = useStore()
  const me = currentUser()
  const [tab, setTab] = useState<MetricKey>('assets')

  const rows = users.map((u) => {
    const trades = getUserTrades(u.id)
    const myPos = positions.filter((p) => p.userId === u.id)
    let posValue = 0
    let wins = 0
    let losses = 0
    myPos.forEach((p) => {
      const m = markets.find((mm) => mm.id === p.marketId)
      if (!m) return
      if (m.status === 'open') {
        if (p.yesShares > 0) posValue += sellRefund(m, 'YES', p.yesShares)
        if (p.noShares > 0) posValue += sellRefund(m, 'NO', p.noShares)
      } else if (m.status === 'resolved') {
        posValue += m.resolved === 'YES' ? p.yesShares : p.noShares
        if (m.resolved === 'YES') {
          if (p.yesShares > 0) wins++
          if (p.noShares > 0) losses++
        } else {
          if (p.noShares > 0) wins++
          if (p.yesShares > 0) losses++
        }
      }
    })
    const buy = trades.filter((t) => t.action === 'buy').reduce((s, t) => s + t.cost, 0)
    const sell = trades.filter((t) => t.action === 'sell').reduce((s, t) => s + t.cost, 0)
    const pnl = posValue - (buy - sell)
    const assets = u.points + posValue
    const decided = wins + losses
    const hit = decided > 0 ? wins / decided : 0
    return { user: u, assets, pnl, hit, decided, wins, trades: trades.length }
  })

  const sorted = [...rows].sort((a, b) => {
    if (tab === 'pnl') return b.pnl - a.pnl
    if (tab === 'hit') return b.hit - a.hit || b.decided - a.decided
    return b.assets - a.assets
  })

  function metric(r: (typeof rows)[0]) {
    if (tab === 'pnl') {
      return {
        main: `${r.pnl >= 0 ? '+' : ''}${Math.round(r.pnl).toLocaleString()}`,
        unit: 'pt',
        color: r.pnl >= 0 ? 'text-yes' : 'text-no',
      }
    }
    if (tab === 'hit') {
      return { main: `${Math.round(r.hit * 100)}`, unit: `% (${r.wins}/${r.decided})`, color: 'text-text' }
    }
    return { main: Math.round(r.assets).toLocaleString(), unit: 'pt', color: 'text-text' }
  }

  const RING = ['ring-yellow-400/70', 'ring-slate-300/60', 'ring-amber-600/60']
  const podium = sorted.slice(0, 3)
  // 中央=1位を強調するため [2位, 1位, 3位] の並びに
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean)
  const myRank = sorted.findIndex((r) => r.user.id === me?.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">ランキング</h1>
        <p className="text-text-muted text-sm">トレーダーの成績ランキング</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-lg w-fit">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 表彰台 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end">
        {podiumOrder.map((r) => {
          const rank = sorted.indexOf(r)
          const m = metric(r)
          const isFirst = rank === 0
          return (
            <div
              key={r.user.id}
              className={`relative bg-surface border rounded-lg p-4 text-center ${
                isFirst ? 'border-yellow-400/40 sm:pb-6 sm:-mt-2' : 'border-border'
              }`}
            >
              {isFirst && (
                <Crown size={20} className="text-yellow-400 mx-auto mb-1" />
              )}
              <div className="text-xs font-bold text-text-muted mb-2">{rank + 1}位</div>
              <div
                className={`w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center text-lg font-bold mx-auto mb-2 ring-2 ${RING[rank]}`}
              >
                {r.user.name.charAt(0)}
              </div>
              <p className="text-sm font-semibold text-text truncate">{displayName(r.user.name, r.user.id, me?.id)}</p>
              <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.main}</p>
              <p className="text-[10px] text-text-muted">{m.unit}</p>
            </div>
          )
        })}
      </div>

      {/* 自分の順位 */}
      {me && myRank >= 0 && (
        <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg px-5 py-3">
          <span className="text-sm font-bold text-accent w-8 text-center">{myRank + 1}</span>
          <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
            {me.name.charAt(0)}
          </div>
          <span className="text-sm font-medium text-text flex-1">{me.name}（あなた）</span>
          <span className={`text-sm font-bold ${metric(sorted[myRank]).color}`}>
            {metric(sorted[myRank]).main}
            <span className="text-xs text-text-muted ml-1">{metric(sorted[myRank]).unit}</span>
          </span>
        </div>
      )}

      {/* 全ランキング */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">全ランキング</h2>
        </div>
        <div className="divide-y divide-border">
          {sorted.map((r, i) => {
            const m = metric(r)
            const isMe = r.user.id === me?.id
            return (
              <div
                key={r.user.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? 'bg-accent/5' : ''}`}
              >
                <div
                  className={`w-7 text-center font-bold text-sm ${
                    i < 3 ? 'text-yellow-400' : 'text-text-muted'
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    r.user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-accent/20 text-accent'
                  }`}
                >
                  {r.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text truncate">{displayName(r.user.name, r.user.id, me?.id)}</p>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded-full shrink-0">
                        あなた
                      </span>
                    )}
                    {r.user.role === 'admin' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">{r.trades} トレード ・ 的中 {Math.round(r.hit * 100)}%</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${m.color}`}>{m.main}</p>
                  <p className="text-xs text-text-muted">{m.unit}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
