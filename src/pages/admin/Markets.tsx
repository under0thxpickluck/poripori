import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { marketPrice } from '../../lib/lmsr'
import { format } from 'date-fns'
import { addDeadline, type DeadlinePreset } from '../../lib/deadline'
import { useT } from '../../lib/i18n'

export default function AdminMarkets() {
  const t = useT()
  const { markets, closeMarket, resolveMarket, extendMarket, currentUser } = useStore()
  const user = currentUser()
  const [resolving, setResolving] = useState<string | null>(null)
  const [extending, setExtending] = useState<string | null>(null)
  const [customDeadline, setCustomDeadline] = useState('')

  const applyPreset = (marketId: string, preset: DeadlinePreset) => {
    extendMarket(marketId, addDeadline(new Date(), preset).toISOString())
    setExtending(null)
    setCustomDeadline('')
  }
  const applyCustom = (marketId: string) => {
    if (!customDeadline) return
    extendMarket(marketId, new Date(customDeadline).toISOString())
    setExtending(null)
    setCustomDeadline('')
  }

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">{t('管理者権限が必要です')}</div>
  }

  const active = markets.filter((m) => m.status === 'open' || m.status === 'closed')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">{t('マーケット管理')}</h1>
        <p className="text-text-muted text-sm">{t('オープン・締切済みマーケットの管理')}</p>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-20 text-text-muted">{t('管理対象のマーケットがありません')}</div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="text-left px-5 py-3 font-medium">{t('質問')}</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">YES%</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">{t('出来高')}</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">{t('締切')}</th>
                <th className="text-right px-5 py-3 font-medium">{t('操作')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {active.map((m) => {
                const price = marketPrice(m)
                return (
                  <tr key={m.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-text font-medium line-clamp-1">{m.question}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-accent">{m.category}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            m.status === 'open'
                              ? 'bg-yes/20 text-yes'
                              : 'bg-surface-hover text-text-muted'
                          }`}
                        >
                          {m.status === 'open' ? t('受付中') : t('締切済み')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <span className="text-yes font-semibold">
                        {Math.round(price.yes * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-text-muted hidden md:table-cell">
                      {m.volume.toLocaleString()} pt
                    </td>
                    <td className="px-4 py-4 text-center text-text-muted hidden md:table-cell">
                      {format(new Date(m.deadline), 'MM/dd')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {m.status === 'open' && (
                          <button
                            onClick={() => closeMarket(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-surface-hover text-text-muted hover:bg-border border border-border transition-colors"
                          >
                            {t('締切')}
                          </button>
                        )}
                        {m.status === 'closed' && (
                          extending === m.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => applyPreset(m.id, '1d')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">{t('+1日')}</button>
                              <button onClick={() => applyPreset(m.id, '3d')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">{t('+3日')}</button>
                              <button onClick={() => applyPreset(m.id, '1w')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">{t('+1週')}</button>
                              <input
                                type="datetime-local"
                                value={customDeadline}
                                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                onChange={(e) => setCustomDeadline(e.target.value)}
                                className="text-xs px-1.5 py-1 rounded-lg bg-surface text-text border border-border"
                              />
                              <button onClick={() => applyCustom(m.id)} disabled={!customDeadline} className="text-xs px-2 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition-colors disabled:opacity-40">{t('確定')}</button>
                              <button onClick={() => { setExtending(null); setCustomDeadline('') }} className="text-xs px-2 py-1 text-text-muted hover:text-text transition-colors"><X size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setExtending(m.id); setCustomDeadline('') }} className="text-xs px-2.5 py-1 rounded-lg bg-surface-hover text-text-muted hover:bg-border border border-border transition-colors">{t('延長')}</button>
                          )
                        )}
                        {resolving === m.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { resolveMarket(m.id, 'YES'); setResolving(null) }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-yes/20 text-yes hover:bg-yes/30 border border-yes/30 transition-colors"
                            >
                              YES
                            </button>
                            <button
                              onClick={() => { resolveMarket(m.id, 'NO'); setResolving(null) }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-no/20 text-no hover:bg-no/30 border border-no/30 transition-colors"
                            >
                              NO
                            </button>
                            <button
                              onClick={() => setResolving(null)}
                              className="text-xs px-2 py-1 text-text-muted hover:text-text transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setResolving(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition-colors"
                          >
                            {t('解決')}
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
