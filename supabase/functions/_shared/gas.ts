// GAS webapp への server-to-server 呼び出し。key はURLクエリ（GAS pickKey_ 仕様）。
// ⚠️ GASはサロンごとに別プロジェクト。salon_group("5000"=LIFAIOV / "aisalon") で接続情報を選ぶ。
// 絶対に片方のURLをもう片方の会員に使わないこと（会員プール分離の要）。
type GasEnv = { url: string; key: string; adminKey: string }

// GAS応答のタイムアウト(ms)。超過時は fetch を中断して throw させ、呼び出し側で
// gas_unreachable_pending として pending 記録に落とす(滞留pendingは resume で回収)。
const GAS_TIMEOUT_MS = 25000

function gasEnvFor(salonGroup: string): GasEnv {
  const suffix = salonGroup === '5000' ? 'LIFAIOV' : 'AISALON'
  const url = Deno.env.get(`GAS_URL_${suffix}`)
  const key = Deno.env.get(`GAS_KEY_${suffix}`)
  const adminKey = Deno.env.get(`GAS_ADMIN_KEY_${suffix}`)
  if (!url || !key || !adminKey) throw new Error(`gas_env_missing:${suffix}`)
  return { url, key, adminKey }
}

// adminKey は該当サロンのものを自動付与する（呼び出し側で渡さない）
export async function callGas(salonGroup: string, body: Record<string, unknown>): Promise<any> {
  const env = gasEnvFor(salonGroup)
  const sep = env.url.includes('?') ? '&' : '?'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), GAS_TIMEOUT_MS)
  try {
    const res = await fetch(`${env.url}${sep}key=${encodeURIComponent(env.key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, adminKey: env.adminKey }),
      signal: ctrl.signal,
    })
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return { ok: false, error: 'gas_not_json', raw: text.slice(0, 300) }
    }
  } finally {
    clearTimeout(timer)
  }
}
