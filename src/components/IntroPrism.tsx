import { useEffect, useMemo, useState } from 'react'
import type React from 'react'

// プリズムの分光をイメージした星の色
const STAR_COLORS = ['#7dd3fc', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#38bdf8']
const SEEN_KEY = 'pp-intro-seen'
const STAR_PATH = 'M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z'

// spin: プリズムが加速回転 → star: 中央で星に変身 → burst: 星が散る
type Phase = 'spin' | 'star' | 'burst' | 'done'
const PHASE_MS: Record<Exclude<Phase, 'done'>, number> = { spin: 2300, star: 850, burst: 1500 }
const NEXT: Record<Exclude<Phase, 'done'>, Phase> = { spin: 'star', star: 'burst', burst: 'done' }

type Star = { id: number; size: number; style: React.CSSProperties }

// 初回アクセス時のイントロ：中央で「MR」プリズムがくるくる回り、星になって散る
export default function IntroPrism() {
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === 'undefined') return 'done'
    if (sessionStorage.getItem(SEEN_KEY)) return 'done'
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'done'
    return 'spin'
  })

  useEffect(() => {
    if (phase === 'done') return
    sessionStorage.setItem(SEEN_KEY, '1')
    const t = setTimeout(() => setPhase(NEXT[phase]), PHASE_MS[phase])
    return () => clearTimeout(t)
  }, [phase])

  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
        const dist = 90 + Math.random() * 230
        return {
          id: i,
          size: 10 + Math.random() * 16,
          style: {
            color: STAR_COLORS[i % STAR_COLORS.length],
            ['--dx' as string]: `${Math.cos(angle) * dist}px`,
            ['--dy' as string]: `${Math.sin(angle) * dist}px`,
            ['--rot' as string]: `${Math.random() * 540 - 270}deg`,
            ['--dur' as string]: `${0.9 + Math.random() * 0.5}s`,
            animationDelay: `${Math.random() * 0.08}s`,
          } as React.CSSProperties,
        }
      }),
    []
  )

  if (phase === 'done') return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-bg ${
        phase === 'burst' ? 'intro-overlay-out' : ''
      }`}
      onClick={() => setPhase('done')}
      aria-hidden
    >
      {phase === 'spin' && (
        <div className="intro-stage">
          <div className="intro-glow" />
          <div className="intro-prism">
            {[0, 1, 2].map((i) => (
              <div key={i} className="intro-face" style={{ transform: `rotateY(${i * 120}deg) translateZ(34.6px)` }}>
                <span className="intro-face-label">MR</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase !== 'spin' && (
        <span className={phase === 'star' ? 'intro-big-star' : 'intro-big-star intro-big-star-out'}>
          <svg viewBox="0 0 24 24" width={110} height={110}>
            <defs>
              <linearGradient id="intro-star-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="50%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill="url(#intro-star-grad)" />
          </svg>
        </span>
      )}

      {phase === 'burst' && (
        <>
          <div className="intro-flash" />
          {stars.map((s) => (
            <span key={s.id} className="intro-star" style={s.style}>
              <svg viewBox="0 0 24 24" width={s.size} height={s.size} fill="currentColor">
                <path d={STAR_PATH} />
              </svg>
            </span>
          ))}
        </>
      )}
    </div>
  )
}
