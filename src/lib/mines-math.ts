// Mines の倍率計算（純関数）。
// 本番の配当計算は Supabase の mines_reveal / mines_cashout（migrate-015）が行う。
// このモジュールは「次の倍率」等の表示と、SQL 側と同一式であることのテストに使う。
// 式: fair(m, k) = Π_{i=0..k-1} (25−i)/(25−m−i) = C(25,k)/C(25−m,k)
//     multiplier = round(house_edge × fair, 4)（k=0 は 1.0）

export const GRID = 25
export const MIN_BET = 1
export const MAX_BET = 10000
export const MIN_MINES = 1
export const MAX_MINES = 24

/** 地雷 m 個・安全開示 k 枚の公正倍率（ハウスエッジ抜き） */
export function fairMultiplier(mines: number, k: number): number {
  let f = 1
  for (let i = 0; i < k; i++) f *= (GRID - i) / (GRID - mines - i)
  return f
}

/** サーバーと同じ丸め（4桁）での表示倍率。k=0 はベット直後なので 1.0 */
export function multiplierAt(mines: number, k: number, houseEdge: number): number {
  if (k <= 0) return 1
  return Math.round(houseEdge * fairMultiplier(mines, k) * 1e4) / 1e4
}

/** 次の1マスが安全だった場合の倍率 */
export function nextMultiplier(mines: number, k: number, houseEdge: number): number {
  return multiplierAt(mines, k + 1, houseEdge)
}

/** 次の1マスで罠を踏む確率 */
export function bustChance(mines: number, revealedCount: number): number {
  return mines / (GRID - revealedCount)
}
