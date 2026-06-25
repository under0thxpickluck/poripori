import { useState } from 'react'
import { X, Plus, ChevronRight, LogIn, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useModalBehavior } from '../hooks/useModalBehavior'

type Props = { onClose: () => void }

export default function LoginModal({ onClose }: Props) {
  useModalBehavior(onClose)
  const { users, login, registerUser } = useStore()
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

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

  function handleCredential(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const u = username.trim().toLowerCase()
    if (u === 'admin' && password === 'admin') {
      login('admin')
      onClose()
      return
    }
    const match = users.find((x) => x.name.toLowerCase() === username.trim().toLowerCase())
    if (match && match.role !== 'admin') {
      login(match.id)
      onClose()
      return
    }
    setError('ユーザー名またはパスワードが違います')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-surface border border-border rounded-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text">ログイン</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* ユーザー名 / パスワードでログイン */}
        <form onSubmit={handleCredential} className="p-4 border-b border-border space-y-2">
          <input
            type="text"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
          {error && <p className="text-xs text-no">{error}</p>}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-sm text-white font-medium transition-colors"
          >
            <LogIn size={16} />
            ログイン
          </button>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted pt-1">
            <ShieldCheck size={12} className="text-accent" />
            管理者はデモ用に <span className="font-mono text-text">admin / admin</span> でログインできます
          </p>
        </form>

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-text-muted">アカウントを選択</p>
        </div>
        <div className="px-4 pb-2 space-y-2 max-h-64 overflow-y-auto">
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
