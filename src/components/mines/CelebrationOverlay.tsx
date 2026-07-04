import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Celebration } from '../../hooks/useMinesGame'

type Props = {
  celebration: Celebration | null
  onDismiss: () => void
}

/** 獲得額のデジタルカウントアップ（reduced-motion 時は即値表示） */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [n, setN] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) {
      setN(value)
      return
    }
    const t0 = performance.now()
    const dur = 700
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced])
  return <>{n.toLocaleString()}</>
}

/**
 * お祝い演出。
 * - cashout: 獲得額をネオングロー+デジタルカウントアップで表示
 * - milestone 10x: シアン/マゼンタのフラッシュ
 * - milestone 20x: 画面全体のグリッドフラッシュ
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
          {/* 背景の発光。20x 以上は画面全体のグリッドが輝く */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: mega ? 0.6 : 0.32 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${mega ? 'neon-grid-bg' : ''} ${
              mega
                ? 'bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.5),rgba(255,46,196,0.25),transparent_75%)]'
                : 'bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.35),transparent_60%)]'
            }`}
          />
          <motion.div
            initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0, y: 20 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 1.15 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="stage-dark relative text-center px-8 py-6 rounded-2xl border border-cyan-300/40
                       bg-black/70 backdrop-blur-md shadow-[0_0_60px_rgba(0,240,255,0.35)]"
          >
            {celebration.kind === 'cashout' ? (
              <>
                <p className="text-sm text-cyan-200/80 mb-1 font-mono tracking-widest">CASH OUT</p>
                <p className="text-4xl sm:text-5xl font-extrabold font-mono text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,0.6)] tabular-nums">
                  +<CountUp value={celebration.payout} /> <span className="text-lg">MR</span>
                </p>
                <p className="text-sm text-text-muted mt-1 font-mono tabular-nums">{celebration.multiplier.toFixed(2)}x</p>
              </>
            ) : (
              <>
                <p className="text-sm text-fuchsia-300/80 mb-1 font-mono tracking-widest">{mega ? 'LEGENDARY' : 'AMAZING'}</p>
                <p className="text-5xl font-extrabold font-mono text-fuchsia-400 drop-shadow-[0_0_18px_rgba(255,46,196,0.6)] tabular-nums">
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
