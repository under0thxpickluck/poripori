import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { format } from 'date-fns'

export default function AdminUsers() {
  const { users, addPoints, changeRole, currentUser } = useStore()
  const user = currentUser()
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState('')

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-red-400">管理者権限が必要です</div>
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
        <h1 className="text-2xl font-bold text-white mb-1">ユーザー管理</h1>
        <p className="text-slate-400 text-sm">ポイント付与・ロール変更</p>
      </div>

      <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2d4a] text-xs text-slate-500">
              <th className="text-left px-5 py-3 font-medium">ユーザー</th>
              <th className="text-right px-4 py-3 font-medium">ポイント</th>
              <th className="text-center px-4 py-3 font-medium hidden md:table-cell">ロール</th>
              <th className="text-center px-4 py-3 font-medium hidden md:table-cell">登録日</th>
              <th className="text-right px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2244]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-[#1e2244] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        u.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-white">
                  {u.points.toLocaleString()} pt
                </td>
                <td className="px-4 py-4 text-center hidden md:table-cell">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-slate-500 text-xs hidden md:table-cell">
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
                          className="w-20 px-2 py-1 bg-[#1e2244] border border-[#2a2d4a] rounded text-xs text-white outline-none"
                        />
                        <button
                          onClick={() => handleAdd(u.id)}
                          className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                        >
                          付与
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setAddAmount('') }}
                          className="text-xs px-1.5 py-1 text-slate-500 hover:text-slate-300"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setAddingTo(u.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          + ポイント
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() =>
                              changeRole(u.id, u.role === 'admin' ? 'user' : 'admin')
                            }
                            className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                          >
                            {u.role === 'admin' ? 'Userに変更' : 'Adminに変更'}
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
