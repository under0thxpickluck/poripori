import { motion } from 'framer-motion'
import { Trophy, Flame, Percent } from 'lucide-react'
import type { FinishedGame } from '../../hooks/useMinesGame'

type Props = {
  finished: FinishedGame[]
  stats: { winRate: number | null; best: number; streak: number }
}

/** 直近の結果カード + 勝率/最高倍率/連勝 */
export function HistoryCards({ finished, stats }: Props) {
  const recent = finished.slice(0, 12)
  if (finished.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] text-text-muted">
          <Percent size={12} className="text-cyan-300" />
          勝率 {stats.winRate == null ? '—' : `${Math.round(stats.winRate * 100)}%`}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] text-text-muted">
          <Trophy size={12} className="text-fuchsia-400" />
          最高 {stats.best > 0 ? `${stats.best.toFixed(2)}x` : '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] text-text-muted">
          <Flame size={12} className="text-red-400" />
          連勝 {stats.streak}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {recent.map((g, i) => {
          const win = g.status === 'cashed'
          return (
            <motion.span
              key={g.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              title={`ベット ${g.bet.toLocaleString()} MR ／ トラップ ${g.mines_count} ／ ${win ? `獲得 ${g.payout.toLocaleString()} MR` : '没収'}`}
              className={`text-xs px-2.5 py-1 rounded-full border font-mono tabular-nums ${
                win
                  ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/40'
                  : 'bg-red-500/10 text-red-400 border-red-400/40'
              }`}
            >
              {win ? `${g.multiplier.toFixed(2)}x` : '⚠'}
            </motion.span>
          )
        })}
      </div>
    </div>
  )
}
