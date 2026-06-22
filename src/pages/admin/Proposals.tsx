import { useStore } from '../../store/useStore'
import { CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

export default function AdminProposals() {
  const { markets, users, approveMarket, rejectMarket, currentUser } = useStore()
  const user = currentUser()

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-red-400">管理者権限が必要です</div>
  }

  const pending = markets.filter((m) => m.status === 'pending')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">提案の承認</h1>
        <p className="text-slate-400 text-sm">承認待ちのマーケット提案を審査してください</p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p>承認待ちの提案はありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((m) => {
            const creator = users.find((u) => u.id === m.createdBy)
            return (
              <div key={m.id} className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        {m.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        提案者: {creator?.name ?? '不明'}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{m.question}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{m.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#2a2d4a]">
                  <div className="text-xs text-slate-500">
                    締切: {format(new Date(m.deadline), 'yyyy/MM/dd')} ・
                    提案: {format(new Date(m.createdAt), 'MM/dd HH:mm')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMarket(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
                    >
                      <XCircle size={14} />
                      却下
                    </button>
                    <button
                      onClick={() => approveMarket(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={14} />
                      承認
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
