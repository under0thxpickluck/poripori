import { Tile, gemKind, type TileState } from './Tile'
import type { ActiveGame } from '../../hooks/useMinesGame'
import { GRID } from '../../lib/mines-math'

type Props = {
  game: ActiveGame | null
  pendingCell: number | null
  onReveal: (cell: number) => void
}

function tileState(game: ActiveGame | null, cell: number): TileState {
  if (!game) return 'locked'
  const mine = game.mines?.includes(cell) ?? false
  const revealed = game.revealed.includes(cell)
  if (game.status === 'active') return revealed ? 'gem' : 'hidden'
  // 終局後: 罠を公開。踏んだ罠 = busted かつ revealed に無い罠マス…ではなく
  // 「busted の原因マス」はサーバーが revealed に含めないため、mines のうち
  // どれを踏んだかは lastCell で判別できないので、busted 時は全罠を trap 表示にし、
  // 開いていた宝石はそのまま残す。
  if (mine) return game.status === 'busted' ? 'trap-hit' : 'trap'
  return revealed ? 'gem' : 'locked'
}

export function Board({ game, pendingCell, onReveal }: Props) {
  return (
    <div
      className="grid grid-cols-5 gap-2 sm:gap-2.5 p-3 sm:p-4 rounded-2xl border border-cyan-400/25
                 neon-grid-bg neon-scanline
                 shadow-[inset_0_0_40px_rgba(0,240,255,0.06),0_0_24px_rgba(0,240,255,0.08)]"
      role="grid"
      aria-label="データ採掘の盤面"
    >
      {Array.from({ length: GRID }, (_, i) => (
        <Tile
          key={game ? `${game.id}:${i}` : `empty:${i}`}
          index={i}
          state={tileState(game, i)}
          gem={game ? gemKind(game.id, i) : 0}
          appearDelay={game && game.revealed.length === 0 ? (i % 5) * 0.03 + Math.floor(i / 5) * 0.05 : 0}
          pending={pendingCell === i}
          onClick={() => onReveal(i)}
        />
      ))}
    </div>
  )
}
