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
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-text-muted">
          <Percent size={12} className="text-emerald-400" />
          勝率 {stats.winRate == null ? '—' : `${Math.round(stats.winRate * 100)}%`}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-text-muted">
          <Trophy size={12} className="text-amber-300" />
          最高 {stats.best > 0 ? `${stats.best.toFixed(2)}x` : '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-text-muted">
          <Flame size={12} className="text-rose-400" />
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
              title={`ベット ${g.bet.toLocaleString()} MR ／ 罠 ${g.mines_count} 個 ／ ${win ? `獲得 ${g.payout.toLocaleString()} MR` : '没収'}`}
              className={`text-xs px-2.5 py-1 rounded-full border tabular-nums ${
                win
                  ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-400/30'
              }`}
            >
              {win ? `${g.multiplier.toFixed(2)}x` : '💥'}
            </motion.span>
          )
        })}
      </div>
    </div>
  )
}
