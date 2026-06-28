import { Link, useLocation } from 'react-router-dom'
import { Home, Wallet, Trophy, PlusCircle, Search } from 'lucide-react'

const TABS = [
  { to: '/', label: 'マーケット', Icon: Home },
  { to: '/portfolio', label: '資産', Icon: Wallet },
  { to: '/ranking', label: 'ランク', Icon: Trophy },
  { to: '/propose', label: '提案', Icon: PlusCircle },
]

// スマホ専用の下部固定タブバー（md以上では非表示）
export default function MobileTabBar() {
  const { pathname } = useLocation()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14">
        {TABS.map(({ to, label, Icon }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          aria-label="検索"
          className="flex flex-col items-center justify-center gap-0.5 text-text-muted active:text-accent transition-colors"
        >
          <Search size={20} />
          <span className="text-[10px] font-medium">検索</span>
        </button>
      </div>
    </nav>
  )
}
