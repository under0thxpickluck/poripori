// miraix-sso — サロン発行の署名トークンを検証し、MIRAIXアカウントを作成/リンクして
// マジックリンクの token_hash を返す（クライアントは verifyOtp でセッション確立）。
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifySsoToken, salonGroupFromGas } from '../_shared/token.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// サロン会員に email が無い場合の合成メール（Supabase auth の識別子として使うだけで送信しない）
function syntheticEmail(salonGroup: string, loginId: string): string {
  const safe = loginId.toLowerCase().replace(/[^a-z0-9._-]/g, '_')
  return `sso.${salonGroup}.${safe}@salon-member.miraix.local`
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token) return json({ ok: false, error: 'token_required' }, 400)

    const secret = Deno.env.get('MIRAIX_SSO_SECRET')
    if (!secret) return json({ ok: false, error: 'env_missing' }, 500)

    let payload
    try {
      payload = await verifySsoToken(secret, String(token))
    } catch (e) {
      return json({ ok: false, error: String((e as Error).message) }, 401)
    }

    const salonGroup = salonGroupFromGas(payload.gasGroup)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 既存プロフィールを (salon_group, salon_login_id) で検索
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('salon_group', salonGroup)
      .eq('salon_login_id', payload.loginId)
      .maybeSingle()

    let userId = existing?.id as string | undefined
    let email = ''
    let grantedBonus = 0 // 新規作成時のみ >0（期間限定の新規登録特典）

    if (userId) {
      const { data: u, error } = await admin.auth.admin.getUserById(userId)
      if (error || !u.user.email) return json({ ok: false, error: 'user_lookup_failed' }, 500)
      email = u.user.email
    } else {
      email = payload.email || syntheticEmail(salonGroup, payload.loginId)
      let createdNew = false
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: payload.loginId },
      })
      if (cErr) {
        // 同じ email の既存 auth ユーザー（過去にメールで登録済み等）→ そのユーザーにリンク
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const hit = list?.users.find((u) => u.email === email)
        if (!hit) return json({ ok: false, error: `create_user_failed: ${cErr.message}` }, 500)
        userId = hit.id
      } else {
        userId = created.user.id
        createdNew = true
      }
      // handle_new_user トリガが profiles を作るので、連携列をリンク。
      // 新規SSOアカウントの初期残高は「期間限定の新規登録特典」として付与する。
      // 金額は MIRAIX_WELCOME_BONUS_MR（未設定なら1000）。キャンペーン終了時は 0 を設定。
      const welcomeBonus = Math.max(0, Number(Deno.env.get('MIRAIX_WELCOME_BONUS_MR') ?? '1000') || 0)
      const patch: Record<string, unknown> = {
        salon_group: salonGroup,
        salon_login_id: payload.loginId,
        ...(createdNew ? { points: welcomeBonus } : {}),
      }
      const { error: linkErr } = await admin.from('profiles').update(patch).eq('id', userId)
      if (linkErr) return json({ ok: false, error: `link_failed: ${linkErr.message}` }, 500)
      if (createdNew) grantedBonus = welcomeBonus
    }

    // マジックリンクの token_hash を発行（メール送信はしない）
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (lErr || !link.properties?.hashed_token) {
      return json({ ok: false, error: `generate_link_failed: ${lErr?.message}` }, 500)
    }
    return json({ ok: true, token_hash: link.properties.hashed_token, email, welcome_bonus: grantedBonus })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
