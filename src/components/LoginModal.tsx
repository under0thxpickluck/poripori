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
      <div className="relative z-10 w-full max-w-md mx-4 bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text">アカウントを選択</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => handleLogin(u.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-hover hover:bg-surface-hover border border-border hover:border-accent/50 transition-colors group"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  u.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'bg-accent/20 text-accent ring-1 ring-accent/30'
                }`}
              >
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{u.name}</span>
                  {u.role === 'admin' && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted">
                  {u.points.toLocaleString()} ポイント
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-text transition-colors" />
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
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNew(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-text transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleRegister}
                  disabled={!newName.trim()}
                  className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
                >
                  新規登録（1,000pt付与）
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border hover:border-accent/50 text-sm text-text-muted hover:text-text transition-colors"
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
