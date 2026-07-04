import { useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Celebration } from '../../hooks/useMinesGame'

type Props = {
  celebration: Celebration | null
  onDismiss: () => void
}

/**
 * お祝い演出。
 * - cashout: 獲得額を光とともに表示
 * - milestone 10x: 金色のフラッシュ
 * - milestone 20x: 画面全体が輝く
 * prefers-reduced-motion 時はフェードのみに減衰する。
 */
export function CelebrationOverlay({ celebration, onDismiss }: Props) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(onDismiss, celebration.kind === 'cashout' ? 2200 : 1500)
    return () => clearTimeout(t)
  }, [celebration, onDismiss])

  const mega = celebration?.multiplier != null && celebration.multiplier >= 20

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-auto"
          aria-live="polite"
        >
          {/* 背景の発光。20x 以上は画面全体が輝く */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: mega ? 0.55 : 0.3 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${
              mega
                ? 'bg-[radial-gradient(circle_at_center,rgba(252,211,77,0.5),rgba(16,185,129,0.25),transparent_75%)]'
                : 'bg-[radial-gradient(circle_at_center,rgba(252,211,77,0.35),transparent_60%)]'
            }`}
          />
          <motion.div
            initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0, y: 20 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 1.15 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="stage-dark relative text-center px-8 py-6 rounded-2xl border border-amber-300/30
                       bg-black/60 backdrop-blur-md shadow-[0_0_60px_rgba(252,211,77,0.35)]"
          >
            {celebration.kind === 'cashout' ? (
              <>
                <p className="text-sm text-amber-200/80 mb-1">Cash Out!</p>
                <p className="text-4xl sm:text-5xl font-extrabold text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)] tabular-nums">
                  +{celebration.payout.toLocaleString()} <span className="text-lg">MR</span>
                </p>
                <p className="text-sm text-text-muted mt-1 tabular-nums">{celebration.multiplier.toFixed(2)}x</p>
              </>
            ) : (
              <>
                <p className="text-sm text-emerald-300/80 mb-1">{mega ? 'LEGENDARY!' : 'AMAZING!'}</p>
                <p className="text-5xl font-extrabold text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.6)] tabular-nums">
                  {celebration.multiplier.toFixed(2)}x
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
