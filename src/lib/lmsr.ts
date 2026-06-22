import type { Market } from '../types'

export function costFn(qYes: number, qNo: number, b: number): number {
  const a = Math.max(qYes / b, qNo / b)
  return b * (a + Math.log(Math.exp(qYes / b - a) + Math.exp(qNo / b - a)))
}

export function currentPrice(qYes: number, qNo: number, b: number): { yes: number; no: number } {
  const a = Math.max(qYes / b, qNo / b)
  const eYes = Math.exp(qYes / b - a)
  const eNo = Math.exp(qNo / b - a)
  const sum = eYes + eNo
  return { yes: eYes / sum, no: eNo / sum }
}

export function marketPrice(market: Market) {
  return currentPrice(market.q_yes, market.q_no, market.b)
}

export function buyCost(market: Market, side: 'YES' | 'NO', shares: number): number {
  const { q_yes, q_no, b } = market
  const newQYes = side === 'YES' ? q_yes + shares : q_yes
  const newQNo = side === 'NO' ? q_no + shares : q_no
  return costFn(newQYes, newQNo, b) - costFn(q_yes, q_no, b)
}

export function sellRefund(market: Market, side: 'YES' | 'NO', shares: number): number {
  const { q_yes, q_no, b } = market
  const newQYes = side === 'YES' ? q_yes - shares : q_yes
  const newQNo = side === 'NO' ? q_no - shares : q_no
  return costFn(q_yes, q_no, b) - costFn(newQYes, newQNo, b)
}

export function sharesForPoints(market: Market, side: 'YES' | 'NO', points: number): number {
  if (points <= 0) return 0
  let lo = 0
  let hi = points * 100
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (buyCost(market, side, mid) <= points) lo = mid
    else hi = mid
    if (hi - lo < 0.001) break
  }
  return Math.floor(lo * 100) / 100
}

export function resolvePayouts(
  positions: Array<{ userId: string; yesShares: number; noShares: number }>,
  result: 'YES' | 'NO'
): Record<string, number> {
  return Object.fromEntries(
    positions.map((p) => [
      p.userId,
      result === 'YES' ? p.yesShares : p.noShares,
    ])
  )
}
