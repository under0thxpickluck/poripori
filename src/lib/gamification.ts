import type { Position, Market } from '../types'

export const RANKS = [
  { min: 1, name: 'ブロンズ', color: 'text-amber-600' },
  { min: 5, name: 'シルバー', color: 'text-slate-300' },
  { min: 10, name: 'ゴールド', color: 'text-yellow-400' },
  { min: 20, name: 'プラチナ', color: 'text-cyan-300' },
  { min: 35, name: 'ダイヤモンド', color: 'text-sky-400' },
]

const PER_LEVEL = 1000

// XP（=ポイント）からレベル/ランク/進捗を算出
export function levelInfo(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp))
  const level = Math.floor(safeXp / PER_LEVEL) + 1
  const inLevel = safeXp % PER_LEVEL
  const progress = inLevel / PER_LEVEL
  const rank = [...RANKS].reverse().find((r) => level >= r.min) ?? RANKS[0]
  return { level, inLevel, need: PER_LEVEL, progress, rank }
}

// 解決済みマーケットで「直近からの連勝数」を算出
export function winStreak(positions: Position[], markets: Market[], userId: string): number {
  const resolved = positions
    .filter((p) => p.userId === userId)
    .map((p) => ({ p, m: markets.find((mm) => mm.id === p.marketId) }))
    .filter((x): x is { p: Position; m: Market } => !!x.m && x.m.status === 'resolved')
    .sort((a, b) => new Date(b.m.deadline).getTime() - new Date(a.m.deadline).getTime())

  let streak = 0
  for (const { p, m } of resolved) {
    const winnerShares = m.resolved === 'YES' ? p.yesShares : p.noShares
    const loserShares = m.resolved === 'YES' ? p.noShares : p.yesShares
    const won = winnerShares > 0 && winnerShares >= loserShares
    if (won) streak++
    else break
  }
  return streak
}
