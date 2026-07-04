import { describe, it, expect } from 'vitest'
import {
  GRID, MIN_BET, MAX_BET,
  fairMultiplier, multiplierAt, nextMultiplier, bustChance,
} from './mines-math'

// C(n, k)
function choose(n: number, k: number): number {
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

describe('mines-math', () => {
  it('定数', () => {
    expect(GRID).toBe(25)
    expect(MIN_BET).toBe(1)
    expect(MAX_BET).toBe(10000)
  })

  it('fairMultiplier: 端のケース（m=1で24枚開け切り / m=24で1枚）はともに25倍', () => {
    expect(fairMultiplier(1, 24)).toBeCloseTo(25, 10)
    expect(fairMultiplier(24, 1)).toBeCloseTo(25, 10)
  })

  it('fairMultiplier: k=0 は 1', () => {
    for (const m of [1, 3, 12, 24]) expect(fairMultiplier(m, 0)).toBe(1)
  })

  it('公正性: fair(m,k) × P(k枚生存) = 1（RTP=house_edge の根拠）', () => {
    for (const [m, k] of [[1, 5], [3, 3], [5, 10], [10, 2], [24, 1]] as const) {
      const pSurvive = choose(GRID - m, k) / choose(GRID, k)
      expect(fairMultiplier(m, k) * pSurvive).toBeCloseTo(1, 10)
    }
  })

  it('multiplierAt: k=0 は 1.0、以降は 0.95×fair を4桁丸め', () => {
    expect(multiplierAt(3, 0, 0.95)).toBe(1)
    // 0.95 × 25/22 = 1.07954... → 1.0795
    expect(multiplierAt(3, 1, 0.95)).toBe(1.0795)
    // m=24, k=1: 0.95 × 25 = 23.75（理論最大）
    expect(multiplierAt(24, 1, 0.95)).toBe(23.75)
  })

  it('multiplierAt: k について単調増加', () => {
    for (const m of [1, 5, 12, 20]) {
      let prev = 0
      for (let k = 1; k <= GRID - m; k++) {
        const cur = multiplierAt(m, k, 0.95)
        expect(cur).toBeGreaterThan(prev)
        prev = cur
      }
    }
  })

  it('nextMultiplier は multiplierAt(k+1) と一致', () => {
    expect(nextMultiplier(5, 2, 0.95)).toBe(multiplierAt(5, 3, 0.95))
  })

  it('bustChance: 残りマスに対する地雷の割合', () => {
    expect(bustChance(24, 0)).toBeCloseTo(24 / 25, 10)
    expect(bustChance(3, 10)).toBeCloseTo(3 / 15, 10)
  })
})
