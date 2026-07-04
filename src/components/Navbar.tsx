import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart2, Trophy, PlusCircle, Settings, LogOut, ChevronDown, Search, ShieldCheck, HelpCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../store/useAuth'
import { useTheme } from '../store/useTheme'
import { levelInfo, winStreak } from '../lib/gamification'
import LoginModal from './LoginModal'
import HelpModal from './HelpModal'
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
  { to: '/admin/plinko', label: 'Plinko設定' },
  { to: '/admin/mines', label: 'Mines設定' },
  { to: '/admin/users', label: 'ユーザー管理' },
]

export default function Navbar() {
  const location = useLocation()
  const { currentUser, positions, markets } = useStore()
  const signOut = useAuth((s) => s.signOut)
  const salonLinked = useAuth((s) => Boolean(s.profile?.salon_login_id))
  const theme = useTheme((s) => s.theme)
  const user = currentUser()
  const logoMark = theme === 'light' ? '/logo-mark-light.png' : '/logo-mark.png'
  const lvl = user ? levelInfo(user.xp) : null
  const streak = user ? winStreak(positions, markets, user.id) : 0
  const [showLogin, setShowLogin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const open = () => setShowHelp(true)
    window.addEventListener('open-help', open)
    return () => window.removeEventListener('open-help', open)
  }, [])

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
            {salonLinked && (
              <Link
                to="/wallet"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/wallet'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                EPウォレット
              </Link>
            )}
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
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 transition-colors"
              >
                <ShieldCheck size={15} />
                <span className="text-xs font-semibold hidden sm:inline">管理ダッシュボード</span>
              </Link>
            )}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              aria-label="コマンドパレットを開く"
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors"
            >
              <Search size={14} />
              <span className="text-xs">検索</span>
              <kbd className="text-[10px] border border-border rounded px-1 py-0.5 bg-surface">⌘K</kbd>
            </button>
            <button
              onClick={() => setShowHelp(true)}
              aria-label="使い方"
              title="使い方"
              className="w-9 h-9 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-text hover:border-accent/50 flex items-center justify-center transition-colors"
            >
              <HelpCircle size={16} />
            </button>
            <ThemeToggle />
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border hover:border-accent/50 transition-colors"
                >
                  <div className="relative w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0)}
                    {lvl && (
                      <span className="absolute -bottom-1.5 -right-1.5 text-[8px] font-bold leading-none px-1 py-0.5 rounded-full bg-accent text-white border border-bg">
                        {lvl.level}
                      </span>
                    )}
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text">{user.name}</span>
                          {lvl && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                              Lv.{lvl.level}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted mb-2">{user.points.toLocaleString()} pt</div>
                        {lvl && (
                          <>
                            <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                              <span className={lvl.rank.color}>{lvl.rank.name}</span>
                              {streak > 0 && <span className="text-no font-bold">🔥 {streak}連勝</span>}
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
                            </div>
                          </>
                        )}
                      </div>
                      {user.role === 'admin' && (
                        <div className="md:hidden border-b border-border py-1">
                          <p className="px-4 py-1.5 text-[10px] font-semibold text-text-muted">管理メニュー</p>
                          {ADMIN_LINKS.map((l) => (
                            <Link
                              key={l.to}
                              to={l.to}
                              onClick={() => setShowUserMenu(false)}
                              className="block px-4 py-2 text-sm text-text-muted hover:text-text hover:bg-white/5 transition-colors"
                            >
                              {l.label}
                            </Link>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => { signOut(); setShowUserMenu(false) }}
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
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  )
}
