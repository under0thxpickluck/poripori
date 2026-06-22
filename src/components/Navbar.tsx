import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { TrendingUp, BarChart2, Trophy, PlusCircle, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useStore } from '../store/useStore'
import LoginModal from './LoginModal'

const NAV_LINKS = [
  { to: '/', label: 'マーケット' },
  { to: '/portfolio', label: 'ポートフォリオ' },
  { to: '/ranking', label: 'ランキング' },
  { to: '/propose', label: '提案する' },
]

const ADMIN_LINKS = [
  { to: '/admin/proposals', label: '承認待ち' },
  { to: '/admin/markets', label: 'マーケット管理' },
  { to: '/admin/users', label: 'ユーザー管理' },
]

export default function Navbar() {
  const location = useLocation()
  const { currentUser, logout } = useStore()
  const user = currentUser()
  const [showLogin, setShowLogin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-[#2a2d4a] bg-[#0c0e1a]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <TrendingUp size={14} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">ポリぽり</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#2a2d4a]">
                {ADMIN_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === l.to
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e2244] border border-[#2a2d4a] hover:border-indigo-500/50 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-sm text-white font-medium">{user.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{user.points.toLocaleString()} pt</span>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[#13162d] border border-[#2a2d4a] rounded-xl shadow-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#2a2d4a]">
                        <div className="text-sm font-medium text-white">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.points.toLocaleString()} pt</div>
                      </div>
                      <button
                        onClick={() => { logout(); setShowUserMenu(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
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
