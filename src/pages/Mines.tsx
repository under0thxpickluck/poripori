import { useState } from 'react'
import { Cpu, LogIn, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMinesGame } from '../hooks/useMinesGame'
import { isMuted, setMuted } from '../lib/sounds'
import { Board } from '../components/mines/Board'
import { HUD } from '../components/mines/HUD'
import { HistoryCards } from '../components/mines/HistoryCards'
import { CelebrationOverlay } from '../components/mines/CelebrationOverlay'
import LoginModal from '../components/LoginModal'

// Mines（宝石堀り）。抽選・残高はすべてサーバー権威（migrate-015）。
// このページは useMinesGame の状態を並べるだけで、ロジックを持たない。
export default function Mines() {
  const {
    session, profile,
    houseEdge, game, finished, stats, derived,
    busy, pendingCell, error, celebration,
    start, reveal, cashout, clearBoard, dismissCelebration,
  } = useMinesGame()
  const [muted, setMutedState] = useState(isMuted())
  const [showLogin, setShowLogin] = useState(false)

  const balance = profile ? Math.floor(profile.points) : null

  const toggleMute = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-400/15 text-cyan-300 flex items-center justify-center border border-cyan-400/25">
          <Cpu size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Mines</h1>
          <p className="text-text-muted text-sm">
            グリッドに潜むトラップを避けて、データを採掘せよ
            <span className="ml-2">還元率 {(houseEdge * 100).toFixed(0)}%</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'サウンドをオンにする' : 'サウンドをオフにする'}
            className="text-text-muted hover:text-text transition-colors"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="text-right">
            <p className="text-xs text-text-muted">残高</p>
            <p className="text-lg font-bold text-text tabular-nums">
              {balance != null ? `${balance.toLocaleString()} MR` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ゲーム面はライトテーマでも常にダーク（stage-dark でテーマ変数を固定） */}
      <div className="stage-dark space-y-4 rounded-3xl border border-cyan-400/15 bg-[#0a0a12] p-3 sm:p-4 shadow-xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Board game={game} pendingCell={pendingCell} onReveal={reveal} />
        </motion.div>

        {session ? (
          <HUD
            game={game}
            derived={derived}
            houseEdge={houseEdge}
            balance={balance}
            busy={busy}
            onStart={start}
            onCashout={cashout}
            onNewGame={clearBoard}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors"
          >
            <LogIn size={15} /> ログインして遊ぶ
          </button>
        )}

        {error && <p className="text-sm text-no">{error}</p>}

        <HistoryCards finished={finished} stats={stats} />

        <p className="text-[11px] text-text-muted">
          MR はサイト内ポイントです。ベットは1回 1〜10,000 MR。トラップの数が多いほど1マスあたりの倍率が上がります。
        </p>
      </div>

      <CelebrationOverlay celebration={celebration} onDismiss={dismissCelebration} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
