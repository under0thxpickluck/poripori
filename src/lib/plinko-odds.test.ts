import { describe, it, expect } from 'vitest'
import { generateMultipliers, calcRTP, ROW_OPTIONS, GROWTH } from './plinko-odds'

// migrate-011-plinko.sql の seed 値と完全一致すること(単一の真実の検証)
const MIGRATION_SEED: Record<number, number[]> = {
  8: [5.7, 2.9, 1.4, 0.72, 0.38, 0.72, 1.4, 2.9, 5.7],
  10: [9.7, 4.9, 2.4, 1.2, 0.61, 0.33, 0.61, 1.2, 2.4, 4.9, 9.7],
  12: [17, 8.3, 4.2, 2.1, 1, 0.52, 0.29, 0.52, 1, 2.1, 4.2, 8.3, 17],
  14: [29, 14, 7.1, 3.6, 1.8, 0.89, 0.45, 0.21, 0.45, 0.89, 1.8, 3.6, 7.1, 14, 29],
  16: [49, 25, 12, 6.2, 3.1, 1.5, 0.77, 0.38, 0.22, 0.38, 0.77, 1.5, 3.1, 6.2, 12, 25, 49],
}

// 既定 RTP: 8段95% ⇔ 16段90% の線形補間
function defaultRtp(rows: number): number {
  return 0.95 - ((rows - 8) / 8) * 0.05
}

describe('generateMultipliers', () => {
  it.each(ROW_OPTIONS.map((r) => [r]))('%i段: マイグレーション seed と一致する', (rows) => {
    expect(generateMultipliers(rows, defaultRtp(rows), GROWTH)).toEqual(MIGRATION_SEED[rows])
  })

  it.each(ROW_OPTIONS.map((r) => [r]))('%i段: 実RTPが狙いの±0.5%以内', (rows) => {
    const mult = generateMultipliers(rows, defaultRtp(rows), GROWTH)
    expect(Math.abs(calcRTP(rows, mult) - defaultRtp(rows))).toBeLessThan(0.005)
  })

  it('倍率テーブルは対称', () => {
    for (const rows of ROW_OPTIONS) {
      const m = generateMultipliers(rows, defaultRtp(rows), GROWTH)
      expect(m).toEqual([...m].reverse())
      expect(m).toHaveLength(rows + 1)
    }
  })

  it('RTP を変えるとテーブルが変わり、calcRTP が追従する', () => {
    const m = generateMultipliers(12, 0.8, GROWTH)
    expect(Math.abs(calcRTP(12, m) - 0.8)).toBeLessThan(0.005)
  })
})
