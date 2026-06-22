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
        <h1 className="text-2xl font-bold text-white mb-1">ランキング</h1>
        <p className="text-slate-400 text-sm">ポイント残高によるランキング</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ranked.slice(0, 3).map((r, i) => (
          <div
            key={r.user.id}
            className={`bg-[#13162d] border rounded-2xl p-5 text-center ${
              i === 0
                ? 'border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                : i === 1
                ? 'border-slate-400/30'
                : 'border-orange-700/30'
            }`}
          >
            <div className="text-3xl mb-2">{medals[i]}</div>
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg font-bold mx-auto mb-2">
              {r.user.name.charAt(0)}
            </div>
            <p className="text-sm font-semibold text-white">{r.user.name}</p>
            <p className="text-xl font-bold text-white mt-1">{r.user.points.toLocaleString()}</p>
            <p className="text-xs text-slate-500">pt</p>
            <p className="text-xs text-slate-400 mt-2">{r.totalTrades} トレード</p>
          </div>
        ))}
      </div>

      <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2d4a] flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">全ランキング</h2>
        </div>
        <div className="divide-y divide-[#1e2244]">
          {ranked.map((r, i) => (
            <div key={r.user.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`w-7 text-center font-bold ${i < 3 ? 'text-yellow-400' : 'text-slate-500'} text-sm`}>
                {i < 3 ? medals[i] : `${i + 1}`}
              </div>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  r.user.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-indigo-500/20 text-indigo-400'
                }`}
              >
                {r.user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{r.user.name}</p>
                  {r.user.role === 'admin' && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{r.totalTrades} トレード</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{r.user.points.toLocaleString()}</p>
                <p className="text-xs text-slate-500">pt</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
