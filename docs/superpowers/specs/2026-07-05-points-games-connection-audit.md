# ポイント・ゲーム・接続 総合エラーチェック & 仕様書（SPEC / AUDIT）

- 日付: 2026-07-05
- 対象: EP/ポイント（転送・ロック・上限・居住ブロック）、ゲーム（Plinko / Mines）、接続（SSO / GAS中継 / Supabase・localClient）
- 種別: 監査（エラーチェック）＋現行仕様の確定記述
- 検証方法: サーバー権威SQL（migrate-010〜016）とEdge Function（ep-transfer / miraix-sso / _shared）の精読、クライアント連携部（useStore / Wallet / SalonLink / Plinko / Mines / localClient）の確認、`npm run build`（tsc＋vite）、`npm test`（vitest）、REST/Function 実応答での本番デプロイ確認。

---

## 0. 検証結果サマリ

| 項目 | 結果 |
|------|------|
| `npm run build`（tsc型チェック＋vite build） | ✅ PASS |
| `npm test`（vitest） | ✅ 11ファイル / 82テスト PASS |
| DBスキーマ（REST存在確認） | ✅ `ep_transfers` / `ep_config` / `profiles.{salon_login_id,bonus_locked,residency}` すべて存在 |
| Edge Function `ep-transfer` | ✅ ACTIVE / version 5（実応答 401 unauthorized = 稼働中） |
| Edge Function `miraix-sso` | ✅ ACTIVE / version 4 |
| **重大バグ（Critical）** | **0件** |
| Important（要対応・主に外部依存/堅牢性） | 3件（I-1解消／I-2解消／I-3=SQLテスト運用課題は継続） |
| Minor（軽微・整合性/UX） | 6件（M-1〜M-4解消／M-5・M-6は据え置き） |

総評: サーバー権威設計（残高・抽選・地雷位置はすべてサーバー側、クライアント書き込み不可、RPCはSECURITY DEFINER＋ACLでauthenticatedのみ）は一貫しており、金銭的損失に直結する重大欠陥は見つからなかった。残る指摘は主に「外部GASの冪等性依存」「タイムアウト等の堅牢性」「SQL本体の自動テスト不在」に集約される。

---

## 1. システム仕様（確定記述）

### 1.1 接続（連携）

**SSOハンドシェイク**（`SalonLink.tsx` → `miraix-sso` → `verifyOtp`）
- サロン（LIFAIOV / aisalon）が HMAC-SHA256 署名トークン（`_shared/token.ts`、payload=`{salon,gasGroup,loginId,email?,iat,exp}`、5分失効）を発行。
- `miraix-sso` が署名・失効を検証し、`salonGroupFromPayload` で `salon↔gasGroup` の整合をフェイルクローズ判定（`lifaiov↔5000` / `aisalon↔''` 以外は `salon_mismatch` で拒否）。
- `(salon_group, salon_login_id)` で既存プロフィール検索。無ければ auth ユーザー作成＋連携列セット。新規のみ特典 `MIRAIX_WELCOME_BONUS_MR`（既定1000MR）を `points` と `bonus_locked` に付与。
- クロスサロン上書き禁止（`already_linked_other` / 409）で残高混合を防止。

**GAS中継**（`_shared/gas.ts` `callGas`）
- サロンごとに別GASプロジェクト。`salon_group`→接尾辞（`LIFAIOV`/`AISALON`）で `GAS_URL_* / GAS_KEY_* / GAS_ADMIN_KEY_*` を選択。片方のURLを他方の会員に使うことは構造的に不可能。

**2サロン識別マッピング**

| | `salon` | `gasGroup` | DB `salon_group` | env接尾辞 |
|---|---|---|---|---|
| LIFAIOV | `lifaiov` | `5000` | `5000` | `_LIFAIOV` |
| aisalon | `aisalon` | `''` | `aisalon` | `_AISALON` |

### 1.2 ポイント / EP

**転送**（`ep-transfer` / migrate-010）
- `in`（サロンEP→MR）: 台帳pending挿入 → GAS `deduct_ep` → `ep_complete_deposit`（points加算＋completed、原子的）。失敗時は補償 `add_ep` で返却。
- `out`（MR→サロンEP）: `ep_begin_withdraw`（points先減算＋pending挿入、原子的） → GAS `add_ep` → `ep_finish_withdraw`（確定 or 返金）。
- `balance`: GAS `get_balance` 中継（変更なし）。
- `resume`: pending滞留の再開。冪等キー照合で二重処理を防ぐ設計。
- レート 1EP=1MR、金額 1〜10,000、`idempotency_key` UNIQUE。

**出金ガード**（`ep_begin_withdraw` 最終版 = migrate-016）順に:
1. `INVALID_AMOUNT`（≤0）
2. `REGION_BLOCKED`（residency='JP'）
3. `INSUFFICIENT_POINTS`（points < 要求）
4. `BONUS_LOCKED`（`points - bonus_locked < 要求`）— ロー・ウォーターマーク方式
5. `DAILY_LIMIT`（当日Asia/Tokyoのout合計＋今回 > `ep_config.daily_withdraw_ep`、既定1000）

**出金不可ロック `bonus_locked`**（migrate-012/013/016）
- 出金可能額 = `points - bonus_locked`。
- 加算源: 新規特典（012）、デイリーボーナス最大400/日（013）、ゲーム純増分 `greatest(payout-bet,0)`（016）。
- クランプトリガ（012）が `bonus_locked` を常に `0〜points` に収める（低水位追従・復活しない）。

### 1.3 ゲーム（サーバー権威）

**Plinko**（migrate-011 / 016）: `plinko_play` が検証→二項抽選（`random()<0.5` を段数回）→倍率参照→配当→残高更新→台帳、を1トランザクション。倍率は `plinko_config`。管理RPCがRTP 10〜150%を強制。
**Mines**（migrate-015 / 016）: 地雷位置は `mines_secrets`（RLS有効・ポリシー無し＝クライアント不可読）にのみ保持し、終局時に `mines_games.mines` へ公開。倍率式 `round(house_edge × Π(25−i)/(25−m−i), 4)`。house_edge は開始時に凍結。`mines_games_one_active_uidx` で同時1ゲーム保証。
- 両ゲームとも純増分を `bonus_locked` に加算（ゲームでは出金可能額を増やせない）。開始RPC（`mines_start`/`plinko_play`）は `REGION_BLOCKED` を課す。

### 1.4 居住ゲート

- クライアント: `ResidencyGate`（`Layout.tsx` で全画面マウント）が未申告・同意未取得を全画面遮断、JP申告は恒久遮断。
- サーバー: 価値移転系RPC（`mines_start` / `plinko_play` / `ep_begin_withdraw`）が `REGION_BLOCKED`。

---

## 2. 発見事項（Findings）

### Important

**I-1. 冪等性の外部GAS依存 → 解消済み（残り＝デプロイ鮮度の確認のみ）**
`ep-transfer/index.ts` は再送・resume 時の二重処理防止を GAS 側の `idempotencyKey` 対応に委ねている（`deduct-${id}` / `add_ep` の `idempotencyKey=String(id)`）。
- **確認結果（2026-07-05）**: `~/LIFAIOV/gas/Code.gs`・`~/aisalon/gas/Code.gs` の両方で `deduct_ep`/`add_ep` が冪等実装済みを確認。専用シート `miraix_idempotency`（key,ts,login_id,amount）で重複照合し、重複時は残高を触らず `{ok:true, duplicated:true, ep_balance}` を返す。`LockService`（20s）で同時実行の read-modify-write 競合も防止。`add_ep` はキー必須（`idempotencyKey_required`）。MIRAIX 側の期待応答形（`ok`/`ep_balance`/`error:insufficient_ep`）とも一致。
- **残タスク**: GAS は Apps Script 手動デプロイのため、この `Code.gs` が本番Webアプリに反映済みかの鮮度確認のみ。→ admin で 1EP 往復＋「再開」実行の実機テストで確定（冪等が効けば残高は二重にならない）。
- 軽微: 冪等シートの照合が線形走査のため、`miraix_idempotency` の長期肥大で遅延しうる（将来の定期アーカイブ推奨）。

**I-2. `callGas` に fetch タイムアウトが無い（`_shared/gas.ts:19`）**
GAS 応答が遅延/ハングした場合、`fetch` がプラットフォーム上限まで滞留し、Function がタイムアウト打ち切りになりうる。ep-transfer は throw を `gas_unreachable_pending` として扱い pending 記録＋resume で回収する設計なので致命ではないが、無タイムアウトは滞留pendingを増やす。
- 対応: `AbortController` で明示タイムアウト（例 20–30s）を付け、超過時は確実に throw させて pending 記録に落とす。

**I-3. SQL本体（RPC）の自動テストが存在しない**
`npm test`（82件）は `localClient.ts`（TypeScript再実装）に対するテストで、本番の PL/pgSQL 関数は直接テストされていない。localと本番SQLがドリフトすると、テスト緑でも本番だけ壊れうる。
- 対応: 主要RPC（`ep_begin_withdraw`/`plinko_play`/`mines_*`）を pgTAP か Supabase ローカル（`supabase db reset`＋SQLテスト）で最低限カバー。少なくとも localClient と SQL の差分レビューを運用に組み込む。

### Minor

**M-1. Plinko のベットに整数チェックが無い**（`migrate-016:154` / `migrate-011:60`）。`mines_start` は `p_bet <> trunc(p_bet)` を課すが `plinko_play` は `1〜10000` のみで小数ベットを許容。実害は小さいが両ゲームで不整合。→ Plinko にも `trunc` チェック追加を推奨。

**M-2. 入金（`in`）にサーバー側の居住(JP)ブロックが無い → 解消済み（2026-07-05）**（`ep-transfer/index.ts`）。profile選択に`residency`を追加し`regionBlocked = residency==='JP'`を算出、`direction==='in'`の先頭と入金resumeパスの双方で`REGION_BLOCKED`(400)を返すよう対称化。出金resume（`out`／既認可転送の回収）は滞留pendingを塞がないため意図的に通す。`out`/`mines`/`plinko`のサーバー`REGION_BLOCKED`と併せ、価値移転の入口が全てサーバー側でも遮断される多層防御になった。

**M-3. `mapRpcError` の未マップ時フォールスルー**（`useStore.ts:91`）。未知コードは生のPostgresメッセージをそのままUI表示。→ 既定文言に丸めるか、想定コードを網羅。

**M-4. 転送の二重送信防止がクライアント `busy` フラグのみに依存 → 解消済み（2026-07-05）**（`Wallet.tsx`）。`busy`(state)は再描画まで反映されず、反映前の高速二連打で`transfer()`/`resume()`が別`idempotencyKey`で二重に走り得た。同期的な`submittingRef`(useRef)で再入ガードを追加し、実行中は2回目の呼び出しを即return。キーは実試行ごとに新規のままなので、失敗後の正当な再送は従来どおり機能する。

**M-5. `findAuthUserByEmail` のページング上限**（`miraix-sso:29`、20×1000=2万件）。会員が2万を超えると既存メール検索が漏れ、`create_user_failed` になりうる。現状の規模では非問題だが将来の上限。

**M-6. CORS が `Access-Control-Allow-Origin: '*'`**（`_shared/cors.ts`）。Cookie非使用でJWT/署名で保護されるため許容範囲だが、SSO/転送エンドポイントを任意オリジンから叩ける。→ 必要なら許可オリジンを絞る。

---

## 3. 不変条件チェック表

| 不変条件 | 実装箇所 | 判定 |
|----------|----------|------|
| 残高・シェア・抽選・地雷位置はサーバーのみが書く | 各RPC SECURITY DEFINER＋RLSでクライアント書込不可 | ✅ |
| 価値移転RPCはauthenticatedのみ（anon/public不可） | 各migrateの revoke/grant | ✅ |
| 2サロンの会員プールを混ぜない | `gasEnvFor` 分離＋`salon_mismatch`＋`already_linked_other`＋複合UNIQUE | ✅ |
| ゲームで出金可能額を増やせない | 純増分を `bonus_locked` 加算（016） | ✅ |
| 特典/ボーナスは出金不可 | 012/013＋クランプ | ✅ |
| JP居住者は価値移転不可 | クライアント全画面＋`REGION_BLOCKED`（mines/plinko/withdraw＋入金in/resume=M-2解消） | ✅ |
| 出金日次上限 | `ep_begin_withdraw`＋`ep_config`（014） | ✅ |
| 転送の原子性（部分適用なし） | begin/finish/complete が単一関数内で原子的、失敗時返金 | ✅ |
| 転送の再送安全性 | idempotency_key UNIQUE＋resume＋GAS冪等（両サロン実装確認済） | ✅（残り＝GASデプロイ鮮度確認、I-1） |
| 地雷位置の秘匿 | `mines_secrets` RLS有効・ポリシー無し | ✅ |
| 同時Minesは1つ | `mines_games_one_active_uidx` | ✅ |

---

## 4. 推奨アクション（優先順）

1. **I-1**: ✅ 両サロンGASの冪等実装は確認済み。残りは admin での 1EP往復＋「再開」実機テストで**デプロイ鮮度**を確定するのみ。
2. **I-2**: `callGas` にタイムアウト付与。
3. **I-3**: 主要RPCのSQLレベルテスト（または local↔SQL 差分レビューの運用化）。
4. **M-1 / M-2**: ✅ Plinko整数チェック、入金の residency チェックで多層防御を対称化（完了）。
5. **M-3 / M-4**: ✅ 完了（未知コードのフォールバック、転送の再入ガード）。**M-5 / M-6**: 将来上限・許容範囲（当面据え置き）。

## 5. 未解決事項

- I-1 の GAS 側実装状況は本リポジトリからは確認不能（別リポジトリ／GASプロジェクト）。実機での往復テスト（少額1EP × 各サロン）で最終確認する。
- デプロイ済み env（`GAS_*` の両サロン分・`MIRAIX_SSO_SECRET`）の実在は Secrets 非公開のため未確認。`ep-transfer` に各サロン実ユーザーで `balance` 照会し `gas_env_missing:*` が出ないかで判定可能。
