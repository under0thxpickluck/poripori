import { useState } from 'react'
import { UserCog, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { useAuth } from '../store/useAuth'
import {
  IS_LOCAL,
  getLocalUsers,
  switchLocalUser,
  resetLocalDb,
} from '../lib/localClient'

// ローカルデモモード専用。メール認証なしでアカウントを切り替えるための開発用パネル。
// VITE_LOCAL_MODE=1 のときだけ表示される（本番では描画されない）。
export default function DevAccountSwitcher() {
  const profile = useAuth((s) => s.profile)
  const [open, setOpen] = useState(true)
  if (!IS_LOCAL) return null

  const users = getLocalUsers()

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 z-40 w-60 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-lg text-text">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold"
      >
        <UserCog size={14} className="text-accent" />
        <span className="flex-1 text-left">ローカルデモ（認証なし）</span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {open && (
        <div className="border-t border-border p-2 space-y-1">
          {users.map((u) => {
            const active = profile?.id === u.id
            return (
              <button
                key={u.id}
                onClick={() => switchLocalUser(u.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface-hover hover:border-accent/40'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-[11px] font-bold">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                {u.role === 'admin' && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/20' : 'bg-accent/15 text-accent'
                    }`}
                  >
                    admin
                  </span>
                )}
              </button>
            )
          })}

          <button
            onClick={() => resetLocalDb()}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-text-muted hover:text-text"
          >
            <RotateCcw size={12} />
            データをリセット
          </button>
        </div>
      )}
    </div>
  )
}
