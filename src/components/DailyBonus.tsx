import { useEffect, useState } from 'react'
import { Gift, Flame } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useModalBehavior } from '../hooks/useModalBehavior'
import Confetti from './Confetti'

// ログイン中ユーザーが本日未受取ならデイリーボーナスを付与し、お祝い表示
export default function DailyBonus() {
  const currentUserId = useStore((s) => s.currentUserId)
  const claimDailyBonus = useStore((s) => s.claimDailyBonus)
  const [reward, setReward] = useState<{ amount: number; streak: number } | null>(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    claimDailyBonus().then((r) => {
      if (!cancelled && r.claimed && r.amount != null && r.streak != null) {
        setReward({ amount: r.amount, streak: r.streak })
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentUserId, claimDailyBonus])

  if (!reward) return null
  return <BonusModal reward={reward} onClose={() => setReward(null)} />
}

function BonusModal({
  reward,
  onClose,
}: {
  reward: { amount: number; streak: number }
  onClose: () => void
}) {
  useModalBehavior(onClose)
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <Confetti trigger={1} />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet-in relative z-10 w-full max-w-xs bg-surface border border-border rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/15 text-accent flex items-center justify-center mb-3">
          <Gift size={32} />
        </div>
        <h2 className="text-lg font-bold text-text">デイリーボーナス！</h2>
        <p className="text-3xl font-extrabold text-accent my-2">+{reward.amount.toLocaleString()} pt</p>
        <div className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-no/15 text-no">
          <Flame size={12} className="animate-flame" />
          {reward.streak}日連続ログイン
        </div>
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          毎日ログインで連続日数が伸び、ボーナスが増えます（最大 400pt）。
        </p>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
        >
          受け取る
        </button>
      </div>
    </div>
  )
}
