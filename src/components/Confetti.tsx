import { useEffect, useState } from 'react'
import type React from 'react'

const COLORS = ['rgb(var(--c-yes))', 'rgb(var(--c-no))', 'rgb(var(--c-accent))', '#eab308', '#f472b6']

type Piece = { id: number; style: React.CSSProperties }

// trigger が変わるたびに中央から紙吹雪をはじけさせる（全画面オーバーレイ）
export default function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (trigger === 0) return
    const batch: Piece[] = Array.from({ length: 44 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 220
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist + 120 // 重力で少し下方向へ
      const rot = Math.random() * 900 - 450
      const dur = 0.9 + Math.random() * 0.8
      return {
        id: trigger * 1000 + i,
        style: {
          left: '50%',
          top: '46%',
          background: COLORS[i % COLORS.length],
          ['--dx' as string]: `${dx}px`,
          ['--dy' as string]: `${dy}px`,
          ['--rot' as string]: `${rot}deg`,
          ['--dur' as string]: `${dur}s`,
          animationDelay: `${Math.random() * 0.06}s`,
        } as React.CSSProperties,
      }
    })
    setPieces(batch)
    const t = setTimeout(() => setPieces([]), 1800)
    return () => clearTimeout(t)
  }, [trigger])

  if (pieces.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece absolute w-1.5 h-2.5 rounded-[1px]" style={p.style} />
      ))}
    </div>
  )
}
