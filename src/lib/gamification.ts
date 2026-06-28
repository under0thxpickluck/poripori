import type { Position, Market, User, Trade } from '../types'

export const RANKS = [
  { min: 1, name: 'ブロンズ', color: 'text-amber-600' },
  { min: 5, name: 'シルバー', color: 'text-slate-300' },
  { min: 10, name: 'ゴールド', color: 'text-yellow-400' },
  { min: 20, name: 'プラチナ', color: 'text-cyan-300' },
  { min: 35, name: 'ダイヤモンド', color: 'text-sky-400' },
]

const PER_LEVEL = 1000

// XP（累積経験値）からレベル/ランク/進捗を算出
export function levelInfo(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp))
  const level = Math.floor(safeXp / PER_LEVEL) + 1
  const inLevel = safeXp % PER_LEVEL
  const progress = inLevel / PER_LEVEL
  const rank = [...RANKS].reverse().find((r) => level >= r.min) ?? RANKS[0]
  return { level, inLevel, need: PER_LEVEL, progress, rank }
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, Math.floor(xp)) / PER_LEVEL) + 1
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

// 解決済みポジションのみで的中率（勝敗）を算出
export function resolvedRecord(positions: Position[], markets: Market[], userId: string) {
  let wins = 0
  let losses = 0
  positions
    .filter((p) => p.userId === userId)
    .forEach((p) => {
      const m = markets.find((mm) => mm.id === p.marketId)
      if (!m || m.status !== 'resolved') return
      const winnerShares = m.resolved === 'YES' ? p.yesShares : p.noShares
      const loserShares = m.resolved === 'YES' ? p.noShares : p.yesShares
      if (winnerShares <= 0 && loserShares <= 0) return
      if (winnerShares >= loserShares) wins++
      else losses++
    })
  const decided = wins + losses
  return { wins, losses, decided, rate: decided > 0 ? wins / decided : 0 }
}

// 実績バッジ
export type Achievement = {
  id: string
  label: string
  desc: string
  emoji: string
  unlocked: boolean
}

export function achievements(
  user: User,
  positions: Position[],
  markets: Market[],
  trades: Trade[]
): Achievement[] {
  const myTrades = trades.filter((t) => t.userId === user.id)
  const rec = resolvedRecord(positions, markets, user.id)
  const streak = winStreak(positions, markets, user.id)
  const categories = new Set(
    positions
      .filter((p) => p.userId === user.id && (p.yesShares > 0 || p.noShares > 0))
      .map((p) => markets.find((m) => m.id === p.marketId)?.category)
      .filter(Boolean)
  )
  return [
    { id: 'first-trade', emoji: '🎯', label: '初トレード', desc: '初めてのトレードを実行', unlocked: myTrades.length >= 1 },
    { id: 'ten-trades', emoji: '⚡', label: 'アクティブ', desc: '10回トレード', unlocked: myTrades.length >= 10 },
    { id: 'first-win', emoji: '🏆', label: '初的中', desc: '解決市場で初勝利', unlocked: rec.wins >= 1 },
    { id: 'streak-3', emoji: '🔥', label: '3連勝', desc: '3連勝を達成', unlocked: streak >= 3 },
    { id: 'diversify', emoji: '🌐', label: '分散投資', desc: '4カテゴリ以上を保有', unlocked: categories.size >= 4 },
    { id: 'whale', emoji: '🐋', label: 'ホエール', desc: '総資産10,000pt突破', unlocked: user.points >= 10000 },
  ]
}
