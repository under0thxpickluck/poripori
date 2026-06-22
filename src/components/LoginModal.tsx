import { useState } from 'react'
import { X, Plus, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'

type Props = { onClose: () => void }

export default function LoginModal({ onClose }: Props) {
  const { users, login, registerUser } = useStore()
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  function handleLogin(id: string) {
    login(id)
    onClose()
  }

  function handleRegister() {
    const trimmed = newName.trim()
    if (!trimmed) return
    registerUser(trimmed)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-[#13162d] border border-[#2a2d4a] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2d4a]">
          <h2 className="text-lg font-semibold text-white">アカウントを選択</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => handleLogin(u.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1e2244] hover:bg-[#252b5a] border border-[#2a2d4a] hover:border-indigo-500/50 transition-all group"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  u.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30'
                }`}
              >
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{u.name}</span>
                  {u.role === 'admin' && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {u.points.toLocaleString()} ポイント
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          {showNew ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="ユーザー名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                className="w-full px-4 py-2.5 bg-[#1e2244] border border-[#2a2d4a] focus:border-indigo-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNew(false)}
                  className="flex-1 py-2 rounded-lg border border-[#2a2d4a] text-sm text-slate-400 hover:text-white transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleRegister}
                  disabled={!newName.trim()}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
                >
                  新規登録（1,000pt付与）
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#2a2d4a] hover:border-indigo-500/50 text-sm text-slate-400 hover:text-white transition-all"
            >
              <Plus size={16} />
              新しいアカウントを作成
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
