import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, ADMIN_ID, AYANO_ID } from './localClient'

const client = createLocalClient()
const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

// closed な市場 ID を1つ用意するヘルパ（seed に closed が無ければ作る）。
async function aClosedMarketId(): Promise<string> {
  switchLocalUser(ADMIN_ID)
  const { data } = await client.from('markets').select('*')
  const rows = (data ?? []) as Array<{ id: string; status: string }>
  const closed = rows.find((m) => m.status === 'closed')
  if (closed) return closed.id
  // open を1つ closed にして使う
  const open = rows.find((m) => m.status === 'open')!
  await client.from('markets').update({ status: 'closed' }).eq('id', open.id)
  return open.id
}

describe('rpc extend_market', () => {
  beforeEach(() => resetLocalDb())

  it('admin は closed 市場を未来締切で open に戻し、extended_count を増やす', async () => {
    switchLocalUser(ADMIN_ID)
    const id = await aClosedMarketId()
    const newDeadline = future()
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: newDeadline })
    expect(error).toBeNull()

    const { data } = await client.from('markets').select('*').eq('id', id)
    const m = (data as any[])[0]
    expect(m.status).toBe('open')
    expect(m.deadline).toBe(newDeadline)
    expect(m.extended_count).toBe(1)
    expect(m.last_extended_at).not.toBeNull()
  })

  it('過去の締切は DEADLINE_IN_PAST で拒否', async () => {
    switchLocalUser(ADMIN_ID)
    const id = await aClosedMarketId()
    const past = new Date(Date.now() - 1000).toISOString()
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: past })
    expect(error?.message).toContain('DEADLINE_IN_PAST')
  })

  it('closed 以外は NOT_CLOSED で拒否', async () => {
    switchLocalUser(ADMIN_ID)
    const { data } = await client.from('markets').select('*')
    const open = (data as any[]).find((m) => m.status === 'open')
    const { error } = await client.rpc('extend_market', { p_market_id: open.id, p_new_deadline: future() })
    expect(error?.message).toContain('NOT_CLOSED')
  })

  it('非 admin は ADMIN_REQUIRED で拒否', async () => {
    const id = await aClosedMarketId() // 内部で一旦 admin に切替
    switchLocalUser(AYANO_ID)
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: future() })
    expect(error?.message).toContain('ADMIN_REQUIRED')
  })
})
