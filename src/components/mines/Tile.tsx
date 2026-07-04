import { memo } from 'react'
import { motion } from 'framer-motion'
import { Gem, Diamond, Sparkles, Skull } from 'lucide-react'

export type TileState =
  | 'hidden'      // 未開示（クリック可）
  | 'gem'         // 安全（自分が開けた）
  | 'trap'        // 終局後に公開された罠（踏んでいない）
  | 'trap-hit'    // 踏んだ罠
  | 'locked'      // ゲーム開始前・終局後の未開示マス（押せない）

// 宝石の見た目バリエーション（演出のみ。配当には一切影響しない）
const GEMS = [
  { Icon: Gem, cls: 'text-emerald-400', glow: 'shadow-emerald-400/40' },
  { Icon: Diamond, cls: 'text-sky-300', glow: 'shadow-sky-300/40' },
  { Icon: Gem, cls: 'text-amber-300', glow: 'shadow-amber-300/40' },
  { Icon: Sparkles, cls: 'text-fuchsia-300', glow: 'shadow-fuchsia-300/40' },
] as const

/** ゲームIDとマス番号から決まる疑似ランダムな宝石種（リロードしても同じ見た目） */
export function gemKind(gameId: string, index: number): number {
  let h = index + 1
  for (let i = 0; i < gameId.length; i++) h = (h * 31 + gameId.charCodeAt(i)) >>> 0
  return h % GEMS.length
}

type Props = {
  index: number
  state: TileState
  gem: number
  /** 盤面出現アニメーションのディレイ（一枚ずつ並ぶ演出） */
  appearDelay: number
  pending: boolean
  onClick: () => void
}

function TileImpl({ index, state, gem, appearDelay, pending, onClick }: Props) {
  const g = GEMS[gem]
  const clickable = state === 'hidden' && !pending

  return (
    <motion.button
      type="button"
      aria-label={`マス ${index + 1}`}
      disabled={!clickable}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.6, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: appearDelay, type: 'spring', stiffness: 420, damping: 26 }}
      whileHover={clickable ? { scale: 1.06, y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.92 } : undefined}
      className={[
        'relative aspect-square rounded-xl select-none',
        'border backdrop-blur-sm transition-colors duration-200',
        state === 'hidden'
          ? 'bg-white/[0.04] border-white/10 hover:border-amber-300/40 hover:bg-white/[0.07] cursor-pointer'
          : '',
        state === 'locked' ? 'bg-white/[0.02] border-white/5 opacity-50' : '',
        state === 'gem' ? `bg-emerald-400/10 border-emerald-300/30 shadow-lg ${g.glow}` : '',
        state === 'trap' ? 'bg-rose-500/10 border-rose-400/20 opacity-70' : '',
        state === 'trap-hit' ? 'bg-rose-500/25 border-rose-400/60 shadow-lg shadow-rose-500/30' : '',
        pending ? 'animate-pulse border-amber-300/50' : '',
      ].join(' ')}
    >
      {state === 'gem' && (
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 15 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <g.Icon className={`w-1/2 h-1/2 ${g.cls} drop-shadow-[0_0_6px_currentColor]`} />
        </motion.span>
      )}
      {(state === 'trap' || state === 'trap-hit') && (
        <motion.span
          initial={{ scale: 0 }}
          animate={state === 'trap-hit' ? { scale: [0, 1.4, 1], rotate: [0, -8, 0] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Skull className={`w-1/2 h-1/2 ${state === 'trap-hit' ? 'text-rose-400' : 'text-rose-400/60'}`} />
        </motion.span>
      )}
    </motion.button>
  )
}

export const Tile = memo(TileImpl)
