import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, AYANO_ID } from './localClient'

const client = createLocalClient()

async function myProfile() {
  const { data } = await client.from('profiles').select('*').eq('id', AYANO_ID)
  return (data as any[])[0] as { points: number; bonus_locked: number; last_bonus: string | null }
}

// migrate-013: デイリーボーナスは bonus_locked にも同額加算され、サロンEPへ出金できない
describe('rpc claim_daily_bonus × bonus_locked', () => {
  beforeEach(() => resetLocalDb())

  it('付与額が points と bonus_locked の両方に加算される（出金可能額を増やさない）', async () => {
    switchLocalUser(AYANO_ID)
    // localClient の select はライブ参照を返すため、数値で先に退避する
    const before = await myProfile()
    const beforePoints = before.points
    const beforeLocked = before.bonus_locked
    const withdrawableBefore = beforePoints - beforeLocked

    const { data, error } = await client.rpc('claim_daily_bonus', {})
    expect(error).toBeNull()
    const r = data as { claimed: boolean; amount: number }
    expect(r.claimed).toBe(true)

    const after = await myProfile()
    expect(after.points).toBe(beforePoints + r.amount)
    expect(after.bonus_locked).toBe(beforeLocked + r.amount)
    // 出金可能額（points - bonus_locked）は変わらない
    expect(after.points - after.bonus_locked).toBe(withdrawableBefore)
  })

  it('同日2回目は claimed:false で残高もロックも変わらない', async () => {
    switchLocalUser(AYANO_ID)
    await client.rpc('claim_daily_bonus', {})
    const mid = await myProfile()
    const midPoints = mid.points
    const midLocked = mid.bonus_locked
    const { data } = await client.rpc('claim_daily_bonus', {})
    expect((data as { claimed: boolean }).claimed).toBe(false)
    const after = await myProfile()
    expect(after.points).toBe(midPoints)
    expect(after.bonus_locked).toBe(midLocked)
  })

  it('bonus_locked は points を超えない（クランプ）', async () => {
    switchLocalUser(AYANO_ID)
    // points を bonus_locked と同額まで下げた状態を作る
    await client.from('profiles').update({ points: 1000, bonus_locked: 1000 }).eq('id', AYANO_ID)
    const { data } = await client.rpc('claim_daily_bonus', {})
    const r = data as { claimed: boolean; amount: number }
    expect(r.claimed).toBe(true)
    const after = await myProfile()
    expect(after.bonus_locked).toBeLessThanOrEqual(after.points)
    // 全額ボーナス由来なので全額ロック＝出金可能 0
    expect(after.points - after.bonus_locked).toBe(0)
  })
})
