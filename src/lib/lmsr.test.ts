import { describe, it, expect } from 'vitest'
import {
  costFn,
  currentPrice,
  buyCost,
  sellRefund,
  sharesForPoints,
  resolvePayouts,
} from './lmsr'
import type { Market } from '../types'

// 最小限の Market を組み立てるヘルパ
function mk(q_yes: number, q_no: number, b = 100): Market {
  return {
    id: 'm',
    question: 'q',
    description: '',
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'open',
    q_yes,
    q_no,
    b,
    resolved: null,
    createdBy: 'u',
    createdAt: new Date().toISOString(),
    category: 'AI',
    volume: 0,
    extendedCount: 0,
    lastExtendedAt: null,
    priceHistory: [],
  }
}

describe('currentPrice', () => {
  it('価格は YES/NO で合計1', () => {
    const p = currentPrice(30, 10, 100)
    expect(p.yes + p.no).toBeCloseTo(1, 12)
  })

  it('対称な在庫では 50/50', () => {
    const p = currentPrice(0, 0, 100)
    expect(p.yes).toBeCloseTo(0.5, 12)
    expect(p.no).toBeCloseTo(0.5, 12)
  })

  it('YES在庫が多いほど YES価格が上がる', () => {
    expect(currentPrice(50, 0, 100).yes).toBeGreaterThan(currentPrice(10, 0, 100).yes)
  })

  it('大きな在庫差でもオーバーフローせず[0,1]に収まる', () => {
    const p = currentPrice(100_000, 0, 100)
    expect(p.yes).toBeGreaterThan(0.999)
    expect(p.yes).toBeLessThanOrEqual(1)
    expect(Number.isFinite(p.yes)).toBe(true)
  })
})

describe('costFn', () => {
  it('在庫が増えるとコスト関数は単調増加', () => {
    expect(costFn(10, 0, 100)).toBeGreaterThan(costFn(0, 0, 100))
  })
})

describe('buyCost / sellRefund', () => {
  it('購入コストは正で、価格×枚数の近傍にある', () => {
    const m = mk(0, 0)
    const cost = buyCost(m, 'YES', 10)
    expect(cost).toBeGreaterThan(0)
    // 50%付近なので 10枚 ≒ 5pt 前後
    expect(cost).toBeGreaterThan(4)
    expect(cost).toBeLessThan(6)
  })

  it('買った直後に同枚数を売ると返金＝購入コスト（LMSRは経路非依存）', () => {
    const before = mk(20, 35)
    const shares = 12
    const cost = buyCost(before, 'YES', shares)
    const after = mk(before.q_yes + shares, before.q_no)
    const refund = sellRefund(after, 'YES', shares)
    expect(refund).toBeCloseTo(cost, 9)
  })

  it('買うほど平均単価が上がる（スリッページ）', () => {
    const m = mk(0, 0)
    const unit1 = buyCost(m, 'YES', 1) / 1
    const unit100 = buyCost(m, 'YES', 100) / 100
    expect(unit100).toBeGreaterThan(unit1)
  })
})

describe('sharesForPoints', () => {
  it('予算ぴったりで買える枚数を返す（コスト ≤ 予算）', () => {
    const m = mk(5, 8)
    const budget = 25
    const shares = sharesForPoints(m, 'YES', budget)
    expect(shares).toBeGreaterThan(0)
    expect(buyCost(m, 'YES', shares)).toBeLessThanOrEqual(budget + 1e-6)
  })

  it('予算0以下なら0枚', () => {
    expect(sharesForPoints(mk(0, 0), 'YES', 0)).toBe(0)
    expect(sharesForPoints(mk(0, 0), 'YES', -10)).toBe(0)
  })
})

describe('resolvePayouts', () => {
  it('YES解決では各ユーザーの YESシェア分を配当', () => {
    const pos = [
      { userId: 'a', yesShares: 10, noShares: 2 },
      { userId: 'b', yesShares: 0, noShares: 7 },
    ]
    expect(resolvePayouts(pos, 'YES')).toEqual({ a: 10, b: 0 })
    expect(resolvePayouts(pos, 'NO')).toEqual({ a: 2, b: 7 })
  })
})
