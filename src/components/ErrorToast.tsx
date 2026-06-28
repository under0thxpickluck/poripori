import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useStore } from '../store/useStore'

// 管理操作など（解決・承認・ポイント付与・広告CRUD等）の失敗を画面に表示する。
// 取引(buy/sell)のエラーは TradePanel が個別に表示するためここには出さない。
export default function ErrorToast() {
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 5000)
    return () => clearTimeout(t)
  }, [error, clearError])

  if (!error) return null

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-md">
      <div className="flex items-center gap-2.5 rounded-lg border border-no/40 bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <AlertTriangle size={16} className="shrink-0 text-no" />
        <p className="min-w-0 flex-1 text-sm text-text">{error}</p>
        <button
          onClick={clearError}
          className="shrink-0 text-text-muted transition-colors hover:text-text"
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
