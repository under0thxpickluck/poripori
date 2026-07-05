import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { format } from 'date-fns'
import { useT } from '../../lib/i18n'

export default function AdminUsers() {
  const t = useT()
  const { users, addPoints, changeRole, currentUser } = useStore()
  const user = currentUser()
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState('')

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">{t('管理者権限が必要です')}</div>
  }

  function handleAdd(userId: string) {
    const n = parseInt(addAmount)
    if (!n || n <= 0) return
    addPoints(userId, n)
    setAddingTo(null)
    setAddAmount('')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">{t('ユーザー管理')}</h1>
        <p className="text-text-muted text-sm">{t('ポイント付与・ロール変更')}</p>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="text-left px-5 py-3 font-medium">{t('ユーザー')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('ポイント')}</th>
              <th className="text-center px-4 py-3 font-medium hidden md:table-cell">{t('ロール')}</th>
              <th className="text-center px-4 py-3 font-medium hidden md:table-cell">{t('登録日')}</th>
              <th className="text-right px-5 py-3 font-medium">{t('操作')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        u.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-accent/20 text-accent'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-text font-medium">{u.name}</p>
                      <p className="text-xs text-text-muted">{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-text">
                  {u.points.toLocaleString()} pt
                </td>
                <td className="px-4 py-4 text-center hidden md:table-cell">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-surface-hover text-text-muted'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-text-muted text-xs hidden md:table-cell">
                  {format(new Date(u.createdAt), 'yyyy/MM/dd')}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {addingTo === u.id ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd(u.id)}
                          placeholder="100"
                          className="w-20 px-2 py-1 bg-surface-hover border border-border rounded text-xs text-text outline-none"
                        />
                        <button
                          onClick={() => handleAdd(u.id)}
                          className="text-xs px-2 py-1 rounded bg-yes/20 text-yes border border-yes/30 hover:bg-yes/30 transition-colors"
                        >
                          {t('付与')}
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setAddAmount('') }}
                          className="text-xs px-1.5 py-1 text-text-muted hover:text-text"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setAddingTo(u.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-yes/10 text-yes border border-yes/20 hover:bg-yes/20 transition-colors"
                        >
                          + {t('ポイント')}
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() =>
                              changeRole(u.id, u.role === 'admin' ? 'user' : 'admin')
                            }
                            className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                          >
                            {u.role === 'admin' ? t('Userに変更') : t('Adminに変更')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
