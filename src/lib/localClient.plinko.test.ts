import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, ADMIN_ID, AYANO_ID } from './localClient'
import { ROW_OPTIONS, generateMultipliers, calcRTP, GROWTH } from './plinko-odds'

const client = createLocalClient()

type ConfigRow = { rows_count: number; multipliers: number[] }
type PlayResult = { bucket: number; multiplier: number; payout: number; balance: number }

async function loadConfig(): Promise<ConfigRow[]> {
  const { data } = await client.from('plinko_config').select('rows_count, multipliers').order('rows_count')
  return (data ?? []) as ConfigRow[]
}

async function myPoints(id: string): Promise<number> {
  const { data } = await client.from('profiles').select('*').eq('id', id)
  return (data as Array<{ points: number }>)[0].points
}

describe('local plinko_config', () => {
  beforeEach(() => resetLocalDb())

  it('全段数の倍率テーブルが読める(ゲーム/管理ページの select と同じ形)', async () => {
    const rows = await loadConfig()
    expect(rows.map((r) => r.rows_count)).toEqual([...ROW_OPTIONS])
    for (const r of rows) {
      expect(r.multipliers).toHaveLength(r.rows_count + 1)
      // 既定値は migration と同じ生成則(8段95%⇔16段90%線形補間, GROWTH)
      const t = (r.rows_count - ROW_OPTIONS[0]) / (ROW_OPTIONS[ROW_OPTIONS.length - 1] - ROW_OPTIONS[0])
      const target = 0.95 + (0.9 - 0.95) * t
      expect(r.multipliers).toEqual(generateMultipliers(r.rows_count, target, GROWTH))
    }
  })
})

describe('rpc plinko_play', () => {
  beforeEach(() => resetLocalDb())

  it('残高から bet を引き、着地マスの倍率で配当し、台帳に記録する', async () => {
    switchLocalUser(ADMIN_ID)
    const before = await myPoints(ADMIN_ID)
    const config = await loadConfig()
    const mult8 = config.find((c) => c.rows_count === 8)!.multipliers

    const { data, error } = await client.rpc('plinko_play', { p_bet: 10, p_rows: 8 })
    expect(error).toBeNull()
    const res = data as PlayResult
    expect(res.bucket).toBeGreaterThanOrEqual(0)
    expect(res.bucket).toBeLessThanOrEqual(8)
    expect(res.multiplier).toBe(mult8[res.bucket])
    expect(res.payout).toBe(Math.round(10 * res.multiplier * 100) / 100)
    expect(res.balance).toBeCloseTo(before - 10 + res.payout, 2)
    expect(await myPoints(ADMIN_ID)).toBeCloseTo(res.balance, 2)

    const { data: plays } = await client.from('plinko_plays').select('*').eq('user_id', ADMIN_ID)
    expect(plays as unknown[]).toHaveLength(1)
    const play = (plays as Array<Record<string, unknown>>)[0]
    expect(play.bet).toBe(10)
    expect(play.rows_count).toBe(8)
    expect(play.bucket).toBe(res.bucket)
    expect(play.payout).toBe(res.payout)
  })

  it('bet が範囲外(1未満/10000超)なら BAD_BET', async () => {
    switchLocalUser(ADMIN_ID)
    for (const bad of [0, 10001, NaN]) {
      const { error } = await client.rpc('plinko_play', { p_bet: bad, p_rows: 8 })
      expect(error?.message).toContain('BAD_BET')
    }
  })

  it('設定に無い段数は BAD_ROWS', async () => {
    switchLocalUser(ADMIN_ID)
    const { error } = await client.rpc('plinko_play', { p_bet: 10, p_rows: 9 })
    expect(error?.message).toContain('BAD_ROWS')
  })

  it('残高不足は INSUFFICIENT_POINTS', async () => {
    switchLocalUser(AYANO_ID) // 5000pt
    const { error } = await client.rpc('plinko_play', { p_bet: 6000, p_rows: 8 })
    expect(error?.message).toContain('INSUFFICIENT_POINTS')
  })

  it('未ログインは AUTH_REQUIRED', async () => {
    await client.auth.signOut()
    const { error } = await client.rpc('plinko_play', { p_bet: 10, p_rows: 8 })
    expect(error?.message).toContain('AUTH_REQUIRED')
  })
})

describe('rpc admin_plinko_set_multipliers', () => {
  beforeEach(() => resetLocalDb())

  it('admin は倍率テーブルを更新できる', async () => {
    switchLocalUser(ADMIN_ID)
    const next = generateMultipliers(8, 0.5, GROWTH)
    const { error } = await client.rpc('admin_plinko_set_multipliers', { p_rows: 8, p_multipliers: next })
    expect(error).toBeNull()
    const config = await loadConfig()
    expect(config.find((c) => c.rows_count === 8)!.multipliers).toEqual(next)
  })

  it('RTP が 10%〜150% を外れると RTP_OUT_OF_RANGE', async () => {
    switchLocalUser(ADMIN_ID)
    const base = generateMultipliers(8, 0.95, GROWTH)
    const double = base.map((m) => m * 2) // RTP ≒ 190%
    expect(calcRTP(8, double)).toBeGreaterThan(1.5)
    const { error } = await client.rpc('admin_plinko_set_multipliers', { p_rows: 8, p_multipliers: double })
    expect(error?.message).toContain('RTP_OUT_OF_RANGE')
  })

  it('長さが rows+1 でないと BAD_MULTIPLIERS', async () => {
    switchLocalUser(ADMIN_ID)
    const { error } = await client.rpc('admin_plinko_set_multipliers', { p_rows: 8, p_multipliers: [1, 2, 3] })
    expect(error?.message).toContain('BAD_MULTIPLIERS')
  })

  it('非 admin は ADMIN_REQUIRED', async () => {
    switchLocalUser(AYANO_ID)
    const next = generateMultipliers(8, 0.5, GROWTH)
    const { error } = await client.rpc('admin_plinko_set_multipliers', { p_rows: 8, p_multipliers: next })
    expect(error?.message).toContain('ADMIN_REQUIRED')
  })
})
