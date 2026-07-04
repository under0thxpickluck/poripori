import { describe, it, expect } from 'vitest'
import {
  signSsoToken, verifySsoToken, salonGroupFromGas, gasGroupFromSalon,
} from '../../supabase/functions/_shared/token'

const SECRET = 'test-secret'

describe('SSO token', () => {
  it('sign→verify が往復する', async () => {
    const now = Date.now()
    const token = await signSsoToken(SECRET, {
      gasGroup: '5000', loginId: 'user01', email: 'a@b.co',
      iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300,
    })
    const p = await verifySsoToken(SECRET, token, now)
    expect(p.loginId).toBe('user01')
    expect(p.gasGroup).toBe('5000')
  })

  it('期限切れは reject', async () => {
    const now = Date.now()
    const token = await signSsoToken(SECRET, {
      gasGroup: '', loginId: 'u', iat: Math.floor(now / 1000) - 600, exp: Math.floor(now / 1000) - 300,
    })
    await expect(verifySsoToken(SECRET, token, now)).rejects.toThrow('token_expired')
  })

  it('署名改ざんは reject', async () => {
    const now = Date.now()
    const token = await signSsoToken(SECRET, {
      gasGroup: '', loginId: 'u', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300,
    })
    await expect(verifySsoToken('wrong', token, now)).rejects.toThrow('bad_signature')
  })

  it('壊れたトークンは reject', async () => {
    await expect(verifySsoToken(SECRET, 'not-a-token')).rejects.toThrow('bad_token')
  })

  it('groupマッピングが往復する', () => {
    expect(salonGroupFromGas('5000')).toBe('5000')
    expect(salonGroupFromGas('')).toBe('aisalon')
    expect(gasGroupFromSalon('5000')).toBe('5000')
    expect(gasGroupFromSalon('aisalon')).toBe('')
  })
})
