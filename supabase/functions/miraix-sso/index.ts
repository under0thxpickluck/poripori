// miraix-sso — サロン発行の署名トークンを検証し、MIRAIXアカウントを作成/リンクして
// マジックリンクの token_hash を返す（クライアントは verifyOtp でセッション確立）。
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifySsoToken, salonGroupFromPayload } from '../_shared/token.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// サロン会員に email が無い場合の合成メール（Supabase auth の識別子として使うだけで送信しない）。
// 小文字化・記号正規化で別会員が同じメールに潰れないよう、元のloginIdのハッシュを含める
// （"Tanaka"/"tanaka" や "a#b"/"a_b" が同一会員扱いになり残高が混ざる事故の防止）。
async function syntheticEmail(salonGroup: string, loginId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(loginId))
  const hash = Array.from(new Uint8Array(digest).slice(0, 5))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  const safe = loginId.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 24)
  return `sso.${salonGroup}.${safe}.${hash}@salon-member.miraix.local`
}

// email から既存 auth ユーザーを検索（listUsers は1ページ最大1000件なのでページングする）
async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>, email: string,
): Promise<{ id: string } | undefined> {
  for (let page = 1; page <= 20; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    const hit = list?.users.find((u) => u.email === email)
    if (hit) return hit
    if (!list || list.users.length < 1000) return undefined
  }
  return undefined
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

    // 発行元サロンと gasGroup の整合を検証（不整合＝混合の恐れがあるため拒否）
    let salonGroup: string
    try {
      salonGroup = salonGroupFromPayload(payload)
    } catch {
      return json({ ok: false, error: 'salon_mismatch' }, 403)
    }
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
      email = payload.email || (await syntheticEmail(salonGroup, payload.loginId))
      let createdNew = false
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: payload.loginId },
      })
      if (cErr) {
        // 同じ email の既存 auth ユーザー（過去にメールで登録済み等）→ そのユーザーにリンク
        const hit = await findAuthUserByEmail(admin, email)
        if (!hit) return json({ ok: false, error: `create_user_failed: ${cErr.message}` }, 500)
        // 既に別のサロン会員として連携済みのアカウントには上書きリンクしない（残高の混合防止）
        const { data: prev } = await admin
          .from('profiles').select('salon_group, salon_login_id').eq('id', hit.id).maybeSingle()
        if (
          prev?.salon_login_id &&
          (prev.salon_group !== salonGroup || prev.salon_login_id !== payload.loginId)
        ) {
          return json({ ok: false, error: 'already_linked_other' }, 409)
        }
        userId = hit.id
      } else {
        userId = created.user.id
        createdNew = true
      }
      // handle_new_user トリガが profiles を作るので、連携列をリンク。
      // 新規SSOアカウントの初期残高は「期間限定の新規登録特典」として付与する。
      // 金額は MIRAIX_WELCOME_BONUS_MR（未設定なら1000）。キャンペーン終了時は 0 を設定。
      // 特典分は bonus_locked でサロンEPへの出金を禁止（migrate-012。増えた分は出金可）。
      const welcomeBonus = Math.max(0, Number(Deno.env.get('MIRAIX_WELCOME_BONUS_MR') ?? '1000') || 0)
      const patch: Record<string, unknown> = {
        salon_group: salonGroup,
        salon_login_id: payload.loginId,
        ...(createdNew ? { points: welcomeBonus, bonus_locked: welcomeBonus } : {}),
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
