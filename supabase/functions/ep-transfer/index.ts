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

    const { direction, amount, idempotencyKey, transferId } = await req.json().catch(() => ({}))
    if (direction !== 'in' && direction !== 'out' && direction !== 'balance' && direction !== 'resume') {
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

    // --- pending転送の再開（本人のみ）。GAS側の冪等キー照合により、
    //     実行済みなら duplicated:true が返るだけで二重減算/二重付与は起きない ---
    if (direction === 'resume') {
      if (!transferId || typeof transferId !== 'string') {
        return json({ ok: false, error: 'transfer_id_required' }, 400)
      }
      const { data: t } = await admin
        .from('ep_transfers')
        .select('id, user_id, salon_group, salon_login_id, direction, ep_amount, status, gas_result')
        .eq('id', transferId)
        .maybeSingle()
      if (!t || t.user_id !== uid) return json({ ok: false, error: 'transfer_not_found' }, 404)
      if (t.status !== 'pending') return json({ ok: false, error: 'not_pending', status: t.status }, 409)
      const tGasGroup = gasGroupFromSalon(t.salon_group)
      const tEp = Number(t.ep_amount)

      if (t.direction === 'out') {
        // 出金の再開: add_ep は当初から transfer id を冪等キーにしているため常に再実行可能
        let gasOut
        try {
          gasOut = await callGas(t.salon_group, {
            action: 'add_ep', loginId: t.salon_login_id, amount: tEp, group: tGasGroup,
            idempotencyKey: String(t.id),
          })
        } catch {
          return json({ ok: false, error: 'gas_unreachable_pending' }, 502)
        }
        const { error: finErr } = await admin.rpc('ep_finish_withdraw', {
          p_transfer: t.id, p_ok: !!gasOut.ok, p_gas: gasOut,
        })
        if (finErr) {
          const already = finErr.message.includes('TRANSFER_NOT_PENDING')
          return json(
            { ok: false, error: already ? 'not_pending' : `finalize_failed: ${finErr.message}` },
            already ? 409 : 500,
          )
        }
        if (!gasOut.ok) return json({ ok: false, error: gasOut.error ?? 'gas_failed' }, 400)
        return json({ ok: true, resumed: true, points: await currentPoints(), ep_balance: Number(gasOut.ep_balance) })
      }

      // 入金の再開: 冪等キー付きで deduct した転送のみ対象。
      // （旧形式・補償失敗後の行は真値が不明なため手動対応 → docs/ops の手順書参照）
      const meta = (t.gas_result ?? {}) as Record<string, unknown>
      if (!meta.deduct_idempotent) return json({ ok: false, error: 'resume_unsupported' }, 409)
      let gasIn
      try {
        gasIn = await callGas(t.salon_group, {
          action: 'deduct_ep', loginId: t.salon_login_id, amount: tEp, group: tGasGroup,
          memo: `MIRAIX入金 transfer:${t.id}`,
          idempotencyKey: `deduct-${t.id}`,
        })
      } catch {
        return json({ ok: false, error: 'gas_unreachable_pending' }, 502)
      }
      if (!gasIn.ok) {
        // 冪等キー照合を通った上でのエラー＝未減算が確定しているので failed（EP未変動）にできる
        await admin.from('ep_transfers')
          .update({ status: 'failed', gas_result: { ...meta, deduct: gasIn } }).eq('id', t.id)
        return json({ ok: false, error: gasIn.error ?? 'gas_failed', ep_balance: gasIn.ep_balance }, 400)
      }
      const { error: rpcErr } = await admin.rpc('ep_complete_deposit', { p_transfer: t.id, p_gas: gasIn })
      if (rpcErr) {
        if (rpcErr.message.includes('TRANSFER_NOT_PENDING')) {
          return json({ ok: false, error: 'not_pending' }, 409)
        }
        // 補償（返却）。失敗時は真値不明になるため deduct_idempotent を外して以後の resume を禁止
        const revert = await callGas(t.salon_group, {
          action: 'add_ep', loginId: t.salon_login_id, amount: tEp, group: tGasGroup,
          idempotencyKey: `revert-${t.id}`,
        }).catch((e) => ({ ok: false, error: String(e) }))
        const reverted = !!revert?.ok
        await admin.from('ep_transfers')
          .update({ status: reverted ? 'reversed' : 'pending', gas_result: { deduct: gasIn, revert } })
          .eq('id', t.id)
        return json({
          ok: false,
          error: reverted ? `credit_failed: ${rpcErr.message}` : 'credit_failed_revert_failed',
        }, 500)
      }
      return json({ ok: true, resumed: true, points: await currentPoints(), ep_balance: Number(gasIn.ep_balance) })
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
          // deduct_ep を冪等キー付きで呼ぶ印。pending滞留時に direction:'resume' で安全に再実行できる
          gas_result: { deduct_idempotent: true },
        })
        .select('id').single()
      if (insErr) return json({ ok: false, error: `insert_failed: ${insErr.message}` }, 500)

      let gas
      try {
        gas = await callGas(profile.salon_group, {
          action: 'deduct_ep',
          loginId: profile.salon_login_id,
          amount: ep,
          group: gasGroup,
          memo: `MIRAIX入金 transfer:${row.id}`,
          idempotencyKey: `deduct-${row.id}`, // GAS側が対応していれば再送時の二重減算を防ぐ
        })
      } catch (e) {
        // 応答喪失: GAS側で減算されたか不明。failed（=EP未変動）と断定せず pending のまま記録
        // （deduct_idempotent を保持: 冪等キー照合により 'resume' で安全に再実行できる）
        await admin.from('ep_transfers')
          .update({ gas_result: { deduct_idempotent: true, error: String(e), unreachable: true } })
          .eq('id', row.id)
        return json({ ok: false, error: 'gas_unreachable_pending' }, 502)
      }
      if (!gas.ok) {
        await admin.from('ep_transfers').update({ status: 'failed', gas_result: gas }).eq('id', row.id)
        return json({ ok: false, error: gas.error ?? 'gas_failed', ep_balance: gas.ep_balance }, 400)
      }
      const { error: rpcErr } = await admin.rpc('ep_complete_deposit', { p_transfer: row.id, p_gas: gas })
      if (rpcErr) {
        // 補償: GASは減算済みなので add_ep で戻す。返却の成否を確認し、
        // 失敗時は pending のまま残して「返却済み」と偽らない（要手動対応として台帳に記録）。
        const revert = await callGas(profile.salon_group, {
          action: 'add_ep',
          loginId: profile.salon_login_id, amount: ep, group: gasGroup,
          idempotencyKey: `revert-${row.id}`,
        }).catch((e) => ({ ok: false, error: String(e) }))
        const reverted = !!revert?.ok
        await admin.from('ep_transfers')
          .update({ status: reverted ? 'reversed' : 'pending', gas_result: { deduct: gas, revert } })
          .eq('id', row.id)
        return json({
          ok: false,
          error: reverted ? `credit_failed: ${rpcErr.message}` : 'credit_failed_revert_failed',
        }, 500)
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
        : beginErr.message.includes('DAILY_LIMIT') ? 'DAILY_LIMIT'
        : beginErr.message.includes('REGION_BLOCKED') ? 'REGION_BLOCKED'
        : beginErr.message.includes('duplicate key') ? 'duplicate'
        : beginErr.message
      return json({ ok: false, error: msg }, 400)
    }
    let gas
    try {
      gas = await callGas(profile.salon_group, {
        action: 'add_ep',
        loginId: profile.salon_login_id,
        amount: ep,
        group: gasGroup,
        idempotencyKey: String(tid),
      })
    } catch (e) {
      // 応答喪失: GAS側で加算されたか不明。ここで failed 確定（=返金）すると
      // 実際は加算済みだった場合に二重付与になるため、pending のまま記録して手動確認に委ねる
      await admin.from('ep_transfers')
        .update({ gas_result: { error: String(e), unreachable: true } }).eq('id', tid)
      return json({ ok: false, error: 'gas_unreachable_pending' }, 502)
    }
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
