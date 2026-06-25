import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { levelFromXp, levelInfo } from '../lib/gamification'
import Confetti from './Confetti'

// XP増加でレベルが上がった瞬間を検知して祝う
export default function LevelUpToast() {
  const user = useStore((s) => {
    const id = s.currentUserId
    return id ? s.users.find((u) => u.id === id) ?? null : null
  })
  const xp = user?.xp ?? 0
  const prevLevel = useRef<number | null>(null)
  const [shown, setShown] = useState<{ level: number; rank: string } | null>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    const lvl = levelFromXp(xp)
    if (prevLevel.current != null && lvl > prevLevel.current) {
      setShown({ level: lvl, rank: levelInfo(xp).rank.name })
      setBurst((b) => b + 1)
      const t = setTimeout(() => setShown(null), 3600)
      prevLevel.current = lvl
      return () => clearTimeout(t)
    }
    prevLevel.current = lvl
  }, [xp])

  if (!shown) return null
  return (
    <>
      <Confetti trigger={burst} />
      <div className="fixed left-1/2 -translate-x-1/2 top-20 z-[70] px-4 w-full max-w-xs">
        <div className="animate-sheet-in flex items-center gap-3 rounded-xl border border-accent/40 bg-surface/95 backdrop-blur px-4 py-3 shadow-xl">
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-text">レベルアップ！ Lv.{shown.level}</p>
            <p className="text-xs text-text-muted">ランク: {shown.rank}</p>
          </div>
        </div>
      </div>
    </>
  )
}
