// HMAC-SHA256 署名付きSSOトークン。Web Crypto のみ使用（Deno / Node 18+ / vitest で同一動作）。
// サロン（LIFAIOV / aisalon）側の app/lib/miraixSso.ts と形式互換を保つこと。
export type SsoPayload = {
  gasGroup: '' | '5000'
  loginId: string
  email?: string
  iat: number
  exp: number
}

// GASのgroup値 → MIRAIX DBのsalon_group（空文字は使わない）
export function salonGroupFromGas(g: string): string {
  return g === '5000' ? '5000' : 'aisalon'
}
// MIRAIX DBのsalon_group → GASのgroup値
export function gasGroupFromSalon(g: string): string {
  return g === 'aisalon' ? '' : g
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  )
}

export async function signSsoToken(secret: string, payload: SsoPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

export async function verifySsoToken(secret: string, token: string, nowMs = Date.now()): Promise<SsoPayload> {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('bad_token')
  let sigBytes: Uint8Array
  try {
    sigBytes = b64urlDecode(sig)
  } catch {
    throw new Error('bad_token')
  }
  const ok = await crypto.subtle.verify(
    'HMAC', await hmacKey(secret), sigBytes as unknown as BufferSource, enc.encode(body),
  )
  if (!ok) throw new Error('bad_signature')
  let payload: SsoPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)))
  } catch {
    throw new Error('bad_payload')
  }
  if (!payload.loginId || typeof payload.exp !== 'number') throw new Error('bad_payload')
  if (payload.exp * 1000 < nowMs) throw new Error('token_expired')
  return payload
}
