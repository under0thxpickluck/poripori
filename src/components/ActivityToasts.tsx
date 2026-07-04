import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { maskName } from '../lib/names'
import { useT } from '../lib/i18n'

type Toast = {
  id: number
  user: string
  side: 'YES' | 'NO'
  action: 'buy' | 'sell'
  question: string
  amount: number
  to: string
}

// 実際の取引（Supabase Realtime）をライブで通知。フェイクの自動生成は廃止。
export default function ActivityToasts() {
  const t = useT()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    let counter = 0
    const channel = supabase
      .channel('activity-trades')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trades' },
        (payload) => {
          const t = payload.new as {
            user_id: string
            market_id: string
            side: 'YES' | 'NO'
            action: 'buy' | 'sell'
            cost: number
          }
          const { users, markets, currentUserId } = useStore.getState()
          if (t.user_id === currentUserId) return // 自分の取引は通知しない
          const u = users.find((x) => x.id === t.user_id)
          const m = markets.find((x) => x.id === t.market_id)
          if (!m) return
          const id = counter++
          const toast: Toast = {
            id,
            user: maskName(u?.name ?? '匿名'),
            side: t.side,
            action: t.action,
            question: m.question,
            amount: Math.round(Number(t.cost)),
            to: `/market/${m.id}`,
          }
          setToasts((prev) => [...prev.slice(-3), toast])
          setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-30 flex flex-col gap-2 w-72 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <Link
          key={toast.id}
          to={toast.to}
          className="animate-toast-in flex items-center gap-3 rounded-lg border border-border bg-surface/95 backdrop-blur px-3 py-2.5 shadow-lg hover:border-accent/40 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-text">
            {toast.user.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text">
              <span className="font-medium">{toast.user}</span>{' '}
              <span className={`mx-1 font-bold ${toast.side === 'YES' ? 'text-yes' : 'text-no'}`}>{toast.side}</span>
              {t(toast.action === 'buy' ? 'を {n}pt 購入' : 'を {n}pt 売却', { n: toast.amount.toLocaleString() })}
            </p>
            <p className="truncate text-[11px] text-text-muted">{toast.question}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
