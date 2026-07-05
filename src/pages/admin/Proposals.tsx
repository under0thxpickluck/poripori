import { useStore } from '../../store/useStore'
import { CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useT } from '../../lib/i18n'

export default function AdminProposals() {
  const t = useT()
  const { markets, users, approveMarket, rejectMarket, currentUser } = useStore()
  const user = currentUser()

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">{t('管理者権限が必要です')}</div>
  }

  const pending = markets.filter((m) => m.status === 'pending')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">{t('提案の承認')}</h1>
        <p className="text-text-muted text-sm">{t('承認待ちのマーケット提案を審査してください')}</p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p>{t('承認待ちの提案はありません')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((m) => {
            const creator = users.find((u) => u.id === m.createdBy)
            return (
              <div key={m.id} className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        {m.category}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t('提案者')}: {creator?.name ?? t('不明')}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-text mb-2">{m.question}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{m.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="text-xs text-text-muted">
                    {t('締切')}: {format(new Date(m.deadline), 'yyyy/MM/dd')} ・
                    {t('提案')}: {format(new Date(m.createdAt), 'MM/dd HH:mm')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMarket(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-no/10 border border-no/30 text-no hover:bg-no/20 text-sm font-medium transition-colors"
                    >
                      <XCircle size={14} />
                      {t('却下')}
                    </button>
                    <button
                      onClick={() => approveMarket(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yes/10 border border-yes/30 text-yes hover:bg-yes/20 text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={14} />
                      {t('承認')}
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
