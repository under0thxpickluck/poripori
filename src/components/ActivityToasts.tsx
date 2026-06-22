import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { marketPrice } from '../lib/lmsr'

type Toast = {
  id: number
  user: string
  side: 'YES' | 'NO'
  question: string
  amount: number
  to: string
}

export default function ActivityToasts() {
  const { markets, users } = useStore()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const open = markets.filter((m) => m.status === 'open')
    const realUsers = users.filter((u) => u.role !== 'admin')
    if (open.length === 0 || realUsers.length === 0) return

    let counter = 0
    function spawn() {
      const m = open[Math.floor(Math.random() * open.length)]
      const u = realUsers[Math.floor(Math.random() * realUsers.length)]
      const side: 'YES' | 'NO' = Math.random() < marketPrice(m).yes ? 'YES' : 'NO'
      const amount = Math.floor(20 + Math.random() * 480)
      const id = counter++
      setToasts((t) => [...t.slice(-3), { id, user: u.name, side, question: m.question, amount, to: `/market/${m.id}` }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
    }

    const first = setTimeout(spawn, 2500)
    const id = setInterval(spawn, 5200)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [markets, users])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-72 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <Link
          key={t.id}
          to={t.to}
          className="animate-toast-in flex items-center gap-3 rounded-lg border border-border bg-surface/95 backdrop-blur px-3 py-2.5 shadow-lg hover:border-accent/40 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-text">
            {t.user.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text">
              <span className="font-medium">{t.user}</span> が
              <span className={`mx-1 font-bold ${t.side === 'YES' ? 'text-yes' : 'text-no'}`}>{t.side}</span>
              を {t.amount.toLocaleString()}pt 購入
            </p>
            <p className="truncate text-[11px] text-text-muted">{t.question}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
