import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useModalBehavior } from '../hooks/useModalBehavior'
import { useT } from '../lib/i18n'

type Props = {
  title?: string
  onClose: () => void
  children: ReactNode
}

// スマホ向けのボトムシート（下から せり上がる）。md以上では中央モーダル表示。
export default function BottomSheet({ title, onClose, children }: Props) {
  const t = useT()
  useModalBehavior(onClose)
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet-in relative z-10 w-full sm:max-w-md max-h-[88vh] flex flex-col bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-border sm:hidden" />
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('閉じる')}
            className="w-9 h-9 -mr-2 flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
