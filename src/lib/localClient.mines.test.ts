import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, AYANO_ID } from './localClient'
import { multiplierAt, GRID } from './mines-math'

const client = createLocalClient()

async function myPoints(): Promise<number> {
  const { data } = await client.from('profiles').select('*').eq('id', AYANO_ID)
  return (data as any[])[0].points as number
}

type StartRes = { id: string; balance: number; status: string; multiplier: number }
type RevealRes = {
  safe: boolean
  status: string
  multiplier: number
  revealed: number[]
  payout?: number
  balance?: number
  mines?: number[]
}

async function start(bet = 100, mines = 3): Promise<StartRes> {
  const { data, error } = await client.rpc('mines_start', { p_bet: bet, p_mines: mines })
  expect(error).toBeNull()
  return data as StartRes
}

async function reveal(game: string, cell: number): Promise<RevealRes> {
  const { data, error } = await client.rpc('mines_reveal', { p_game: game, p_cell: cell })
  expect(error).toBeNull()
  return data as RevealRes
}

// ゲームを終局までドライブして「安全マスを n 枚開けた状態」を作るヘルパ。
// 地雷はランダムなので、罠を踏んだら null を返す（呼び出し側でリトライ）。
async function revealSafe(game: string, count: number): Promise<RevealRes | null> {
  let last: RevealRes | null = null
  let opened = 0
  for (let cell = 0; cell < GRID && opened < count; cell++) {
    const r = await reveal(game, cell)
    if (!r.safe) return null
    last = r
    opened++
    if (r.status === 'cashed') break
  }
  return last
}

describe('localClient mines RPC', () => {
  beforeEach(() => resetLocalDb())

  it('開始でベットが即時減算され、activeゲームが作られる', async () => {
    switchLocalUser(AYANO_ID)
    const before = await myPoints()
    const g = await start(100, 3)
    expect(g.status).toBe('active')
    expect(g.multiplier).toBe(1)
    expect(g.balance).toBe(before - 100)
    expect(await myPoints()).toBe(before - 100)
    // mines 列は終局まで null（クライアントから地雷が見えない）
    const { data } = await client.from('mines_games').select('*').eq('id', g.id)
    expect((data as any[])[0].mines).toBeNull()
  })

  it('active中は二重開始できない（GAME_ACTIVE）', async () => {
    switchLocalUser(AYANO_ID)
    await start(10, 3)
    const { error } = await client.rpc('mines_start', { p_bet: 10, p_mines: 3 })
    expect(error?.message).toContain('GAME_ACTIVE')
  })

  it('ベット検証: 非整数・範囲外・残高不足を拒否', async () => {
    switchLocalUser(AYANO_ID)
    expect((await client.rpc('mines_start', { p_bet: 1.5, p_mines: 3 })).error?.message).toContain('BAD_BET')
    expect((await client.rpc('mines_start', { p_bet: 0, p_mines: 3 })).error?.message).toContain('BAD_BET')
    expect((await client.rpc('mines_start', { p_bet: 10001, p_mines: 3 })).error?.message).toContain('BAD_BET')
    expect((await client.rpc('mines_start', { p_bet: 10, p_mines: 0 })).error?.message).toContain('BAD_MINES')
    expect((await client.rpc('mines_start', { p_bet: 10, p_mines: 25 })).error?.message).toContain('BAD_MINES')
    expect((await client.rpc('mines_start', { p_bet: 10000, p_mines: 3 })).error?.message).toContain('INSUFFICIENT_POINTS')
  })

  it('安全開示で倍率が mines-math と一致し、罠なら busted + 地雷公開', async () => {
    switchLocalUser(AYANO_ID)
    // 地雷1個なら 24 マスまでは安全に開けられる可能性が高い —
    // ランダム性に依存しないよう、結果に応じて両分岐を検証する
    const g = await start(100, 3)
    let k = 0
    for (let cell = 0; cell < GRID; cell++) {
      const { data } = await client.rpc('mines_reveal', { p_game: g.id, p_cell: cell })
      const r = data as RevealRes
      if (r.safe) {
        k++
        expect(r.multiplier).toBe(multiplierAt(3, k, 0.95))
        if (r.status === 'cashed') break
      } else {
        expect(r.status).toBe('busted')
        expect(r.mines).toHaveLength(3)
        expect(r.mines).toContain(cell)
        // 没収: 残高は戻らない
        const { data: rows } = await client.from('mines_games').select('*').eq('id', g.id)
        expect((rows as any[])[0].payout).toBe(0)
        return
      }
    }
    // 罠を踏まずに全開した場合は自動キャッシュアウトされている
    const { data: rows } = await client.from('mines_games').select('*').eq('id', g.id)
    expect((rows as any[])[0].status).toBe('cashed')
  })

  it('開示済みマスの再開示は ALREADY_REVEALED', async () => {
    switchLocalUser(AYANO_ID)
    const g = await start(10, 1) // 地雷1個: どこか1マスは高確率で安全
    let safeCell = -1
    for (let cell = 0; cell < 3; cell++) {
      const { data } = await client.rpc('mines_reveal', { p_game: g.id, p_cell: cell })
      if ((data as RevealRes)?.safe) { safeCell = cell; break }
    }
    if (safeCell < 0) return // 3連続で罠(確率的にほぼ無い)場合はスキップ
    const { error } = await client.rpc('mines_reveal', { p_game: g.id, p_cell: safeCell })
    expect(error?.message).toContain('ALREADY_REVEALED')
  })

  it('0枚開示でのキャッシュアウトは NO_REVEAL', async () => {
    switchLocalUser(AYANO_ID)
    const g = await start(10, 3)
    const { error } = await client.rpc('mines_cashout', { p_game: g.id })
    expect(error?.message).toContain('NO_REVEAL')
  })

  it('キャッシュアウトで round(bet×倍率, 2) が加算され、ゲームは cashed になる', async () => {
    switchLocalUser(AYANO_ID)
    // ランダム性があるため成功するまで数回試す
    for (let attempt = 0; attempt < 20; attempt++) {
      const before = await myPoints()
      const g = await start(100, 3)
      const last = await revealSafe(g.id, 2)
      if (!last) { continue } // 罠を踏んだら次の試行へ
      if (last.status === 'cashed') continue
      const { data, error } = await client.rpc('mines_cashout', { p_game: g.id })
      expect(error).toBeNull()
      const res = data as { payout: number; balance: number; mines: number[] }
      const expectedPayout = Math.round(100 * multiplierAt(3, 2, 0.95) * 100) / 100
      expect(res.payout).toBe(expectedPayout)
      expect(res.balance).toBe(Math.round((before - 100 + expectedPayout) * 100) / 100)
      expect(res.mines).toHaveLength(3)
      // 終局後の再操作は GAME_FINISHED
      const again = await client.rpc('mines_cashout', { p_game: g.id })
      expect(again.error?.message).toContain('GAME_FINISHED')
      return
    }
    throw new Error('20回試行しても2枚開けられなかった（異常）')
  })

  it('他人のゲームは開示できない（GAME_NOT_FOUND）', async () => {
    switchLocalUser(AYANO_ID)
    const g = await start(10, 3)
    switchLocalUser('00000000-0000-4000-8000-000000000001') // ADMIN
    const { error } = await client.rpc('mines_reveal', { p_game: g.id, p_cell: 0 })
    expect(error?.message).toContain('GAME_NOT_FOUND')
  })

  it('管理RPC: ハウスエッジは 0.10〜1.50 のみ・非管理者拒否', async () => {
    switchLocalUser(AYANO_ID)
    expect((await client.rpc('admin_mines_set_house_edge', { p_edge: 0.9 })).error?.message).toContain('ADMIN_REQUIRED')
    switchLocalUser('00000000-0000-4000-8000-000000000001')
    expect((await client.rpc('admin_mines_set_house_edge', { p_edge: 2 })).error?.message).toContain('RTP_OUT_OF_RANGE')
    expect((await client.rpc('admin_mines_set_house_edge', { p_edge: 0.9 })).error).toBeNull()
    const { data } = await client.from('mines_config').select('*').eq('id', 1)
    expect((data as any[])[0].house_edge).toBe(0.9)
  })
})
