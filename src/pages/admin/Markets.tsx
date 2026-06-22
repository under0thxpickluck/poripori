import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { marketPrice } from '../../lib/lmsr'
import { format } from 'date-fns'

export default function AdminMarkets() {
  const { markets, closeMarket, resolveMarket, currentUser } = useStore()
  const user = currentUser()
  const [resolving, setResolving] = useState<string | null>(null)

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-red-400">管理者権限が必要です</div>
  }

  const active = markets.filter((m) => m.status === 'open' || m.status === 'closed')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">マーケット管理</h1>
        <p className="text-slate-400 text-sm">オープン・締切済みマーケットの管理</p>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-20 text-slate-500">管理対象のマーケットがありません</div>
      ) : (
        <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d4a] text-xs text-slate-500">
                <th className="text-left px-5 py-3 font-medium">質問</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">YES%</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">出来高</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">締切</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2244]">
              {active.map((m) => {
                const price = marketPrice(m)
                return (
                  <tr key={m.id} className="hover:bg-[#1e2244] transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium line-clamp-1">{m.question}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-indigo-400">{m.category}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            m.status === 'open'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {m.status === 'open' ? '受付中' : '締切済み'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <span className="text-emerald-400 font-semibold">
                        {Math.round(price.yes * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-400 hidden md:table-cell">
                      {m.volume.toLocaleString()} pt
                    </td>
                    <td className="px-4 py-4 text-center text-slate-400 hidden md:table-cell">
                      {format(new Date(m.deadline), 'MM/dd')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {m.status === 'open' && (
                          <button
                            onClick={() => closeMarket(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 border border-slate-500/30 transition-colors"
                          >
                            締切
                          </button>
                        )}
                        {resolving === m.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { resolveMarket(m.id, 'YES'); setResolving(null) }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                            >
                              YES
                            </button>
                            <button
                              onClick={() => { resolveMarket(m.id, 'NO'); setResolving(null) }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                            >
                              NO
                            </button>
                            <button
                              onClick={() => setResolving(null)}
                              className="text-xs px-2 py-1 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setResolving(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors"
                          >
                            解決
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
