import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Lock, ShieldAlert } from 'lucide-react'
import { useAuth } from '../store/useAuth'

// 管理者ページ用のゲート。
// 1) DB の role='admin' でなければホームへ戻す（実際の権限はサーバー側 RLS/RPC が強制）。
// 2) その上で管理者パスワードを要求する。
//
// 注意: このパスワードはフロントエンドのバンドルに含まれるため「本物の防御」ではなく、
// 管理画面を気軽に開かせないためのソフトゲート。データ改ざんはサーバー側で防いでいる。
const ADMIN_PASSWORD = 'nagoya01@'
const UNLOCK_KEY = 'admin_unlocked'

export default function AdminGuard() {
  const profile = useAuth((s) => s.profile)
  const ready = useAuth((s) => s.ready)

  const [unlocked, setUnlocked] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(UNLOCK_KEY) === '1'
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  // セッション復元前は判定を保留（チラつき防止）
  if (!ready) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    )
  }

  // 管理者でなければアクセス不可
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (!unlocked) {
    return (
      <div className="flex justify-center py-16 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-text">
            <Lock size={18} className="text-accent" />
            <h1 className="text-base font-semibold">管理者認証</h1>
          </div>
          <p className="text-xs text-text-muted">
            管理画面にアクセスするには管理者パスワードを入力してください。
          </p>
          <input
            type="password"
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (error) setError(false)
            }}
            placeholder="管理者パスワード"
            className="w-full px-3 py-2 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <ShieldAlert size={13} />
              パスワードが違います。
            </p>
          )}
          <button
            type="submit"
            disabled={!input}
            className="w-full px-4 py-2 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            認証する
          </button>
        </form>
      </div>
    )
  }

  return <Outlet />
}
