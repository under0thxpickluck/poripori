import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, AYANO_ID } from './localClient'

const client = createLocalClient()

async function myProfile() {
  const { data } = await client.from('profiles').select('*').eq('id', AYANO_ID)
  return (data as any[])[0] as {
    points: number
    bonus_locked: number
    residency: string | null
    residency_consent_version: string | null
    residency_consented_at: string | null
  }
}

async function withdrawable(): Promise<number> {
  const p = await myProfile()
  return Math.round((p.points - p.bonus_locked) * 100) / 100
}

// migrate-016: ゲームの純増分は bonus_locked に積まれ、出金可能額(points - bonus_locked)を
// ゲームで増やすことはできない
describe('migrate-016 ゲーム勝ち分ロック', () => {
  beforeEach(() => resetLocalDb())

  it('Mines: cashout の純増分が bonus_locked に加算され、出金可能額が増えない', async () => {
    switchLocalUser(AYANO_ID)
    // 罠3個・2マス開けて cashout(倍率 0.95×(25/22)(24/21)≈1.234 > 1)。罠を踏んだらリトライ(~23%)
    for (let attempt = 0; attempt < 20; attempt++) {
      const before = await myProfile()
      const beforeLocked = before.bonus_locked
      const wBefore = await withdrawable()

      const { data: g } = await client.rpc('mines_start', { p_bet: 100, p_mines: 3 })
      const gameId = (g as { id: string }).id
      let busted = false
      for (const cell of [0, 1]) {
        const { data: r } = await client.rpc('mines_reveal', { p_game: gameId, p_cell: cell })
        if (!(r as { safe: boolean }).safe) { busted = true; break }
      }
      if (busted) continue // 罠: リトライ

      const { data: c, error } = await client.rpc('mines_cashout', { p_game: gameId })
      expect(error).toBeNull()
      const payout = (c as { payout: number }).payout
      expect(payout).toBeGreaterThan(100) // 罠3・2マスは 1.234 倍

      const after = await myProfile()
      // 純増分(payout - bet)だけロックが増える
      expect(after.bonus_locked).toBeCloseTo(beforeLocked + (payout - 100), 2)
      // 出金可能額はゲーム前後で変わらない(ベット原資はロックされない)
      expect(await withdrawable()).toBeCloseTo(wBefore, 2)
      return
    }
    throw new Error('20回連続で罠(確率 0.23^20)。実装異常の可能性')
  })

  it('Mines: バーストでは bonus_locked が増えない', async () => {
    switchLocalUser(AYANO_ID)
    const before = await myProfile()
    const beforeLocked = before.bonus_locked
    // 罠24個: どのマスを開けてもほぼバースト(安全1マスを引いたらリトライ)
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: g } = await client.rpc('mines_start', { p_bet: 100, p_mines: 24 })
      const gameId = (g as { id: string }).id
      const { data: r } = await client.rpc('mines_reveal', { p_game: gameId, p_cell: attempt })
      if ((r as { safe: boolean; status: string }).safe) {
        // 唯一の安全マス(自動cashed)。ロックは増えるがこのケースの対象外なのでリセットして継続
        resetLocalDb()
        switchLocalUser(AYANO_ID)
        continue
      }
      const after = await myProfile()
      expect(after.bonus_locked).toBeLessThanOrEqual(beforeLocked)
      return
    }
    throw new Error('10回連続で安全マス(確率 (1/25)^10)。実装異常の可能性')
  })

  it('Plinko: 何回遊んでも出金可能額は増えない(勝ち分は全額ロック)', async () => {
    switchLocalUser(AYANO_ID)
    for (let i = 0; i < 30; i++) {
      const wBefore = await withdrawable()
      const lockedBefore = (await myProfile()).bonus_locked
      const { data, error } = await client.rpc('plinko_play', { p_bet: 50, p_rows: 8 })
      expect(error).toBeNull()
      const r = data as { payout: number }
      const after = await myProfile()
      const wAfter = await withdrawable()
      // 出金可能額は絶対に増えない
      expect(wAfter).toBeLessThanOrEqual(wBefore + 1e-9)
      if (r.payout > 50) {
        // 勝ち: 純増分がロックに積まれ、出金可能額は不変
        expect(after.bonus_locked).toBeCloseTo(lockedBefore + (r.payout - 50), 2)
        expect(wAfter).toBeCloseTo(wBefore, 2)
      }
      if ((await myProfile()).points < 50) break
    }
  })
})

// migrate-016: declare_residency(居住国申告の記録)
describe('rpc declare_residency', () => {
  beforeEach(() => resetLocalDb())

  it('申告が profiles に記録される', async () => {
    switchLocalUser(AYANO_ID)
    const { error } = await client.rpc('declare_residency', {
      p_residency: 'overseas',
      p_version: 'v1-2026-07-05',
    })
    expect(error).toBeNull()
    const p = await myProfile()
    expect(p.residency).toBe('overseas')
    expect(p.residency_consent_version).toBe('v1-2026-07-05')
    expect(p.residency_consented_at).toBeTruthy()
  })

  it('不正な居住国は BAD_RESIDENCY', async () => {
    switchLocalUser(AYANO_ID)
    const { error } = await client.rpc('declare_residency', {
      p_residency: 'mars',
      p_version: 'v1-2026-07-05',
    })
    expect(error?.message).toContain('BAD_RESIDENCY')
  })

  it('空バージョンは BAD_VERSION', async () => {
    switchLocalUser(AYANO_ID)
    const { error } = await client.rpc('declare_residency', {
      p_residency: 'japan',
      p_version: '',
    })
    expect(error?.message).toContain('BAD_VERSION')
  })
})
