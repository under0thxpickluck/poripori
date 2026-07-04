// ep-transfer — サロンEP ⇄ MIRAIX points の転送（冪等・補償トランザクション付き）
// direction:'in'      サロンEPを減算し MIRAIX points へ入金
// direction:'out'     MIRAIX points を先に減算しサロンEPへ戻す（失敗時は返金）
// direction:'balance' サロン側の現在EP残高を照会（GAS get_balance 中継、変更なし）
import { createClient } from 'npm:@supabase/supabase-js@2'
import { callGas } from '../_shared/gas.ts'
import { gasGroupFromSalon } from '../_shared/token.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

const EP_TO_POINTS_RATE = 1
const MIN_EP = 1
const MAX_EP = 10000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: uErr } = await anon.auth.getUser()
    if (uErr || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401)
    const uid = userData.user.id

    const { direction, amount, idempotencyKey } = await req.json().catch(() => ({}))
    if (direction !== 'in' && direction !== 'out' && direction !== 'balance') {
      return json({ ok: false, error: 'bad_direction' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: profile } = await admin
      .from('profiles')
      .select('id, points, salon_group, salon_login_id')
      .eq('id', uid)
      .single()
    if (!profile?.salon_login_id || !profile?.salon_group) {
      return json({ ok: false, error: 'not_linked' }, 403)
    }
    const gasGroup = gasGroupFromSalon(profile.salon_group)

    // 現在のMIRAIX pointsを取り直して返すヘルパ（転送後の表示ズレ防止）
    const currentPoints = async (): Promise<number> => {
      const { data } = await admin.from('profiles').select('points').eq('id', uid).single()
      return Number(data?.points ?? profile.points)
    }

    // --- 残高照会（サロンEP。変更は一切行わない） ---
    if (direction === 'balance') {
      const gas = await callGas(profile.salon_group, {
        action: 'get_balance',
        id: profile.salon_login_id,
        group: gasGroup,
      })
      if (!gas.ok) return json({ ok: false, error: gas.error ?? 'gas_failed' }, 400)
      return json({ ok: true, ep_balance: Number(gas.ep ?? 0), points: Number(profile.points) })
    }

    const ep = Number(amount)
    if (!Number.isInteger(ep) || ep < MIN_EP || ep > MAX_EP) return json({ ok: false, error: 'invalid_amount' }, 400)
    if (!idempotencyKey || typeof idempotencyKey !== 'string') return json({ ok: false, error: 'idempotency_key_required' }, 400)
    const points = ep * EP_TO_POINTS_RATE

    if (direction === 'in') {
      // 冪等: 既存キーがあれば重複として返す
      const { data: dup } = await admin
        .from('ep_transfers').select('id, status').eq('idempotency_key', idempotencyKey).maybeSingle()
      if (dup) return json({ ok: false, error: 'duplicate', status: dup.status }, 409)

      const { data: row, error: insErr } = await admin
        .from('ep_transfers')
        .insert({
          user_id: uid, salon_group: profile.salon_group, salon_login_id: profile.salon_login_id,
          direction: 'in', ep_amount: ep, points_delta: points, idempotency_key: idempotencyKey,
        })
        .select('id').single()
      if (insErr) return json({ ok: false, error: `insert_failed: ${insErr.message}` }, 500)

      const gas = await callGas(profile.salon_group, {
        action: 'deduct_ep',
        loginId: profile.salon_login_id,
        amount: ep,
        group: gasGroup,
        memo: `MIRAIX入金 transfer:${row.id}`,
      })
      if (!gas.ok) {
        await admin.from('ep_transfers').update({ status: 'failed', gas_result: gas }).eq('id', row.id)
        return json({ ok: false, error: gas.error ?? 'gas_failed', ep_balance: gas.ep_balance }, 400)
      }
      const { error: rpcErr } = await admin.rpc('ep_complete_deposit', { p_transfer: row.id, p_gas: gas })
      if (rpcErr) {
        // 補償: GASは減算済みなので add_ep で戻す
        await callGas(profile.salon_group, {
          action: 'add_ep',
          loginId: profile.salon_login_id, amount: ep, group: gasGroup,
          idempotencyKey: `revert-${row.id}`,
        })
        await admin.from('ep_transfers').update({ status: 'reversed', gas_result: gas }).eq('id', row.id)
        return json({ ok: false, error: `credit_failed: ${rpcErr.message}` }, 500)
      }
      return json({ ok: true, points: await currentPoints(), ep_balance: Number(gas.ep_balance) })
    }

    // direction === 'out'（出金: points先減算 → GAS add_ep → 確定/返金）
    const { data: tid, error: beginErr } = await admin.rpc('ep_begin_withdraw', {
      p_user: uid, p_ep: ep, p_points: points, p_key: idempotencyKey,
      p_group: profile.salon_group, p_login_id: profile.salon_login_id,
    })
    if (beginErr) {
      const msg = beginErr.message.includes('INSUFFICIENT_POINTS') ? 'INSUFFICIENT_POINTS'
        : beginErr.message.includes('BONUS_LOCKED') ? 'BONUS_LOCKED'
        : beginErr.message.includes('duplicate key') ? 'duplicate'
        : beginErr.message
      return json({ ok: false, error: msg }, 400)
    }
    const gas = await callGas(profile.salon_group, {
      action: 'add_ep',
      loginId: profile.salon_login_id,
      amount: ep,
      group: gasGroup,
      idempotencyKey: String(tid),
    })
    const { error: finErr } = await admin.rpc('ep_finish_withdraw', {
      p_transfer: tid, p_ok: !!gas.ok, p_gas: gas,
    })
    if (finErr) return json({ ok: false, error: `finalize_failed: ${finErr.message}` }, 500)
    if (!gas.ok) return json({ ok: false, error: gas.error ?? 'gas_failed' }, 400)
    return json({ ok: true, points: await currentPoints(), ep_balance: Number(gas.ep_balance) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
