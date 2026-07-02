# MIRAIX × LIFAIOV × aisalon — EPクロス連動 設計仕様書

**作成日:** 2026-07-01
**対象:** MIRAIX（`poripori`）／ LIFAIOV ／ aisalon
**目的:** LIFAIOV・aisalon 各サロンの **EP** を MIRAIX へ転送し、MIRAIX 内の賭け（LMSR売買）に使えるようにする。転送は**双方向**（MIRAIX→サロンへ戻せる）。

---

## 1. 前提（確認済みの事実）

| 項目 | MIRAIX (`poripori`) | LIFAIOV | aisalon |
|---|---|---|---|
| スタック | Vite+React+**Supabase** | Next.js 14 + **GAS/Sheets** | 同左 |
| 認証 | **Supabase Auth（OTP / emailマジックリンク, パスワード無し）** | GAS `login`(id+code, HMAC) | 同左 |
| 内部通貨 | `profiles.points`（初期1000, LMSR売買で消費） | EP残高 `ep_balance` | EP残高 `ep_balance` |
| 会員管理 | Supabase `profiles`（`auth.users`と1:1） | Google Sheets（group="5000"固定） | Google Sheets（**groupはGASが返す動的値**） |

**重要な制約（実コード検証済み）:**
- LIFAIOV と aisalon は**別々のGASプロジェクト・別デプロイ・別スプレッドシート**（2026-07-02 ユーザー確認により訂正。LIFAIOVはLIFAIOV専用applies）。加えて `group` パラメータによるシート振り分けが各プロジェクト内に存在する。会員プールもGAS接続情報も決して統合しない。
  - ⚠️ ローカルの両 `.env.local` の `GAS_WEBAPP_URL` は現在同一値だが古いコピーとみられる。**本番（Vercel）envが正**。実装時に要確認。
- **`group` の出所:** LIFAIOV/5000 はクライアントが `group:"5000"` を固定送信。**aisalon 本会員ログイン（`app/login/page.tsx`）は group を送らず、GAS の `login` 応答 `res.group` を採用**し、以後 auth state に保持する。→ SSO ではこの**セッションが保持する group をそのままトークンに載せる**（固定定数を仮定しない）。
- 賭けの仕組み（LMSR: YES/NO シェアの売買・解決精算）は MIRAIX に**RPCとして実装済み**（`buy_shares` が `points - cost`、`INSUFFICIENT_POINTS` ガード付き。`sell_shares`／解決で points 還元）。**points 加算RPC `admin_add_points` も既存**＝EP入金時のクレジットに流用できる。
- サロン側の EP 出金プリミティブ `deduct_ep`（adminKey認証・残高チェック・`wallet_ledger`記録・**`email` 列も保持**・新残高返却）は**既存**。参考実装 `ep_send_to_lfw`（EP外部送金）は **LIFAIOV のみ**・id+code認証で外部アドレス宛のため厳密な雛形ではない。**入金の実質雛形は `deduct_ep`。**
- サロン側に EP **加算**アクションは**両GASとも存在しない**（検証: count 0）→ 双方向（戻し）のため新規 `add_ep` 作成が必要。
- **MIRAIX はブラウザのみ（Vite SPA, `vercel.json` は全リクエスト→index.html）でサーバー実行基盤が無い。** クライアントは anon key + RLS + SECURITY DEFINER RPC で Supabase を直接叩く。→ **adminKey / service_role / SSO検証を扱うサーバーが新規に必須**（§4・§11参照）。

---

## 2. 確定した設計方針（ユーザー合意事項）

1. **アカウント隔離（1人1アカウント）:** MIRAIX の1アカウント = サロン会員1人 = `(group, loginId)` 1組に固定。LIFAIOV会員と aisalon会員は別アカウントとして隔離され、残高は混ざらない。ただし**同じマーケットで一緒に賭けられる**。
2. **EPは単一残高:** アカウント内では EP の出所を区別せず、MIRAIX の `points` として一本化する（同一アカウントは元々1グループ由来なので混在は起きない）。
3. **双方向:** MIRAIX→サロンへEPを戻せる。サロン⇄MIRAIX の**閉ループ内ポイント**として扱う。
4. **本人紐付け:** 署名トークンSSO方式（安全かつ既存HMAC流儀で実装容易）。
5. **サロン側の導線は LIFAI Arcade に置く（2026-07-02 追加合意）:** MIRAIX への入口は両サロンの LIFAI Arcade（`app/mini-games/page.tsx`）にゲームカードとして追加する。
6. **免責ゲート必須（2026-07-02 追加合意）:** MIRAIX は外部サイトであるため、SSO遷移の**前に**免責ゲート（確認モーダル/中間ページ）を必ず挟む。文言に以下を含め、ユーザーが同意操作をしない限り遷移させない:
   - MIRAIX は**外部サイト**であること。
   - **資金保証・返金等の保証は一切できない**こと（転送したEPを含む）。
   - MIRAIX は **LIFAI（LIFAIOV / aisalon）とは関係のない別サービス**であり、LIFAI はその運営・内容に責任を負わないこと。

---

## 3. アーキテクチャ

```
[サロン (LIFAIOV / aisalon) : Next.js]
  ログイン済み (group, loginId)
      │  ①署名トークン発行 (HMAC, 短命)
      ▼
[MIRAIX : Vite+Supabase]
  ②トークン検証 → profiles を (group,loginId) で特定/リンク
      │
  ③EP転送(入): サロン deduct_ep ──▶ MIRAIX points 加算 ──▶ 既存LMSRで賭け
  ④EP転送(戻): MIRAIX points 減算 ──▶ サロン add_ep(新規)
```

MIRAIX 側の EP 転送処理は、Supabase Edge Function（または MIRAIX が持つ薄いサーバー）から GAS を **adminKey 付きサーバー間通信**で呼ぶ。ブラウザから直接 GAS を叩かない（adminKey を露出させない）。

---

## 4. 本人紐付け（署名トークンSSO）

### トークン発行（サロン側 Next.js 新規ルート `/api/miraix/sso`）
- 入力: ログイン済みセッションの `loginId`、その環境の `group`。
- 生成: `payload = { group, loginId, iat, exp(≤5分) }`、`sig = HMAC-SHA256(MIRAIX_SSO_SECRET, base64url(payload))`。
- 出力: `token = base64url(payload) + "." + sig`。MIRAIX へ `?sso=token` で遷移させる。

- トークンには `group`（LIFAIOV=固定"5000"／aisalon=セッションの `res.group`）と `loginId` を載せる。任意で `email`（サロン `applies` 由来）も含めるとアカウント作成が容易。

### トークン検証 + アカウント作成/リンク（MIRAIX 側サーバー、要 service_role）
> **前提: MIRAIX にサーバーが無いため、ここで新規サーバー（Supabase Edge Function 推奨）を導入する。** 検証・アカウント作成には Supabase **service_role key** が必須（ブラウザ anon key では auth ユーザーを作れない）。

- `MIRAIX_SSO_SECRET`（サロンと共有）で `sig` 検証、`exp` 確認。
- `(salon_group, salon_login_id)` で既存 `profiles` を検索。
  - 有り → その `auth.users` のセッションを発行（`admin.generateLink` / `admin.createSession` 相当）。
  - 無し → **service_role で `auth.users` を作成**（識別子は salon の `email`、無ければ合成メール `{group}-{loginId}@salon.miraix.local`）→ トリガ `handle_new_user` が `profiles` 自動生成 → その行に `salon_group/salon_login_id` を UPDATE でリンク。
- MIRAIX セッション確立。

### 秘密情報（すべて新規サーバーの env に集約）
- `MIRAIX_SSO_SECRET`（サロン env + MIRAIXサーバー env）。
- `SUPABASE_SERVICE_ROLE_KEY`（アカウント作成/リンク・points 加算に必要）。
- `GAS_ADMIN_KEY`（EP 転送 GAS 呼び出し。呼び出し時に `group` を渡す）。
- いずれもブラウザに露出させない。

---

## 5. Supabase スキーマ変更（MIRAIX）

### 5.1 `profiles` にサロン連携列を追加
```sql
alter table public.profiles
  add column if not exists salon_group    text,   -- 例: "5000" (LIFAIOV) / aisalonのgroup値
  add column if not exists salon_login_id text;

-- 1人1アカウント（隔離）を DB レベルで保証
create unique index if not exists profiles_salon_identity_uidx
  on public.profiles (salon_group, salon_login_id)
  where salon_login_id is not null;
```

### 5.2 EP転送台帳（監査＋冪等性）
```sql
create table if not exists public.ep_transfers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  salon_group    text not null,
  salon_login_id text not null,
  direction      text not null check (direction in ('in','out')),  -- in: サロン→MIRAIX, out: MIRAIX→サロン
  ep_amount      numeric not null check (ep_amount > 0),
  points_delta   numeric not null,          -- MIRAIX points への増減
  idempotency_key text not null,            -- 二重送信防止
  status         text not null default 'pending'
                   check (status in ('pending','completed','failed','reversed')),
  gas_result     jsonb,
  created_at     timestamptz not null default now(),
  unique (idempotency_key)
);
```

### 5.3 EP↔points 換算
- **既定 1 EP = 1 point**（実装をシンプルに）。将来変える場合に備え、換算レートは MIRAIX 側の設定値 `EP_TO_POINTS_RATE`（既定1）で1箇所に集約する。

---

## 6. 転送フロー詳細

### 6.1 転送(入): サロン → MIRAIX
MIRAIX サーバー関数 `POST /ep/deposit`（要 MIRAIX セッション）:
1. `ep_transfers` に `pending` 行を作成（`idempotency_key` 重複なら既存結果を返す＝冪等）。
2. GAS `deduct_ep`（`adminKey`, `loginId`, `amount`, `group`）を呼ぶ。
3. `ok:true` → MIRAIX の points を加算（既存 `admin_add_points` RPC を service_role で呼ぶ or 専用RPCを新設し `ep_transfers` 更新と原子化）、行を `completed` に。
   `ok:false`（`insufficient_ep`等）→ 行を `failed` に、points は不変。
4. GAS 成功後に MIRAIX 更新が失敗した場合の補償として、失敗検知時は `add_ep`（§7）でロールバックする（`reversed`）。

### 6.2 転送(戻): MIRAIX → サロン
MIRAIX サーバー関数 `POST /ep/withdraw`（要 MIRAIX セッション）:
1. `profiles.points >= amount*rate` を確認し、**先に points を減算**（`pending`）。
2. GAS `add_ep`（新規, §7）を呼ぶ。成功→`completed`。失敗→points を戻して `failed`。

**原則:** 「送金元を先に減算 → 送金先を加算」。失敗時は必ず送金元へ戻す補償を持つ。冪等キーで再試行安全に。

---

## 7. 新規 GAS アクション `add_ep`（両グループの `Code.gs`）

`deduct_ep` と対称。`LIFAIOV/gas/Code.gs` と `aisalon/gas/Code.gs` の**両方**に追加（別スプレッドシートなので個別に反映）。

```js
// add_ep（EP加算：MIRAIXからの返金・報酬還元）
// - adminKey 認証必須
// - loginId でユーザー特定し ep_balance を加算
// - wallet_ledger に記録（kind:"add_ep", amount:+amount）
// - idempotencyKey を受け取り、wallet_ledger 既存なら二重加算しない
```
入力: `{ action:"add_ep", adminKey, loginId, amount, idempotencyKey, group }`
出力: `{ ok:true, ep_balance }` / `{ ok:false, error }`

---

## 8. UI（MIRAIX / サロン）

- **サロン側:** LIFAI Arcade（`app/mini-games/page.tsx`）に「MIRAIX」カードを追加（SSO発行→遷移）。クリック時にまず**免責ゲート**（§2-6: 外部サイト・資金保証不可・LIFAIとは無関係）を表示し、同意後にのみ SSO 遷移する。マイページに現在のEP残高（既存 `get_balance`）。
  - **現況（2026-07-02）:** 両サロンに「準備中」バッジ付きの**押せないカード**を先行設置済み（`aria-disabled` + `opacity-50`、Link無し）。Phase 1 完成時に免責ゲート付きの有効カードへ差し替える。
- **MIRAIX側:**
  - EP入金/出金モーダル（金額入力→§6実行、履歴は `ep_transfers`）。
  - ヘッダーに現在の `points`（=賭け原資）。
  - 出所グループ表示（`salon_group`）。

---

## 9. セキュリティ / 整合性チェックリスト

- adminKey はサーバー側のみ。ブラウザから GAS を直接呼ばない。
- SSO トークンは短命（≤5分）・1回想定・HMAC 検証・`exp` 必須。
- `ep_transfers.idempotency_key` で二重送信を防止。
- 送金は「元を先に減算→先を加算→失敗時補償」。部分失敗を `pending/failed/reversed` で追跡。
- `(salon_group, salon_login_id)` 一意制約でアカウント隔離を DB 保証。
- 数値は `numeric`、負残高不可（`points >= 0` を更新時にチェック）。

---

## 10. スコープ

### やること（Phase 1）
- **MIRAIX サーバー基盤の新設（前提作業）:** Supabase Edge Functions 等。service_role / GAS adminKey / SSO secret を保持。
- MIRAIX: profiles 連携列 + `ep_transfers` + SSO検証/アカウント作成 + `/ep/deposit` `/ep/withdraw`。
- サロン(両方): `/api/miraix/sso` 発行ルート + `add_ep` GAS アクション + LIFAI Arcade への MIRAIX 導線（免責ゲート付き, §2-6）。
- EP↔points 1:1、入出金モーダル、履歴表示。

### やらないこと（Phase 2以降）
- レート変動・手数料・EPの自動同期（残高ミラーリング）。
- 複数グループ横断の統合ダッシュボード。
- サロン間でのアカウント統合（明示的に非対応＝隔離維持）。

---

## 11. 未確定 / 実装前に確認すべき点

1. 🔴 **【最重要・土台】MIRAIX のサーバー実行環境を新設する必要がある。** 現状 MIRAIX はフロントのみ（Vite SPA）。SSO検証・アカウント作成（service_role）・GAS adminKey 呼び出しは**必ずサーバーが要る**。候補: Supabase Edge Functions（推奨・追加インフラ最小）／ 別途 API サーバー。これが決まらないと他が着手できない。
2. **アカウント識別子:** サロン `applies` の `email` を Supabase auth ユーザーの識別に使えるか（会員全員に email があるか）。無い場合は合成メール方式。
3. **aisalon の group 値の扱い:** 固定でなく GAS 応答由来のため、`(salon_group, salon_login_id)` が全会員で一意になるか（空 group や重複 loginId の可能性）を GAS 側データで確認。
4. **EP↔points レート**（既定1:1で良いか）。
5. **転送の最小/最大額・1日上限**を設けるか。
