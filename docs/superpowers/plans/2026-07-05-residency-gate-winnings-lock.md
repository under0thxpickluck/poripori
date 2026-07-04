# 居住国申告ゲート + ゲーム勝ち分ロック Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ゲーム純増分を出金不可ロックに積む migrate-016 と、初回ログイン時の居住国申告+英文同意モーダル(記録のみ)を実装する。

**Architecture:** 勝ち分ロックは既存 `bonus_locked`(migrate-012 のロー・ウォーターマーク)へ `greatest(payout - bet, 0)` を加算するだけ。ゲートは `profiles` 3カラム + `declare_residency` RPC + `Layout.tsx` に組み込むブロッキングモーダル。デモモードは localClient に同実装。

**Tech Stack:** 既存のみ(plpgsql / React / zustand / vitest)。追加依存ゼロ。

## Global Constraints

- 仕様: `docs/superpowers/specs/2026-07-05-residency-gate-winnings-lock-design.md`(承認済み。同意文全文は仕様書 §3.3 が正)
- 機能制限はしない(日本居住でもゲーム・出金とも利用可。記録のみ)
- 同意文は英文が正文。`CONSENT_VERSION = 'v1-2026-07-05'`
- ロック式: `bonus_locked = bonus_locked + greatest(payout - bet, 0)`(Mines cashout / Mines 自動cashout / plinko_play の3箇所)
- クランプトリガ(migrate-012)は変更しない
- 各タスク後: `npx vitest run` + `npm run build` 成功

---

### Task 1: migrate-016 SQL + README

**Files:**
- Create: `supabase/migrate-016-residency-winnings-lock.sql`
- Modify: `supabase/README.md`(適用順 16 を追記)

**Interfaces:**
- Produces: `profiles.residency / residency_consent_version / residency_consented_at`、RPC `declare_residency(p_residency text, p_version text) returns void`(本人のみ、`BAD_RESIDENCY` 検証)、`mines_cashout` / `mines_reveal` / `plinko_play` の払い戻しが bonus_locked を加算する版に差し替え

- [x] profiles 3カラム追加(`add column if not exists`、residency は `check (residency in ('japan','overseas'))`)
- [x] `declare_residency`: `auth.uid()` 必須(`AUTH_REQUIRED`)、residency 値検証(`BAD_RESIDENCY`)、p_version 非空(`BAD_VERSION`)、`update profiles set residency=..., residency_consent_version=..., residency_consented_at=now() where id=auth.uid()`。`security definer` + `grant execute to authenticated` + `revoke from public/anon`
- [x] `plinko_play` を migrate-011 の定義そのまま + `update profiles set points = points + v_payout - p_bet, bonus_locked = bonus_locked + greatest(v_payout - p_bet, 0)` に差し替え(create or replace 全文)
- [x] `mines_cashout` と `mines_reveal`(自動cashout分岐)を migrate-015 の定義そのまま + points 加算行に `bonus_locked = bonus_locked + greatest(v_payout - v_bet, 0)` を追加した版に差し替え(create or replace 全文。v_bet はゲーム行の bet)
- [x] README に「16. migrate-016 — 居住国申告の記録 + ゲーム勝ち分の出金不可ロック(012/015 の後に適用)」追記
- [x] `npm run build` 成功(SQL は Studio 適用のためローカル検証は構文目視)

### Task 2: localClient 同実装 + テスト

**Files:**
- Modify: `src/lib/localClient.ts`
- Create: `src/lib/localClient.winlock.test.ts`

**Interfaces:**
- Consumes: 既存の `mines_cashout` / `mines_reveal` / `plinko_play` ローカル実装、profiles 行
- Produces: profiles に `residency: null` 等3フィールド(seed/後方互換マージ)、rpc `declare_residency`

- [x] テスト先行(`localClient.winlock.test.ts`):
  - Mines: bet 10 で開始→1マス開けて cashout → `bonus_locked` が `payout - 10` 増える / `points - bonus_locked`(出金可能額)がゲーム前後で増えていない
  - Plinko: `plinko_play` 勝ち時に同様
  - `declare_residency('overseas', 'v1-2026-07-05')` → profiles 3フィールド反映 / `declare_residency('mars', ...)` → `BAD_RESIDENCY`
- [x] 実装: profiles 型+seed+load後方互換に3フィールド追加(既存ユーザーは null)。mines_cashout/自動cashout/plinko_play のポイント加算箇所で `p.bonus_locked += Math.max(0, round2(payout - bet))`。rpc `declare_residency` 追加
- [x] `npx vitest run` 全合格

### Task 3: ResidencyGate モーダル + Layout 組み込み

**Files:**
- Create: `src/components/ResidencyGate.tsx`
- Modify: `src/components/Layout.tsx`(DevAccountSwitcher と同列に配置)
- Modify: `src/store/useAuth.ts`(Profile 型に3フィールド追加。loadProfile が `select('*')` なら型のみ)

**Interfaces:**
- Consumes: `useAuth`(profile / loadProfile / signOut 相当)、`supabase.rpc('declare_residency', {...})`
- Produces: `CONSENT_VERSION = 'v1-2026-07-05'`(ResidencyGate 内 export)

- [x] ResidencyGate: `profile != null && profile.residency_consent_version !== CONSENT_VERSION` のとき `fixed inset-0 z-[80]` のモーダル表示。構成: 日本語注記1行「以下の英文が正文です(The English text below is the governing version)」→ タイトル **Residency Declaration & Terms of Participation** → 仕様書 §3.3 の英文10項(スクロール領域 `max-h-[50vh] overflow-y-auto`)→ 居住国ラジオ(日本に居住 / 日本国外に居住)→ 同意チェック「I have read and agree to the above / 上記を読み同意します」→ ボタン2つ: 「同意して利用を続ける」(residency 未選択 or チェック無しは disabled。rpc 成功後 `loadProfile()`)/「同意しない(サインアウト)」(`supabase.auth.signOut()`)
- [x] エラーは `mapRpcError` 経由で表示。多重送信ガード(busy)
- [x] Layout に `<ResidencyGate />` 追加
- [x] `npm run build` 成功

### Task 4: Wallet 注記

**Files:**
- Modify: `src/pages/Wallet.tsx`(出金説明ブロック)

- [x] 出金セクションの説明文に追記: 「ゲーム(Mines・Plinko)で増えた分は出金対象外です(出金可能額に含まれません)。」
- [x] `npm run build` 成功

### Task 5: 総合検証 + ドキュメント + push

- [x] `npx vitest run` / `npm run build` / `npx tsc --noEmit`
- [x] デモモード実機(dev サーバー + headless Chrome): ①初回ログインでゲート表示 → 英文・ラジオ・チェック確認 → 同意 → モーダル消える → リロードで再表示されない ②Mines で cashout → Wallet 相当の出金可能額(points - bonus_locked)が増えていないことを localStorage or 画面で確認 ③「同意しない」でサインアウト
- [x] 仕様書に「実装完了」追記、計画チェックボックス更新、メモリ更新
- [x] コミット(SQL+local / UI で2コミット可)→ push(デプロイ手順: Studio で migrate-016 → Vercel 自動)
