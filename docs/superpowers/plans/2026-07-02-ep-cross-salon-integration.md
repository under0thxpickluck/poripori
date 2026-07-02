# EPクロス連動（MIRAIX × LIFAIOV × aisalon）Phase 1 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サロン（LIFAIOV / aisalon）のEPをMIRAIXのpointsへ双方向転送し、SSO（署名トークン）で本人紐付けする。

**Architecture:** MIRAIX（Vite SPA）に Supabase Edge Functions を新設し、SSO検証・アカウント作成（service_role）・GAS呼び出し（adminKey）をそこに集約。サロン側は `/api/miraix/sso` でHMACトークンを発行し、LIFAI Arcade の免責ゲート経由で MIRAIX `/salon-link` へ遷移。GASは**サロンごとに別プロジェクト**であり、それぞれに `add_ep` を追加し `deduct_ep` に group 分岐を追加して個別にデプロイする。

**Tech Stack:** Supabase Edge Functions (Deno / Web Crypto), supabase-js v2, React Router, Next.js 14 (salons), Google Apps Script, vitest（poripori 既存）。

## Global Constraints

- **賭博語彙禁止**（MIRAIX既存仕様）: UI文言は「予測」「ポイント」を使う。「賭け」「賭博」「bet」「gamble」を出さない。
- **会員プール分離**: LIFAIOV（GAS group `"5000"`）と aisalon（GAS group `""`）は別グループ。混同禁止。DB上の `salon_group` は `"5000"` / `"aisalon"`（空文字は使わない）。
- **GASはサロンごとに別プロジェクト・別デプロイ**（ユーザー確認済み。LIFAIOVにはLIFAIOV専用のappliesスプレッドシートがある）。パッチは両プロジェクトへ**個別に**適用・デプロイする。2つの `gas/Code.gs` は約1,500行乖離しているため、**一方をもう一方へコピーしてはならない**。各リポジトリのコピーに同趣旨のパッチを個別に当てる。
- ⚠️ **ローカルの両 `.env.local` は GAS_WEBAPP_URL/GAS_API_KEY/GAS_ADMIN_KEY が同一値**になっており、どちらかが古いコピーの可能性が高い。**本番（Vercel）の環境変数を正**とし、Task 9 で各サロンの本番envから正しい値を取得して使う。値が本当に同一のままなら実装を止めてユーザーに確認する。
- **有効な doPost は最後の定義（LIFAIOV: 7672行付近）**。通常アクションは `handle_(key, body)` に入る。`handle_` の先頭で `key !== SECRET` ガード、admin系は `body.adminKey !== ADMIN_SECRET` ガード。
- **EP↔points レートは 1:1 固定**。Edge Function 内の定数 `EP_TO_POINTS_RATE = 1` に集約。
- **1回の転送上限 10,000 EP・下限 1 EP・整数のみ**（クローズドβの暫定値。日次上限は Phase 2）。
- **免責ゲート文言**（必須3点）: ①MIRAIXは外部サイト ②資金保証・返金等は一切不可（転送EP含む） ③LIFAI（LIFAIOV/aisalon）とは無関係の別サービスでLIFAIは責任を負わない。
- **アーケードカードは `NEXT_PUBLIC_MIRAIX_ENABLED=1` が無い限り「準備中」表示のまま**（現状の押せないカードを維持）。
- **adminKey / MIRAIX_SSO_SECRET / service_role はブラウザに出さない**。Edge Functions には `SUPABASE_SERVICE_ROLE_KEY` が**自動注入**されるため手動設定不要。
- SSOトークン有効期限 ≤ 5分、HMAC-SHA256、`exp` 必須。
- コミットは各リポジトリ（poripori / LIFAIOV / aisalon）で個別に行う。

---

### Task 1: MIRAIX DBマイグレーション（salon連携列 + ep_transfers + RPC）

**Files:**
- Create: `supabase/migrate-010-ep-transfers.sql`
- Modify: `supabase/README.md`（適用手順の追記、既存の migrate-009 の記載に倣う）

**Interfaces:**
- Produces（後続タスクが依存）:
  - `profiles.salon_group text` / `profiles.salon_login_id text`
  - `public.ep_transfers`（列は下記SQLの通り）
  - `ep_complete_deposit(p_transfer uuid, p_gas jsonb) returns void`
  - `ep_begin_withdraw(p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text) returns uuid`
  - `ep_finish_withdraw(p_transfer uuid, p_ok boolean, p_gas jsonb) returns void`
  - いずれも service_role 専用（anon/authenticated から execute 剥奪）

- [ ] **Step 1: SQLファイルを作成**

```sql
-- supabase/migrate-010-ep-transfers.sql
-- EPクロス連動 Phase 1（docs/superpowers/specs/2026-07-01-ep-cross-salon-integration-design.md）
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-009 と同じ運用）

-- 1) profiles にサロン連携列
alter table public.profiles
  add column if not exists salon_group    text,
  add column if not exists salon_login_id text;

create unique index if not exists profiles_salon_identity_uidx
  on public.profiles (salon_group, salon_login_id)
  where salon_login_id is not null;

-- 2) EP転送台帳
create table if not exists public.ep_transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  salon_group     text not null,
  salon_login_id  text not null,
  direction       text not null check (direction in ('in','out')),
  ep_amount       numeric not null check (ep_amount > 0),
  points_delta    numeric not null,
  idempotency_key text not null unique,
  status          text not null default 'pending'
                    check (status in ('pending','completed','failed','reversed')),
  gas_result      jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists ep_transfers_user_idx
  on public.ep_transfers(user_id, created_at desc);

alter table public.ep_transfers enable row level security;
drop policy if exists ep_transfers_select_own on public.ep_transfers;
create policy ep_transfers_select_own on public.ep_transfers
  for select using (auth.uid() = user_id);
-- insert/update/delete のポリシーは作らない（クライアント書き込み不可。service_role はRLSを通過する）

-- 3) 入金完了: GAS deduct_ep 成功後に points加算 + completed を原子的に行う
create or replace function public.ep_complete_deposit(p_transfer uuid, p_gas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.ep_transfers
   where id = p_transfer and status = 'pending' and direction = 'in'
   for update;
  if not found then raise exception 'TRANSFER_NOT_PENDING'; end if;
  update public.profiles set points = points + t.points_delta where id = t.user_id;
  update public.ep_transfers set status = 'completed', gas_result = p_gas where id = p_transfer;
end $$;

-- 4) 出金開始: points を先に減算して pending 行を作る（原子的）
create or replace function public.ep_begin_withdraw(
  p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_points numeric;
begin
  if p_ep <= 0 or p_points <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select points into v_points from public.profiles where id = p_user for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_points < p_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  update public.profiles set points = points - p_points where id = p_user;
  insert into public.ep_transfers
    (user_id, salon_group, salon_login_id, direction, ep_amount, points_delta, idempotency_key)
  values (p_user, p_group, p_login_id, 'out', p_ep, -p_points, p_key)
  returning id into v_id;
  return v_id;
end $$;

-- 5) 出金確定/失敗: 失敗時は points を戻す（原子的）
create or replace function public.ep_finish_withdraw(p_transfer uuid, p_ok boolean, p_gas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.ep_transfers
   where id = p_transfer and status = 'pending' and direction = 'out'
   for update;
  if not found then raise exception 'TRANSFER_NOT_PENDING'; end if;
  if p_ok then
    update public.ep_transfers set status = 'completed', gas_result = p_gas where id = p_transfer;
  else
    update public.profiles set points = points - t.points_delta where id = t.user_id; -- points_delta は負なので減算=返金
    update public.ep_transfers set status = 'failed', gas_result = p_gas where id = p_transfer;
  end if;
end $$;

-- 6) クライアントから実行不可にする（Edge Function の service_role のみが呼ぶ）
revoke execute on function public.ep_complete_deposit(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.ep_begin_withdraw(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;
revoke execute on function public.ep_finish_withdraw(uuid, boolean, jsonb) from public, anon, authenticated;
```

- [ ] **Step 2: README に適用手順を追記**

`supabase/README.md` の適用履歴の末尾（migrate-009 の記載の下）に追加:

```markdown
- `migrate-010-ep-transfers.sql` — EPクロス連動: profiles連携列 / ep_transfers / 転送RPC（Studio SQL Editorで手動適用）
```

- [ ] **Step 3: コミット（poripori）**

```powershell
git add supabase/migrate-010-ep-transfers.sql supabase/README.md
git commit -m "feat(db): migrate-010 EP転送台帳とsalon連携列・転送RPC"
```

※ Studio での実際の適用は Task 9（デプロイ手順）で行う。

---

### Task 2: Edge Functions 基盤（config + 共有モジュール + トークンのテスト）

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/functions/_shared/token.ts`（HMACトークン sign/verify、Web Crypto実装 — Deno/Node両対応）
- Create: `supabase/functions/_shared/gas.ts`（GAS呼び出しヘルパ + groupマッピング）
- Create: `supabase/functions/_shared/cors.ts`
- Test: `src/lib/ssoToken.test.ts`（vitest。`_shared/token.ts` を相対importして往復テスト）

**Interfaces:**
- Produces:
  - `signSsoToken(secret: string, payload: SsoPayload): Promise<string>`
  - `verifySsoToken(secret: string, token: string, nowMs?: number): Promise<SsoPayload>`（不正/期限切れは throw）
  - `type SsoPayload = { gasGroup: "" | "5000"; loginId: string; email?: string; iat: number; exp: number }`
  - `salonGroupFromGas(g: string): string`（`"5000"→"5000"`, その他→`"aisalon"`）
  - `gasGroupFromSalon(g: string): string`（`"aisalon"→""`, その他はそのまま）
  - `callGas(salonGroup: string, body: Record<string, unknown>): Promise<any>`（salon_group でサロン別のGAS接続情報を選択してPOST。adminKey も該当サロンのものを自動付与）
  - `corsHeaders: Record<string, string>` と `handleOptions(req)`

- [ ] **Step 1: 失敗するテストを書く（`src/lib/ssoToken.test.ts`）**

```ts
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

  it('groupマッピングが往復する', () => {
    expect(salonGroupFromGas('5000')).toBe('5000')
    expect(salonGroupFromGas('')).toBe('aisalon')
    expect(gasGroupFromSalon('5000')).toBe('5000')
    expect(gasGroupFromSalon('aisalon')).toBe('')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/ssoToken.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: `supabase/functions/_shared/token.ts` を実装**

```ts
// HMAC-SHA256 署名付きSSOトークン。Web Crypto のみ使用（Deno / Node 18+ / vitest で同一動作）。
export type SsoPayload = {
  gasGroup: '' | '5000'
  loginId: string
  email?: string
  iat: number
  exp: number
}

export function salonGroupFromGas(g: string): string {
  return g === '5000' ? '5000' : 'aisalon'
}
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
  const ok = await crypto.subtle.verify(
    'HMAC', await hmacKey(secret), b64urlDecode(sig), enc.encode(body),
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/ssoToken.test.ts`
Expected: PASS（4件）

- [ ] **Step 5: `_shared/gas.ts` と `_shared/cors.ts` を実装**

```ts
// supabase/functions/_shared/gas.ts
// GAS webapp への server-to-server 呼び出し。key はURLクエリ（GAS pickKey_ 仕様）。
// ⚠️ GASはサロンごとに別プロジェクト。salon_group("5000"=LIFAIOV / "aisalon") で接続情報を選ぶ。
// 絶対に片方のURLをもう片方の会員に使わないこと（会員プール分離の要）。
type GasEnv = { url: string; key: string; adminKey: string }

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
  const res = await fetch(`${env.url}${sep}key=${encodeURIComponent(env.key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, adminKey: env.adminKey }),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { ok: false, error: 'gas_not_json', raw: text.slice(0, 300) }
  }
}
```

```ts
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}
```

- [ ] **Step 6: `supabase/config.toml` を作成**

```toml
# Supabase CLI 設定（Edge Functions デプロイ用の最小構成）
# project_id は `npx supabase link --project-ref <ref>` 後に CLI が使う識別子。
# <ref> は VITE_SUPABASE_URL の https://<ref>.supabase.co 部分。
project_id = "poripori"

[functions.miraix-sso]
verify_jwt = false   # SSOはMIRAIXセッション取得前に呼ぶため

[functions.ep-transfer]
verify_jwt = true    # MIRAIXログイン済みユーザーのみ
```

- [ ] **Step 7: 全テスト実行 + コミット（poripori）**

Run: `npx vitest run`
Expected: 既存テスト含め PASS

```powershell
git add supabase/config.toml supabase/functions/_shared src/lib/ssoToken.test.ts
git commit -m "feat(edge): Edge Functions基盤（SSOトークン/GASヘルパ/CORS）+ トークンテスト"
```

---

### Task 3: Edge Function `miraix-sso`（トークン検証→アカウント作成/リンク→セッション発行）

**Files:**
- Create: `supabase/functions/miraix-sso/index.ts`

**Interfaces:**
- Consumes: Task 2 の `verifySsoToken` / `salonGroupFromGas` / `corsHeaders`。Task 1 の `profiles.salon_group / salon_login_id`。
- Produces: `POST { token } → { ok:true, token_hash:string, email:string }`（クライアントは `supabase.auth.verifyOtp({ type:'email', token_hash, email })` でセッション確立）／失敗時 `{ ok:false, error }`。

- [ ] **Step 1: 実装**

```ts
// supabase/functions/miraix-sso/index.ts
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

    if (userId) {
      const { data: u, error } = await admin.auth.admin.getUserById(userId)
      if (error || !u.user.email) return json({ ok: false, error: 'user_lookup_failed' }, 500)
      email = u.user.email
    } else {
      email = payload.email || syntheticEmail(salonGroup, payload.loginId)
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
      }
      // handle_new_user トリガが profiles を作るので、連携列をリンク
      const { error: linkErr } = await admin
        .from('profiles')
        .update({ salon_group: salonGroup, salon_login_id: payload.loginId })
        .eq('id', userId)
      if (linkErr) return json({ ok: false, error: `link_failed: ${linkErr.message}` }, 500)
    }

    // マジックリンクの token_hash を発行（メール送信はしない）
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (lErr || !link.properties?.hashed_token) {
      return json({ ok: false, error: `generate_link_failed: ${lErr?.message}` }, 500)
    }
    return json({ ok: true, token_hash: link.properties.hashed_token, email })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
```

- [ ] **Step 2: 構文チェック**

Run: `npx supabase functions deploy miraix-sso --dry-run 2>$null` が使えない環境では、デプロイは Task 9 で実施。ここでは `npx tsc --noEmit` が Deno 構文を対象外とするため、目視レビュー＋Task 9 のE2Eで検証する。

- [ ] **Step 3: コミット（poripori）**

```powershell
git add supabase/functions/miraix-sso
git commit -m "feat(edge): miraix-sso — SSOトークン検証とアカウント作成/リンク・セッション発行"
```

---

### Task 4: Edge Function `ep-transfer`（入金/出金）

**Files:**
- Create: `supabase/functions/ep-transfer/index.ts`

**Interfaces:**
- Consumes: Task 1 のRPC3種、Task 2 の `callGas` / `gasGroupFromSalon` / `corsHeaders`。
- Produces: `POST { direction:'in'|'out', amount:number, idempotencyKey:string }`（要 Authorization: Bearer <MIRAIXユーザーJWT>）→ `{ ok:true, points:number, ep_balance:number }` ／ `{ ok:false, error }`。
  - `error` 値: `not_linked` / `invalid_amount` / `insufficient_ep` / `INSUFFICIENT_POINTS` / `duplicate` ほかGASエラーの中継。

- [ ] **Step 1: 実装**

```ts
// supabase/functions/ep-transfer/index.ts
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
    const ep = Number(amount)
    if (direction !== 'in' && direction !== 'out') return json({ ok: false, error: 'bad_direction' }, 400)
    if (!Number.isInteger(ep) || ep < MIN_EP || ep > MAX_EP) return json({ ok: false, error: 'invalid_amount' }, 400)
    if (!idempotencyKey || typeof idempotencyKey !== 'string') return json({ ok: false, error: 'idempotency_key_required' }, 400)

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
    const points = ep * EP_TO_POINTS_RATE

    if (direction === 'in') {
      // 冪等: 既存キーがあれば現在状態を返して終了
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
      return json({ ok: true, points: Number(profile.points) + points, ep_balance: Number(gas.ep_balance) })
    }

    // direction === 'out'（出金: points先減算 → GAS add_ep → 確定/返金）
    const { data: tid, error: beginErr } = await admin.rpc('ep_begin_withdraw', {
      p_user: uid, p_ep: ep, p_points: points, p_key: idempotencyKey,
      p_group: profile.salon_group, p_login_id: profile.salon_login_id,
    })
    if (beginErr) {
      const msg = beginErr.message.includes('INSUFFICIENT_POINTS') ? 'INSUFFICIENT_POINTS'
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
    return json({ ok: true, points: Number(profile.points) - points, ep_balance: Number(gas.ep_balance) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
```

- [ ] **Step 2: コミット（poripori）**

```powershell
git add supabase/functions/ep-transfer
git commit -m "feat(edge): ep-transfer — EP入金/出金（冪等・補償トランザクション付き）"
```

---

### Task 5: GASパッチ（`deduct_ep` group対応 + `add_ep` 新設）— 両リポジトリの Code.gs

**Files:**
- Modify: `C:\Users\unite\LIFAIOV\gas\Code.gs`（`deduct_ep` は 2457行付近）
- Modify: `C:\Users\unite\aisalon\gas\Code.gs`（`deduct_ep` は 2347行付近）
- ⚠️ **別GASプロジェクト×2**。2つの Code.gs は大きく乖離しているため、**ファイルごとコピーせず**、各コピーの `deduct_ep` ブロックに同趣旨のパッチを個別に当てる。デプロイも各プロジェクトで個別（Task 9）。

**Interfaces:**
- Consumes: 既存 `getAppliesSheet5000_()` / `appendWalletLedger_()` / `indexMap_()` / `ensureCols_()` / `str_()` / `json_()`。
- Produces:
  - `deduct_ep` 入力に `group`（`""`＝aisalon / `"5000"`＝LIFAIOV）と `memo`（任意）を追加。**group未指定の既存呼び出し（narasu等）は挙動不変。**
  - 新アクション `add_ep`: 入力 `{ action:"add_ep", adminKey, loginId, amount, group, idempotencyKey }` → `{ ok:true, ep_balance, duplicated? }` / `{ ok:false, error }`。

- [ ] **Step 1: `deduct_ep` に group 分岐と memo を追加**

`if (action === "deduct_ep") {` ブロック内で、`let values = sheet.getDataRange()...` より前に対象シート解決を挿入し、ブロック内の `sheet` 参照をすべて `targetSheet_dep` に置換する（square_grant_bp と同じパターン）:

```js
  if (action === "deduct_ep") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);
    // ✅ group ルーティング（"5000"=LIFAIOV / それ以外=デフォルト applies）既存呼び出しは group 無しで挙動不変
    const group_dep = str_(body.group);
    const targetSheet_dep = group_dep === "5000" ? getAppliesSheet5000_() : sheet;
    const memo_dep = str_(body.memo) || "narasu代理申請EPポイント払い";

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!Number.isFinite(amount) || amount <= 0) return json_({ ok: false, error: "invalid_amount" });

    let values = targetSheet_dep.getDataRange().getValues();
    let header = values[0];

    ensureCols_(targetSheet_dep, header, ["login_id", "email", "ep_balance"]);

    values = targetSheet_dep.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentEp = Number(targetSheet_dep.getRange(hitRowIndex, idx["ep_balance"] + 1).getValue() || 0);

    if (currentEp < amount) {
      return json_({ ok: false, error: "insufficient_ep", ep_balance: currentEp });
    }

    const newEp = currentEp - amount;
    targetSheet_dep.getRange(hitRowIndex, idx["ep_balance"] + 1).setValue(newEp);

    appendWalletLedger_({
      kind:     "deduct_ep",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     memo_dep,
    });

    return json_({ ok: true, ep_balance: newEp });
  }
```

- [ ] **Step 2: `add_ep` を `deduct_ep` ブロックの直後に追加**

```js
  // =========================================================
  // add_ep（EP加算：MIRAIXからの戻し・補償）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - group:"5000" は applies_5000（LIFAIOV）、それ以外はデフォルト applies（aisalon）
  // - idempotencyKey: wallet_ledger の memo "MIRAIX:<key>" で二重加算防止
  // =========================================================
  if (action === "add_ep") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId_add = str_(body.loginId);
    const amount_add  = Number(body.amount);
    const key_add     = str_(body.idempotencyKey);
    const group_add   = str_(body.group);
    const targetSheet_add = group_add === "5000" ? getAppliesSheet5000_() : sheet;

    if (!loginId_add) return json_({ ok: false, error: "loginId_required" });
    if (!Number.isFinite(amount_add) || amount_add <= 0) return json_({ ok: false, error: "invalid_amount" });
    if (!key_add) return json_({ ok: false, error: "idempotencyKey_required" });

    // 冪等チェック: wallet_ledger（デフォルトSSに一元記録）の memo を走査
    const ledgerMemo = "MIRAIX:" + key_add;
    const led_add = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("wallet_ledger");
    if (led_add) {
      const lv = led_add.getDataRange().getValues();
      const lidx = indexMap_(lv[0]);
      for (let i = 1; i < lv.length; i++) {
        if (str_(lv[i][lidx["kind"]]) === "add_ep" && str_(lv[i][lidx["memo"]]) === ledgerMemo) {
          // 既に加算済み → 現残高を返す（再加算しない）
          const vals_dup = targetSheet_add.getDataRange().getValues();
          const didx = indexMap_(vals_dup[0]);
          for (let j = 1; j < vals_dup.length; j++) {
            if (str_(vals_dup[j][didx["login_id"]]) === loginId_add) {
              return json_({ ok: true, duplicated: true, ep_balance: Number(vals_dup[j][didx["ep_balance"]] || 0) });
            }
          }
          return json_({ ok: true, duplicated: true });
        }
      }
    }

    let values_add = targetSheet_add.getDataRange().getValues();
    let header_add = values_add[0];

    ensureCols_(targetSheet_add, header_add, ["login_id", "email", "ep_balance"]);

    values_add = targetSheet_add.getDataRange().getValues();
    header_add = values_add[0];

    const idx_add  = indexMap_(header_add);
    const rows_add = values_add.slice(1);

    let hitRowIndex_add = 0;
    let hitEmail_add    = "";

    for (let i = 0; i < rows_add.length; i++) {
      if (str_(rows_add[i][idx_add["login_id"]]) === loginId_add) {
        hitRowIndex_add = i + 2;
        hitEmail_add    = str_(rows_add[i][idx_add["email"]]);
        break;
      }
    }

    if (!hitRowIndex_add) return json_({ ok: false, error: "not_found" });

    const currentEp_add = Number(targetSheet_add.getRange(hitRowIndex_add, idx_add["ep_balance"] + 1).getValue() || 0);
    const newEp_add = currentEp_add + amount_add;
    targetSheet_add.getRange(hitRowIndex_add, idx_add["ep_balance"] + 1).setValue(newEp_add);

    appendWalletLedger_({
      kind:     "add_ep",
      login_id: loginId_add,
      email:    hitEmail_add,
      amount:   amount_add,
      memo:     ledgerMemo,
    });

    return json_({ ok: true, ep_balance: newEp_add });
  }
```

- [ ] **Step 3: 同趣旨のパッチを aisalon 側 `gas/Code.gs`（2347行付近）にも適用**

同じ内容（`deduct_ep` の group/memo 対応 + `add_ep` 追加）を aisalon リポジトリのコピーへ**個別に**適用する。適用前に aisalon 側 `deduct_ep` ブロックの現物を読み、周辺ヘルパ（`getAppliesSheet5000_` / `appendWalletLedger_` / `ensureCols_` 等）が同名で存在することを確認してから当てる（両ファイルは約1,500行乖離しているため、行番号やブロック内容をLIFAIOV側と同一とは仮定しない）。

- [ ] **Step 4: コミット（LIFAIOV / aisalon 各リポジトリ）**

```powershell
# LIFAIOV
git add gas/Code.gs
git commit -m "feat(gas): deduct_ep の group ルーティング対応 + add_ep 新設（MIRAIX EP連動）"
# aisalon でも同じコミット
```

※ 実際のGASエディタへの反映（手動コピペ + 新バージョンデプロイ）は Task 9 で**両プロジェクトそれぞれ**行う。デプロイ前に、各GASエディタ上の現行コードと対応するリポジトリの Code.gs が一致しているか必ず目視確認する。

---

### Task 6: サロン側 `/api/miraix/sso` 発行ルート + トークン署名ヘルパ（両リポジトリ）

**Files:**
- Create: `C:\Users\unite\LIFAIOV\app\lib\miraixSso.ts` と `C:\Users\unite\aisalon\app\lib\miraixSso.ts`（同一内容）
- Create: `C:\Users\unite\LIFAIOV\app\api\miraix\sso\route.ts` と `C:\Users\unite\aisalon\app\api\miraix\sso\route.ts`（同一内容）

**Interfaces:**
- Consumes: GAS `login` アクション（`{action:"login", id, code, group}` → `{ok, group, login_id}`、Task外・既存）。Task 2 のトークン形式（署名互換）。
- Produces: `POST /api/miraix/sso { id, code, group? }`（`group` はクライアントの `getAuth()?.group`。GAS login の会員検索ルーティングに必要。トークンに載せる group は**GAS応答**を正とする）→ `{ ok:true, url:string }`（`url` = `MIRAIX_APP_URL/salon-link?sso=<token>`）／ `{ ok:false, error }`。
- 必要env（両サロン .env.local に追加）: `MIRAIX_SSO_SECRET`（Edge Functionsと同値）、`MIRAIX_APP_URL`（例 `https://miraix.example.app`）。

- [ ] **Step 1: `app/lib/miraixSso.ts`（署名のみ・Node/Web Crypto）**

```ts
// app/lib/miraixSso.ts — MIRAIX SSOトークン署名（poripori 側 verifySsoToken と形式互換）
export type SsoPayload = {
  gasGroup: '' | '5000'
  loginId: string
  email?: string
  iat: number
  exp: number
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export async function signSsoToken(secret: string, payload: SsoPayload): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}
```

- [ ] **Step 2: `app/api/miraix/sso/route.ts`**

```ts
// app/api/miraix/sso/route.ts — GAS login で本人確認してから短命SSOトークンを発行
import { NextResponse } from "next/server";
import { signSsoToken } from "@/app/lib/miraixSso";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, code, group } = await req.json().catch(() => ({}));
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const secret = process.env.MIRAIX_SSO_SECRET;
    const miraixUrl = process.env.MIRAIX_APP_URL;
    if (!gasUrl || !gasKey || !secret || !miraixUrl) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }
    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "id/code required" }, { status: 400 });
    }

    // GAS login で本人確認（クライアント申告の loginId を信用しない）
    const sep = gasUrl.includes("?") ? "&" : "?";
    const r = await fetch(`${gasUrl}${sep}key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "login", id, code, group: String(group || "") }),
    });
    const login = await r.json().catch(() => null);
    if (!login?.ok) {
      return NextResponse.json({ ok: false, error: "login_failed" }, { status: 401 });
    }

    // group は GAS 応答を正とする（"5000" | ""）
    const gasGroup: "" | "5000" = String(login.group || "") === "5000" ? "5000" : "";
    const now = Math.floor(Date.now() / 1000);
    const token = await signSsoToken(secret, {
      gasGroup,
      loginId: String(login.login_id || id),
      iat: now,
      exp: now + 300, // 5分
    });

    return NextResponse.json(
      { ok: true, url: `${miraixUrl.replace(/\/$/, "")}/salon-link?sso=${encodeURIComponent(token)}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: 型チェック（両リポジトリ）**

Run: `Set-Location C:\Users\unite\LIFAIOV; npx tsc --noEmit`（aisalon も同様）
Expected: exit 0

- [ ] **Step 4: `.env.local` に追記（両サロン・値は Task 9 で設定）**

```
MIRAIX_SSO_SECRET=<Task 9 で生成した値>
MIRAIX_APP_URL=<MIRAIXの本番URL>
NEXT_PUBLIC_MIRAIX_ENABLED=0
```

- [ ] **Step 5: コミット（両リポジトリ）**

```powershell
git add app/lib/miraixSso.ts app/api/miraix/sso/route.ts
git commit -m "feat(miraix): SSO発行ルート /api/miraix/sso（GAS loginで本人確認・HMACトークン）"
```

---

### Task 7: サロン側アーケードカード有効化 + 免責ゲート（両リポジトリ）

**Files:**
- Create: `app/mini-games/MiraixCard.tsx`（両リポジトリ同一）
- Modify: `app/mini-games/page.tsx`（既存の準備中カードdivを `<MiraixCard th={th} />` に置換。両リポジトリ）

**Interfaces:**
- Consumes: Task 6 の `POST /api/miraix/sso`。既存 `getAuth()` / `getAuthSecret()`（`app/lib/auth.ts`）。
- Produces: `NEXT_PUBLIC_MIRAIX_ENABLED !== "1"` のとき現行同等の「準備中」カード。`"1"` のとき免責ゲートモーダル→同意→SSO遷移。

- [ ] **Step 1: `MiraixCard.tsx` を実装**

```tsx
"use client";
import { useState } from "react";
import { getAuth, getAuthSecret } from "../lib/auth";

type Th = { card: string; cardHover: string; muted: string; badge: string };

const ENABLED = process.env.NEXT_PUBLIC_MIRAIX_ENABLED === "1";

export function MiraixCard({ th }: { th: Th }) {
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ENABLED) {
    return (
      <div aria-disabled="true" className={`${th.card} rounded-2xl p-6 block opacity-50 cursor-not-allowed select-none`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔮</span>
            <div>
              <h2 className="font-bold">MIRAIX</h2>
              <p className={`${th.muted} text-xs`}>EPで遊べる予測ゲーム（外部サイト）</p>
            </div>
          </div>
          <span className={`${th.muted} text-xs px-3 py-1 rounded-full border border-current`}>準備中</span>
        </div>
      </div>
    );
  }

  const go = async () => {
    setErr(null);
    setLoading(true);
    try {
      const auth = getAuth();
      const code = getAuthSecret();
      if (!auth?.id || !code) {
        setErr("セッションの有効期限が切れています。一度ログインし直してください。");
        return;
      }
      const res = await fetch("/api/miraix/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auth.id, code, group: auth.group ?? "" }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok || !res.url) {
        setErr("接続に失敗しました。しばらく待ってから再度お試しください。");
        return;
      }
      window.location.href = res.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setAgreed(false); setErr(null); setOpen(true); }}
        className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block w-full text-left`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔮</span>
            <div>
              <h2 className="font-bold">MIRAIX</h2>
              <p className={`${th.muted} text-xs`}>EPで遊べる予測ゲーム（外部サイト）</p>
            </div>
          </div>
          <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`${th.card} rounded-2xl p-6 max-w-md w-full`}>
            <h3 className="font-bold text-lg mb-3">外部サイトへ移動します</h3>
            <ul className={`${th.muted} text-sm space-y-2 mb-4 list-disc pl-5`}>
              <li>MIRAIX は<strong>外部サイト</strong>です。</li>
              <li>転送したEPを含め、<strong>資金保証・返金等の保証は一切できません</strong>。</li>
              <li>MIRAIX は <strong>LIFAI（LIFAIOV / aisalon）とは関係のない別サービス</strong>であり、LIFAI はその運営・内容について責任を負いません。</li>
            </ul>
            <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              上記を理解し、同意します
            </label>
            {err && <p className="text-red-500 text-xs mb-3">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)}
                className={`flex-1 rounded-xl border border-current py-2 text-sm ${th.muted}`}>
                キャンセル
              </button>
              <button type="button" disabled={!agreed || loading} onClick={go}
                className={`flex-1 rounded-xl py-2 text-sm ${th.badge} disabled:opacity-40`}>
                {loading ? "接続中..." : "同意して移動"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: `page.tsx` の準備中カードdivを差し替え**

`app/mini-games/page.tsx` の `{/* MIRAIX（外部サイト・準備中） */}` から始まる `<div aria-disabled ...>...</div>` ブロック全体を削除し、次に置換:

```tsx
        {/* MIRAIX（外部サイト） */}
        <MiraixCard th={th} />
```

ファイル先頭に import を追加: `import { MiraixCard } from "./MiraixCard";`

- [ ] **Step 3: 型チェック（両リポジトリ）**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: 表示確認**

Run: `npm run dev` → `http://localhost:3000/mini-games`
Expected: `NEXT_PUBLIC_MIRAIX_ENABLED` 未設定なので「準備中」カード（現行と同じ見た目・押せない）。`.env.local` に `NEXT_PUBLIC_MIRAIX_ENABLED=1` を一時設定して再起動すると PLAY カード→クリックで免責モーダル→チェックなしでは「同意して移動」が無効。確認後 `0` に戻す。

- [ ] **Step 5: コミット（両リポジトリ）**

```powershell
git add app/mini-games/MiraixCard.tsx app/mini-games/page.tsx
git commit -m "feat(miraix): LIFAI ArcadeのMIRAIXカードに免責ゲート（envフラグで準備中/有効を切替）"
```

---

### Task 8: MIRAIX フロントエンド（/salon-link 受け口 + /wallet ページ）

**Files:**
- Create: `src/pages/SalonLink.tsx`
- Create: `src/pages/Wallet.tsx`
- Modify: `src/App.tsx`（ルート2本追加）
- Modify: `src/store/useAuth.ts`（`Profile` 型に `salon_group` / `salon_login_id` を追加）
- Modify: `src/components/Navbar.tsx`（連携済みユーザーに「EPウォレット」リンク。既存リンク群の並びに1項目追加）

**Interfaces:**
- Consumes: Task 3 `miraix-sso`（`{token}` → `{token_hash, email}`）、Task 4 `ep-transfer`、Task 1 `ep_transfers`（RLSでselect可）。
- Produces: ルート `/salon-link`（`?sso=` 処理）と `/wallet`。

- [ ] **Step 1: `useAuth.ts` の Profile 型に連携列を追加**

```ts
export type Profile = {
  id: string
  name: string
  points: number
  xp: number
  role: 'user' | 'admin'
  last_bonus: string | null
  bonus_streak: number
  created_at: string
  salon_group: string | null
  salon_login_id: string | null
}
```

- [ ] **Step 2: `src/pages/SalonLink.tsx` を実装**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

// サロン（LIFAIOV / aisalon）からのSSO受け口。?sso=<token> を検証してセッションを確立する。
export default function SalonLink() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loadProfile = useAuth((s) => s.loadProfile)
  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState('サロンアカウントを確認しています…')

  useEffect(() => {
    const token = params.get('sso')
    if (!token) {
      setStatus('error')
      setMessage('連携トークンがありません。サロンのアーケードからやり直してください。')
      return
    }
    ;(async () => {
      const { data, error } = await supabase.functions.invoke('miraix-sso', { body: { token } })
      if (error || !data?.ok) {
        setStatus('error')
        setMessage('連携に失敗しました。トークンの有効期限（5分）が切れている場合は、サロンからやり直してください。')
        return
      }
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: data.token_hash,
        email: data.email,
      })
      if (vErr) {
        setStatus('error')
        setMessage(`サインインに失敗しました: ${vErr.message}`)
        return
      }
      await loadProfile()
      navigate('/wallet', { replace: true })
    })()
  }, [params, navigate, loadProfile])

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      {status === 'working' && (
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      )}
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
```

- [ ] **Step 3: `src/pages/Wallet.tsx` を実装**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

type Transfer = {
  id: string
  direction: 'in' | 'out'
  ep_amount: number
  points_delta: number
  status: string
  created_at: string
}

const LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE === '1'
const GROUP_LABEL: Record<string, string> = { '5000': 'LIFAIOV', aisalon: 'aisalon' }

// EPウォレット: サロンEP⇄MIRAIXポイントの転送と履歴
export default function Wallet() {
  const { profile, loadProfile } = useAuth()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [history, setHistory] = useState<Transfer[]>([])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('ep_transfers')
      .select('id, direction, ep_amount, points_delta, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data as Transfer[]) ?? [])
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (LOCAL_MODE) return <p className="py-24 text-center text-sm text-muted">ローカルモードではEPウォレットは利用できません。</p>
  if (!profile) return <p className="py-24 text-center text-sm text-muted">サインインしてください。</p>
  if (!profile.salon_login_id) {
    return (
      <p className="py-24 text-center text-sm text-muted">
        サロン連携がありません。LIFAIOV / aisalon の LIFAI Arcade から「MIRAIX」を開いてください。
      </p>
    )
  }

  const transfer = async (direction: 'in' | 'out') => {
    setMsg(null)
    const ep = Number(amount)
    if (!Number.isInteger(ep) || ep < 1 || ep > 10000) {
      setMsg('1〜10,000 の整数で入力してください。')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('ep-transfer', {
        body: { direction, amount: ep, idempotencyKey: crypto.randomUUID() },
      })
      if (error || !data?.ok) {
        const code = data?.error ?? error?.message ?? 'unknown'
        setMsg(
          code === 'insufficient_ep' ? 'サロンのEP残高が不足しています。'
          : code === 'INSUFFICIENT_POINTS' ? 'MIRAIXのポイントが不足しています。'
          : `転送に失敗しました（${code}）。`,
        )
        return
      }
      setMsg(direction === 'in'
        ? `入金しました。EP残高: ${data.ep_balance}`
        : `サロンへ戻しました。EP残高: ${data.ep_balance}`)
      setAmount('')
      await Promise.all([loadProfile(), loadHistory()])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold">EPウォレット</h1>
        <p className="text-sm text-muted">
          連携元: {GROUP_LABEL[profile.salon_group ?? ''] ?? profile.salon_group}（{profile.salon_login_id}）
        </p>
        <p className="text-sm">現在のポイント: <strong>{Math.floor(profile.points).toLocaleString()}</strong></p>
      </div>

      <div className="space-y-3">
        <input
          type="number" min={1} max={10000} step={1} value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="EP数量（1〜10,000）"
          className="w-full rounded-xl border border-border bg-transparent px-4 py-2 text-sm"
        />
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => transfer('in')}
            className="flex-1 rounded-xl bg-accent text-white py-2 text-sm disabled:opacity-40">
            サロンEP → MIRAIX
          </button>
          <button disabled={busy} onClick={() => transfer('out')}
            className="flex-1 rounded-xl border border-border py-2 text-sm disabled:opacity-40">
            MIRAIX → サロンEP
          </button>
        </div>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </div>

      <div>
        <h2 className="font-bold text-sm mb-2">履歴</h2>
        <ul className="space-y-1 text-xs text-muted">
          {history.map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>{new Date(t.created_at).toLocaleString('ja-JP')} {t.direction === 'in' ? '入金' : '出金'} {t.ep_amount}EP</span>
              <span>{t.status}</span>
            </li>
          ))}
          {history.length === 0 && <li>まだ履歴がありません。</li>}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `App.tsx` にルート追加**

lazy import群に追加:

```tsx
const SalonLink = lazy(() => import('./pages/SalonLink'))
const Wallet = lazy(() => import('./pages/Wallet'))
```

`<Route path="/ranking" ...>` の下に追加:

```tsx
          <Route path="/salon-link" element={<L><SalonLink /></L>} />
          <Route path="/wallet" element={<L><Wallet /></L>} />
```

- [ ] **Step 5: Navbar に条件付きリンク追加**

`src/components/Navbar.tsx` で `useAuth` から `profile` を取得している箇所（無ければ追加）で、既存ナビリンク群の並びに:

```tsx
{profile?.salon_login_id && (
  <NavLink to="/wallet" className={/* 既存リンクと同じclass関数 */}>EPウォレット</NavLink>
)}
```

※ Navbar の既存実装のリンクのマークアップ（NavLink か Link か、className の形）に**そのまま合わせる**こと。

- [ ] **Step 6: 検証**

Run: `npx vitest run` → PASS、`npx tsc --noEmit`（poripori は `tsc -b` 相当が `npm run build` に含まれる場合は `npm run build`）→ exit 0
Expected: 型エラーなし。`npm run dev` で `/wallet` が「サロン連携がありません」表示（未連携ユーザー）。

- [ ] **Step 7: コミット（poripori）**

```powershell
git add src/pages/SalonLink.tsx src/pages/Wallet.tsx src/App.tsx src/store/useAuth.ts src/components/Navbar.tsx
git commit -m "feat(ui): /salon-link SSO受け口と /wallet EPウォレット（入出金・履歴）"
```

---

### Task 9: デプロイと E2E 検証（手動ステップ含む）

**Files:** なし（運用手順）。ユーザー操作が必要な箇所は【手動】と明記。

- [ ] **Step 1: マイグレーション適用【手動】**

Supabase Studio → SQL Editor に `supabase/migrate-010-ep-transfers.sql` を貼り付けて Run（migrate-009 と同じ運用）。
確認: `select column_name from information_schema.columns where table_name='ep_transfers';` が全列を返す。

- [ ] **Step 2: Supabase CLI ログインとリンク【手動（ブラウザ認証）】**

```powershell
npx supabase login          # ブラウザが開く（! npx supabase login をユーザーが実行）
npx supabase link --project-ref <VITE_SUPABASE_URL の <ref> 部分>
```

- [ ] **Step 3: シークレット生成と設定**

まず【手動】各サロンの**本番（Vercel）環境変数**から GAS_WEBAPP_URL / GAS_API_KEY / GAS_ADMIN_KEY の正しい値を取得する（Vercelダッシュボード → 各プロジェクト → Settings → Environment Variables。ローカル `.env.local` は両サロンで同一値になっており信用しない）。**両サロンのURLが本当に同一だった場合は実装を中断してユーザーに確認する。**

```powershell
# MIRAIX_SSO_SECRET を生成（例）
$secret = -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
npx supabase secrets set MIRAIX_SSO_SECRET=$secret `
  GAS_URL_LIFAIOV=<LIFAIOV本番のGAS_WEBAPP_URL> GAS_KEY_LIFAIOV=<同GAS_API_KEY> GAS_ADMIN_KEY_LIFAIOV=<同GAS_ADMIN_KEY> `
  GAS_URL_AISALON=<aisalon本番のGAS_WEBAPP_URL> GAS_KEY_AISALON=<同GAS_API_KEY> GAS_ADMIN_KEY_AISALON=<同GAS_ADMIN_KEY>
```

同じ `$secret` を両サロンの env（Vercel本番 + `.env.local`）の `MIRAIX_SSO_SECRET` に設定。`MIRAIX_APP_URL` にMIRAIX本番URLを設定。

- [ ] **Step 4: Edge Functions デプロイ**

```powershell
npx supabase functions deploy miraix-sso
npx supabase functions deploy ep-transfer
```

Expected: 両方 deployed。`SUPABASE_SERVICE_ROLE_KEY` は自動注入のため設定不要。

- [ ] **Step 5: GAS 反映【手動・両プロジェクト個別】**

LIFAIOV用GASプロジェクトと aisalon用GASプロジェクトの**それぞれ**で:
1. GASエディタを開き、**現行コードと対応リポジトリの Code.gs の一致を確認**（不一致ならデプロイ実体を正としてパッチを再適用）。
2. Task 5 のパッチ済み Code.gs（そのサロンのもの）を貼り付け。
3. デプロイ → デプロイを管理 → 編集 → 新バージョン（**URLを変えない**こと）。

- [ ] **Step 6: GAS 単体テスト（curl / PowerShell）**

```powershell
# add_ep（テスト会員IDで1EP加算→同キー再送で duplicated:true を確認）
$body = @{ action="add_ep"; adminKey="<GAS_ADMIN_KEY>"; loginId="<テスト会員ID>"; amount=1; group=""; idempotencyKey="manual-test-1" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "<GAS_WEBAPP_URL>?key=<GAS_API_KEY>" -ContentType "application/json" -Body $body
```

Expected: 1回目 `ok:true, ep_balance:+1`。2回目 `ok:true, duplicated:true`（残高不変）。**このテストを両GASプロジェクト（LIFAIOV側・aisalon側の各URL）でそれぞれ実施**。LIFAIOV側はテスト会員の group（"5000"）を付けて確認。

- [ ] **Step 7: サロンデプロイ + E2E【手動】**

1. 両サロンをデプロイ（env追加を反映）。検証環境でのみ `NEXT_PUBLIC_MIRAIX_ENABLED=1`。
2. E2E: サロンにログイン → Arcade → MIRAIXカード → 免責ゲート同意 → MIRAIX `/salon-link` → `/wallet` に到達し連携元が表示される。
3. 入金1EP → サロンEPが1減り、MIRAIX points が1増える。出金1EP → 逆方向。`ep_transfers` に completed 2行。
4. LIFAIOV会員と aisalon会員それぞれで確認（**別アカウントとして作られる**こと = profiles に2行、salon_group が別値）。
5. 全確認後、本番の `NEXT_PUBLIC_MIRAIX_ENABLED` は**ユーザーの公開判断があるまで 0 のまま**。

- [ ] **Step 8: 仕様書の§11更新（poripori）**

`docs/superpowers/specs/2026-07-01-ep-cross-salon-integration-design.md` §11 に解決済みマークを追記（1: Edge Functionsで解決 / 3: 実装は `salon_group="aisalon"` へ正規化で解決 / 4: 1:1確定 / 5: 1回上限10,000EPで暫定確定）。コミット:

```powershell
git add docs/superpowers/specs/2026-07-01-ep-cross-salon-integration-design.md
git commit -m "docs(spec): EPクロス連動 §11 解決状況を反映"
```

---

## 補足（実装時の前提）

1. **GASはサロンごとに別プロジェクト・別デプロイ**（ユーザー確認済み・仕様書§7の通り）: LIFAIOVにはLIFAIOV専用のappliesがある。会員プールと同様、GAS接続情報も**絶対に混同しない**。Edge Functions のシークレットは `GAS_URL_LIFAIOV/GAS_KEY_LIFAIOV/GAS_ADMIN_KEY_LIFAIOV` と `GAS_URL_AISALON/GAS_KEY_AISALON/GAS_ADMIN_KEY_AISALON` の2セットに分離し、`salon_group` で選択する。
   - ⚠️ ローカルの両 `.env.local` は現在同一値（どちらかが古いコピーとみられる）。**本番（Vercel）envを正**とし、同一のままなら中断してユーザー確認。
2. **既存 `deduct_ep` は group 分岐なし**（常にデフォルト applies シート）: `get_balance` 等は group="5000" で `getAppliesSheet5000_()` に振り分けており（LIFAIOV Code.gs 1911行付近）、EP残高が applies_5000 にある会員に対しては Task 5 の group 対応が必須。
3. **`wallet_ledger` は各GASプロジェクトの自スプレッドシートに記録**（既存挙動）: add_ep の冪等チェックは各プロジェクト内の台帳の memo `MIRAIX:<key>` で行う（プロジェクト間で共有しない）。
4. **Edge Functions には `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` が自動注入**される: service_role キーを手元にコピーする必要はない（ローカル実行時のみ必要）。
5. **サロンのセッション**: loginId は localStorage `addval_auth_v1`、code は sessionStorage（`getAuthSecret()`）。SSO発行は id+code を GAS `login` で再検証してから行う（クライアント申告の loginId を信用しない）。code が消えている（ブラウザ再起動後）場合は再ログインを促す。
