# EPクロス連動 運用手順書（pending滞留の解決 / ADMIN_SECRETローテーション）

対象: MIRAIX（poripori）× LIFAIOV × aisalon の EP転送基盤。
設計は `docs/superpowers/specs/2026-07-01-ep-cross-salon-integration-design.md` を参照。

⚠️ **大原則: 2つのサロンを絶対に混合しない。** 本書の手順は必ず「どちらのサロンに対する作業か」を
宣言してから、そのサロンの GAS / Vercel / スプレッドシートだけを触ること。
- LIFAIOV = `salon_group "5000"` = Supabase secrets `GAS_*_LIFAIOV` = LIFAIOVのGASプロジェクト
- aisalon = `salon_group "aisalon"` = Supabase secrets `GAS_*_AISALON` = aisalonのGASプロジェクト

---

## 1. pending滞留の解決

`ep_transfers.status = 'pending'` のまま止まる原因は「GAS応答喪失（タイムアウト等）」か
「Edge Function の途中死」。**GAS側が冪等キーで保護されているため、ほとんどは安全に再実行できる。**

### 1-1. まずはユーザー自身の「再開」ボタン（推奨）

`/wallet` の転送履歴で「処理中」の行に**「再開」ボタン**が表示される（本人のみ実行可）。
これは `ep-transfer` の `direction:'resume'` を呼び、次の動作をする:

- **出金(out)**: GAS `add_ep` を元の冪等キー（=転送ID）で再送。
  実行済みなら `duplicated:true` が返るだけ（二重付与なし）→ `completed` に確定。
  GASがエラーを返せば `failed` に確定し、MRは自動返金される。
- **入金(in)**: GAS `deduct_ep` を元の冪等キー（`deduct-<転送ID>`）で再送（二重減算なし）
  → 成功で MR 付与して `completed`。GASが `insufficient_ep` 等を返せば `failed`（EP未変動が確定）。
- 対象外のとき `resume_unsupported`（409）が返る:
  - 冪等キー導入(2026-07-04)前に作られた入金行
  - 補償（EP返却）まで失敗した行（`gas_result.revert` が失敗記録）
  → これらだけ下の 1-2 手動手順で解決する。

### 1-2. 手動解決（運営）

**滞留の一覧**（Supabase Studio → SQL Editor。postgres として実行されるので RPC の ACL 制限は受けない）:

```sql
select id, direction, ep_amount, salon_group, salon_login_id, gas_result, created_at
  from public.ep_transfers
 where status = 'pending' and created_at < now() - interval '10 minutes'
 order by created_at;
```

**真値の確認**は、その行の `salon_group` に対応するサロンの**スプレッドシートだけ**を開いて行う:
- `miraix_idempotency` シート: key 列に
  入金= `deduct-<転送ID>` / 出金= `<転送ID>` / 返却= `revert-<転送ID>` があるか
- `wallet_ledger` シート: memo 列の `MIRAIX入金 transfer:<転送ID>` / `MIRAIX:<転送ID>` 行

| 状況 | 確定方法（SQL Editor） |
|---|---|
| 入金: EP減算済み・MR未付与 | `select public.ep_complete_deposit('<転送ID>'::uuid, '{"manual":true}'::jsonb);` → MR付与+completed |
| 入金: EP未減算 | `update public.ep_transfers set status='failed' where id='<転送ID>' and status='pending';` |
| 入金: EP減算済みだが中止したい | 該当サロンGASの `add_ep` を `idempotencyKey: "revert-<転送ID>"` で呼びEP返却後、status を `reversed` に更新 |
| 出金: EP加算済み（keyあり） | `select public.ep_finish_withdraw('<転送ID>'::uuid, true, '{"manual":true}'::jsonb);` → completed |
| 出金: EP未加算 | UIの「再開」を使う（冪等で安全）。使えない場合のみ `select public.ep_finish_withdraw('<転送ID>'::uuid, false, '{"manual":true}'::jsonb);` → MR返金+failed |

注意:
- `ep_finish_withdraw(..., false, ...)` は**MRを返金する**。GAS側でEPが加算済みなのに実行すると
  二重付与になる。必ず先に `miraix_idempotency` / `wallet_ledger` で未加算を確認すること。
- ごく稀に GAS が「残高更新後・冪等キー記録前」に死ぬと、再開で二重減算が起き得る。
  `wallet_ledger` に同じ transfer ID の行が2つないか確認し、あれば `add_ep`（`revert-<転送ID>`）で1回分返却する。

---

## 2. ADMIN_SECRET ローテーション

### 現状の問題（2026-07-04 監査時点）
- LIFAIOV: `ADMIN_SECRET` が5文字の弱い値
- aisalon: `ADMIN_SECRET` が `SECRET_KEY` と同値（16文字）

### ⚠️ 絶対に守ること
1. **`SECRET_KEY` は変更しない。** `SECRET_KEY` は会員パスワードのHMACハッシュ（`pw_hash`）の鍵。
   変更すると**全会員がログイン不能**になる。ローテーション対象は `ADMIN_SECRET` のみ。
2. **1サロンずつ**実施する。値・URL・プロパティ画面を取り違えないこと（両サロンは別GASプロジェクト）。
3. 新しい値は**サロンごとに別の値**にする（同値にしない）。

### 影響範囲（= 同期して更新が必要な場所）
`ADMIN_SECRET` を照合するGASアクション: `deduct_bp` / `deduct_ep` / `add_ep` / `cc_affiliate_*` / 管理系。
消費者は次の3か所:

| 場所 | 変数名 |
|---|---|
| 対象サロンの GAS Script Properties | `ADMIN_SECRET` |
| 対象サロンの Vercel env（+ ローカル `.env.local`） | `GAS_ADMIN_KEY` |
| poripori の Supabase secrets | `GAS_ADMIN_KEY_LIFAIOV` または `GAS_ADMIN_KEY_AISALON` |

### 手順（1サロン分。もう一方は別の新値で繰り返す）

1. **新しい値を生成**（32文字以上）:
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
   ```
2. **GAS**: 対象サロンの GASエディタ → プロジェクトの設定 → スクリプト プロパティ →
   `ADMIN_SECRET` を新値に更新（保存した瞬間から旧値は無効。3〜5が済むまで管理機能とEP転送が一時失敗する）。
3. **Supabase secrets**（poripori リポジトリで）:
   ```
   npx supabase secrets set GAS_ADMIN_KEY_LIFAIOV=<新値>   # LIFAIOVの場合
   npx supabase secrets set GAS_ADMIN_KEY_AISALON=<新値>   # aisalonの場合
   ```
   （Edge Functions は再デプロイ不要。数十秒で新値が反映される）
4. **Vercel**: 対象サロンのプロジェクト → Settings → Environment Variables →
   `GAS_ADMIN_KEY` を新値に更新 → **Redeploy**（envはビルド時に焼き込まれるため再デプロイ必須）。
5. **ローカル**: 対象サロンの `.env.local` の `GAS_ADMIN_KEY` を新値に更新。
6. **検証**（残高を一切変えずに認証だけ確認）: 実在しない loginId で `deduct_ep` を叩く。
   `{"ok":false,"error":"not_found"}` なら新キー有効。`admin_unauthorized` なら反映漏れ。
   ```powershell
   $body = '{"action":"deduct_ep","adminKey":"<新値>","loginId":"__rotation_test__","amount":1}'
   Invoke-RestMethod -Method Post -Uri "<GAS_WEBAPP_URL>?key=<GAS_API_KEY>" -ContentType "application/json" -Body $body
   ```
7. MIRAIXの `/wallet` で残高照会（direction:'balance' 相当の表示）が出ることを確認。

### ついでに推奨
- 両サロンの `.env.local` に残っている `MIRAIX_TEST_CODE`（adminのサロンパスワード）はテスト用。
  不要になり次第削除する。
