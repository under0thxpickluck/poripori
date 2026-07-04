import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, Wallet, Trophy, PlusCircle, LayoutDashboard, CornerDownLeft } from 'lucide-react'
import { useStore } from '../store/useStore'
import { marketPrice } from '../lib/lmsr'
import { useT } from '../lib/i18n'

type Item = {
  id: string
  label: string
  sub?: string
  to: string
  icon: typeof Search
  group: 'ページ' | 'マーケット'
}

const NAV_ITEMS: Item[] = [
  { id: 'nav-home', label: 'マーケット一覧', to: '/', icon: TrendingUp, group: 'ページ' },
  { id: 'nav-portfolio', label: 'ポートフォリオ', to: '/portfolio', icon: Wallet, group: 'ページ' },
  { id: 'nav-ranking', label: 'ランキング', to: '/ranking', icon: Trophy, group: 'ページ' },
  { id: 'nav-propose', label: 'マーケットを提案', to: '/propose', icon: PlusCircle, group: 'ページ' },
  { id: 'nav-admin', label: '管理ダッシュボード', to: '/admin', icon: LayoutDashboard, group: 'ページ' },
]

export default function CommandPalette() {
  const t = useT()
  const navigate = useNavigate()
  const { markets } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo(() => {
    const marketItems: Item[] = markets
      .filter((m) => m.status !== 'pending')
      .map((m) => ({
        id: m.id,
        label: m.question,
        sub: `${m.category} ・ YES ${Math.round(marketPrice(m).yes * 100)}%`,
        to: `/market/${m.id}`,
        icon: Search,
        group: 'マーケット' as const,
      }))
    const all = [...NAV_ITEMS, ...marketItems]
    if (!q.trim()) return all.slice(0, 8)
    const lq = q.toLowerCase()
    return all
      .filter((it) => it.label.toLowerCase().includes(lq) || it.sub?.toLowerCase().includes(lq))
      .slice(0, 12)
  }, [q, markets])

  useEffect(() => {
    setActive(0)
  }, [q])

  if (!open) return null

  function go(it?: Item) {
    const target = it ?? results[active]
    if (!target) return
    navigate(target.to)
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                go()
              }
            }}
            placeholder={t('マーケットやページを検索...')}
            className="flex-1 bg-transparent py-3.5 text-sm text-text placeholder-text-muted outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">{t('該当する項目がありません')}</div>
          ) : (
            results.map((it, i) => {
              const Icon = it.icon
              return (
                <button
                  key={it.id}
                  onClick={() => go(it)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === active ? 'bg-surface-hover' : ''
                  }`}
                >
                  <Icon size={15} className="shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text">{it.group === 'ページ' ? t(it.label) : it.label}</div>
                    {it.sub && <div className="truncate text-xs text-text-muted">{it.sub}</div>}
                  </div>
                  <span className="shrink-0 text-[10px] text-text-muted">{t(it.group)}</span>
                  {i === active && <CornerDownLeft size={13} className="shrink-0 text-text-muted" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-text-muted">
          <span>↑↓ {t('移動')}</span>
          <span>⏎ {t('開く')}</span>
          <span>esc {t('閉じる')}</span>
        </div>
      </div>
    </div>
  )
}
