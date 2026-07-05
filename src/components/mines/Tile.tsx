import { memo } from 'react'
import { motion } from 'framer-motion'
import { Gem, Diamond, Hexagon, Sparkles, Bug } from 'lucide-react'
import { useT } from '../../lib/i18n'

export type TileState =
  | 'hidden'      // 未開示（クリック可）
  | 'gem'         // 安全（自分が開けた）
  | 'trap'        // 終局後に公開されたトラップ（踏んでいない）
  | 'trap-hit'    // 踏んだトラップ
  | 'locked'      // ゲーム開始前・終局後の未開示マス（押せない）

// ホロクリスタルの見た目バリエーション（演出のみ。配当には一切影響しない）
const GEMS = [
  { Icon: Gem, cls: 'text-cyan-300', glow: 'shadow-cyan-400/50' },
  { Icon: Diamond, cls: 'text-fuchsia-400', glow: 'shadow-fuchsia-400/50' },
  { Icon: Hexagon, cls: 'text-lime-300', glow: 'shadow-lime-300/50' },
  { Icon: Sparkles, cls: 'text-yellow-300', glow: 'shadow-yellow-300/50' },
] as const

/** ゲームIDとマス番号から決まる疑似ランダムなクリスタル種（リロードしても同じ見た目） */
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
  const t = useT()
  const g = GEMS[gem]
  const clickable = state === 'hidden' && !pending

  return (
    <motion.button
      type="button"
      aria-label={t('マス {n}', { n: index + 1 })}
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
          ? 'bg-[#10101c] border-cyan-400/20 hover:border-cyan-300/70 hover:bg-cyan-400/10 hover:shadow-[0_0_12px_rgba(0,240,255,0.25)] cursor-pointer'
          : '',
        state === 'locked' ? 'bg-[#0c0c16] border-white/5 opacity-50' : '',
        state === 'gem' ? `bg-cyan-400/10 border-cyan-300/40 shadow-lg ${g.glow}` : '',
        state === 'trap' ? 'bg-red-500/10 border-red-400/25 opacity-70' : '',
        state === 'trap-hit' ? 'bg-red-500/25 border-red-400/70 shadow-lg shadow-red-500/40 neon-glitch' : '',
        pending ? 'animate-pulse border-cyan-300/60' : '',
      ].join(' ')}
    >
      {state === 'gem' && (
        <>
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 15 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <g.Icon className={`w-1/2 h-1/2 ${g.cls} drop-shadow-[0_0_6px_currentColor]`} />
          </motion.span>
          <motion.span
            aria-hidden
            initial={{ opacity: 0.8, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl border-2 border-cyan-300/70 pointer-events-none"
          />
        </>
      )}
      {(state === 'trap' || state === 'trap-hit') && (
        <motion.span
          initial={{ scale: 0 }}
          animate={state === 'trap-hit' ? { scale: [0, 1.4, 1], rotate: [0, -8, 0] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Bug className={`w-1/2 h-1/2 ${state === 'trap-hit' ? 'text-red-400' : 'text-red-400/60'}`} />
        </motion.span>
      )}
    </motion.button>
  )
}

export const Tile = memo(TileImpl)
