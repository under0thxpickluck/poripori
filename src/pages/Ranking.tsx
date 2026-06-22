import { useStore } from '../store/useStore'
import { Trophy, Medal } from 'lucide-react'

export default function Ranking() {
  const { users, getUserTrades } = useStore()

  const ranked = users
    .map((u) => {
      const trades = getUserTrades(u.id)
      const totalBought = trades.filter((t) => t.action === 'buy').reduce((s, t) => s + t.cost, 0)
      const totalSold = trades.filter((t) => t.action === 'sell').reduce((s, t) => s + t.cost, 0)
      const totalTrades = trades.length
      return { user: u, totalBought, totalSold, totalTrades }
    })
    .sort((a, b) => b.user.points - a.user.points)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">ランキング</h1>
        <p className="text-text-muted text-sm">ポイント残高によるランキング</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ranked.slice(0, 3).map((r, i) => (
          <div
            key={r.user.id}
            className={`bg-surface border rounded-lg p-5 text-center ${
              i === 0
                ? 'border-yellow-500/40'
                : i === 1
                ? 'border-border'
                : 'border-border'
            }`}
          >
            <div className="text-3xl mb-2">{medals[i]}</div>
            <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center text-lg font-bold mx-auto mb-2">
              {r.user.name.charAt(0)}
            </div>
            <p className="text-sm font-semibold text-text">{r.user.name}</p>
            <p className="text-xl font-bold text-text mt-1">{r.user.points.toLocaleString()}</p>
            <p className="text-xs text-text-muted">pt</p>
            <p className="text-xs text-text-muted mt-2">{r.totalTrades} トレード</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" />
          <h2 className="text-sm font-semibold text-text">全ランキング</h2>
        </div>
        <div className="divide-y divide-border">
          {ranked.map((r, i) => (
            <div key={r.user.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`w-7 text-center font-bold ${i < 3 ? 'text-yellow-400' : 'text-text-muted'} text-sm`}>
                {i < 3 ? medals[i] : `${i + 1}`}
              </div>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  r.user.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-accent/20 text-accent'
                }`}
              >
                {r.user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text">{r.user.name}</p>
                  {r.user.role === 'admin' && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">{r.totalTrades} トレード</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-text">{r.user.points.toLocaleString()}</p>
                <p className="text-xs text-text-muted">pt</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
