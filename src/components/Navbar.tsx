import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart2, Trophy, PlusCircle, Settings, LogOut, ChevronDown, Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useTheme } from '../store/useTheme'
import LoginModal from './LoginModal'
import ThemeToggle from './ThemeToggle'

const NAV_LINKS = [
  { to: '/', label: 'マーケット' },
  { to: '/portfolio', label: 'ポートフォリオ' },
  { to: '/ranking', label: 'ランキング' },
  { to: '/propose', label: '提案する' },
]

const ADMIN_LINKS = [
  { to: '/admin', label: 'ダッシュボード' },
  { to: '/admin/proposals', label: '承認待ち' },
  { to: '/admin/markets', label: 'マーケット管理' },
  { to: '/admin/markets/new', label: '新規作成' },
  { to: '/admin/ads', label: '広告管理' },
  { to: '/admin/users', label: 'ユーザー管理' },
]

export default function Navbar() {
  const location = useLocation()
  const { currentUser, logout } = useStore()
  const theme = useTheme((s) => s.theme)
  const user = currentUser()
  const logoMark = theme === 'light' ? '/logo-mark-light.png' : '/logo-mark.png'
  const [showLogin, setShowLogin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logoMark} alt="MIRAIX" className="h-8 w-auto" />
            <span className="font-bold text-text tracking-tight text-lg">MIRAIX</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
                {ADMIN_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === l.to
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-muted hover:text-text hover:bg-white/5'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              aria-label="コマンドパレットを開く"
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors"
            >
              <Search size={14} />
              <span className="text-xs">検索</span>
              <kbd className="text-[10px] border border-border rounded px-1 py-0.5 bg-surface">⌘K</kbd>
            </button>
            <ThemeToggle />
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border hover:border-accent/50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-sm text-text font-medium">{user.name}</span>
                    <span className="text-xs text-text-muted ml-2">{user.points.toLocaleString()} pt</span>
                  </div>
                  <ChevronDown size={14} className="text-text-muted" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-surface border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <div className="text-sm font-medium text-text">{user.name}</div>
                        <div className="text-xs text-text-muted">{user.points.toLocaleString()} pt</div>
                      </div>
                      <button
                        onClick={() => { logout(); setShowUserMenu(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-no hover:bg-no/10 transition-colors"
                      >
                        <LogOut size={14} />
                        ログアウト
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-sm font-medium text-white transition-colors"
              >
                ログイン
              </button>
            )}
          </div>
        </div>
      </nav>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
