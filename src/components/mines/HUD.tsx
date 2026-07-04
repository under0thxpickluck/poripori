import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Pickaxe, HandCoins } from 'lucide-react'
import type { ActiveGame } from '../../hooks/useMinesGame'
import { MIN_BET, MAX_BET, MIN_MINES, MAX_MINES, multiplierAt } from '../../lib/mines-math'

type Derived = {
  k: number
  current: number
  next: number
  bust: number
  expected: number
  safeLeft: number
}

type Props = {
  game: ActiveGame | null
  derived: Derived | null
  houseEdge: number
  balance: number | null
  busy: boolean
  onStart: (bet: number, mines: number) => void
  onCashout: () => void
  onNewGame: () => void
}

function clampBet(v: number, balance: number | null): number {
  if (!Number.isFinite(v)) return MIN_BET
  const cap = balance != null ? Math.min(MAX_BET, Math.floor(balance)) : MAX_BET
  return Math.min(Math.max(MIN_BET, Math.round(v)), Math.max(MIN_BET, cap))
}

function fmtX(m: number): string {
  return `${m.toFixed(m >= 100 ? 0 : 2)}x`
}

/** テレメトリパネルの四隅コーナーブラケット（装飾のみ） */
function CornerBrackets() {
  return (
    <span aria-hidden>
      <span className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-cyan-300/80 rounded-tl" />
      <span className="absolute right-0 top-0 w-3 h-3 border-r-2 border-t-2 border-cyan-300/80 rounded-tr" />
      <span className="absolute left-0 bottom-0 w-3 h-3 border-l-2 border-b-2 border-cyan-300/80 rounded-bl" />
      <span className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-cyan-300/80 rounded-br" />
    </span>
  )
}

/** ベット・トラップ数・倍率表示・開始/CashOut。すべての操作が3クリック以内で完結する */
export function HUD({ game, derived, houseEdge, balance, busy, onStart, onCashout, onNewGame }: Props) {
  const [bet, setBet] = useState(10)
  const [mines, setMines] = useState(3)
  const reduced = useReducedMotion()
  const playing = game?.status === 'active'
  const ended = game != null && game.status !== 'active'

  return (
    <div className="relative rounded-2xl border border-cyan-400/25 bg-[#10101c]/90 backdrop-blur-md p-4 sm:p-5 space-y-4 shadow-[0_0_24px_rgba(0,240,255,0.07)]">
      <CornerBrackets />
      {/* 倍率パネル */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] text-text-muted mb-0.5">現在倍率</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={game ? game.multiplier : 'idle'}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
                playing && game!.multiplier >= 2 ? 'text-cyan-300 drop-shadow-[0_0_10px_rgba(0,240,255,0.55)]' : 'text-text'
              }`}
            >
              {fmtX(game ? game.multiplier : 1)}
            </motion.p>
          </AnimatePresence>
        </div>
        <div>
          <p className="text-[11px] text-text-muted mb-0.5">次のマス成功で</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-fuchsia-400">
            {playing && derived ? fmtX(derived.next) : fmtX(multiplierAt(mines, 1, houseEdge))}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted mb-0.5">獲得予定</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-text">
            {playing && derived ? derived.expected.toLocaleString() : '—'}
            <span className="text-xs font-normal text-text-muted ml-1">MR</span>
          </p>
        </div>
      </div>

      {playing ? (
        <>
          <p className="text-xs text-text-muted text-center">
            トラップ {game!.minesCount} ／ 残り安全マス {derived?.safeLeft} ／ 次にトラップを踏む確率{' '}
            {derived ? `${(derived.bust * 100).toFixed(0)}%` : '—'}
          </p>
          <motion.button
            type="button"
            onClick={onCashout}
            disabled={busy || (derived?.k ?? 0) < 1}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative overflow-hidden w-full py-3 rounded-xl font-bold text-sm text-black
                       bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400
                       shadow-lg shadow-cyan-400/30
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!reduced && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-1/3 bg-white/30 blur-md -skew-x-12 pointer-events-none"
                initial={{ x: '-150%' }}
                animate={{ x: ['-150%', '350%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <HandCoins size={16} />
              Cash Out{derived && derived.k > 0 ? `（${derived.expected.toLocaleString()} MR 獲得）` : ''}
            </span>
          </motion.button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] text-text-muted mb-1">ベット（MR）</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={MIN_BET}
                  max={MAX_BET}
                  step={1}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  onBlur={() => setBet(clampBet(bet, balance))}
                  className="w-24 px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-text font-mono tabular-nums outline-none focus:border-cyan-300/60"
                />
                <button type="button" onClick={() => setBet(clampBet(bet / 2, balance))} className="px-2.5 py-1 text-xs rounded-lg border border-white/10 text-text-muted hover:text-text hover:border-cyan-300/40">1/2</button>
                <button type="button" onClick={() => setBet(clampBet(bet * 2, balance))} className="px-2.5 py-1 text-xs rounded-lg border border-white/10 text-text-muted hover:text-text hover:border-cyan-300/40">x2</button>
                <button type="button" onClick={() => setBet(clampBet(balance ?? MIN_BET, balance))} className="px-2.5 py-1 text-xs rounded-lg border border-white/10 text-text-muted hover:text-text hover:border-cyan-300/40">MAX</button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">トラップ数（多いほど高倍率）</label>
              <select
                value={mines}
                onChange={(e) => setMines(parseInt(e.target.value, 10))}
                className="px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-text font-mono tabular-nums outline-none focus:border-cyan-300/60"
              >
                {Array.from({ length: MAX_MINES - MIN_MINES + 1 }, (_, i) => i + MIN_MINES).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => (ended ? onNewGame() : undefined, onStart(clampBet(bet, balance), mines))}
            disabled={busy || balance == null || balance < MIN_BET}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl font-bold text-sm text-black
                       bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400
                       shadow-lg shadow-cyan-400/25
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-2">
              <Pickaxe size={16} />
              {busy ? '準備中…' : '採掘開始'}
            </span>
          </motion.button>
        </>
      )}
    </div>
  )
}
