import { describe, it, expect } from 'vitest'
import { addDeadline } from './deadline'

describe('addDeadline', () => {
  const base = new Date('2026-06-28T00:00:00.000Z')

  it('+1日', () => {
    expect(addDeadline(base, '1d').toISOString()).toBe('2026-06-29T00:00:00.000Z')
  })
  it('+3日', () => {
    expect(addDeadline(base, '3d').toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
  it('+1週間', () => {
    expect(addDeadline(base, '1w').toISOString()).toBe('2026-07-05T00:00:00.000Z')
  })
  it('base を破壊しない', () => {
    addDeadline(base, '1w')
    expect(base.toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })
})
