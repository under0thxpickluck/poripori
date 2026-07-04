# 居住国申告ゲート + ゲーム勝ち分ロック 設計仕様書

作成: 2026-07-05 / ステータス: ユーザー承認済み設計（実装前）

## 1. 目的（背景）

MR を賭ける偶然性ゲーム（Mines / Plinko）とサロンEP出金が組み合わさることによる
賭博該当性リスクを低減する。方針は2本立て:

1. **ゲーム勝ち分ロック**: ゲームの純増分を出金不可にし、「ゲームでは出金可能額を
   絶対に増やせない」構造にする（換金性の遮断）。
2. **居住国申告ゲート**: 初回利用時に居住国の申告と確認事項（英文）への明示同意を取得・
   記録し、運営が二重確認を行っている証跡を残す。**機能制限は行わない（記録のみ）**。

⚠️ 本設計は法的助言ではない。同意文言・スキームは本番公開前に専門家レビューを推奨。

## 2. A. ゲーム勝ち分ロック（migrate-016）

- Mines: `mines_cashout` と `mines_reveal` の自動キャッシュアウト時に
  `bonus_locked = bonus_locked + greatest(payout - bet, 0)` を加算。
- Plinko: 払い戻し RPC 内で同様に `greatest(payout - bet, 0)` を加算。
- 出金可能額 = `points - bonus_locked`（migrate-012 の既存機構がそのまま効く）。
- ベット原資はロックしない（勝っても負けても、ゲーム往復で出金可能額は増えない）。
- 既存のロー・ウォーターマーククランプ（points < bonus_locked になったら縮める）は不変。
- Wallet に「ゲームの勝ち分は出金対象外」注記を追加。
- localClient（デモ）同実装 + テスト（勝ち分ロック加算 / ベット原資非ロック / 往復不変）。

## 3. B. 居住国申告ゲート

### 3.1 挙動

- ログイン済みかつ未申告（`residency_consent_version` が現行版と不一致）のユーザーに、
  全ページ共通のブロッキングモーダルを表示（`Layout.tsx` に組み込み）。
- 内容: ① 居住国の選択（日本 / 日本国外）② 英文の確認事項（§3.3）+
  日本語注記「以下の英文が正文です」③ 同意チェックボックス → 「同意して利用を続ける」。
- 「同意しない」→ サインアウト。同意完了までモーダルは閉じられない。
- 文言改定時は `CONSENT_VERSION` を上げて再同意を要求。
- 機能制限はしない（日本居住でもゲーム・出金とも利用可。記録のみ）。

### 3.2 記録（サーバー権威）

```sql
alter table profiles add column residency text
  check (residency in ('japan','overseas'));
alter table profiles add column residency_consent_version text;
alter table profiles add column residency_consented_at timestamptz;
```

- RPC `declare_residency(p_residency text, p_version text)`（SECURITY DEFINER・本人のみ）:
  値検証のうえ3カラムを更新。クライアント直接 update は不可（既存 RLS 方針踏襲）。
- 取得は既存の本人 select で可。

### 3.3 同意文（英文・正文。豪州英語）

タイトル: **Residency Declaration & Terms of Participation**

```
Please read and agree to the following before using MIRAIX.

1. MIRAIX Points ("MR") are virtual points provided solely for
   entertainment purposes within this site. MR is not money,
   electronic money, or a financial instrument of any kind.

2. The mini-games on this site (including Mines and Plinko) are
   entertainment features. Any MR gained through these games is
   locked as non-withdrawable and can never be transferred or
   exchanged outside this site, including to partner salon EP.

3. You must truthfully declare your country of residence.
   Deliberately false or misleading declarations are prohibited.

4. If we recognise that a declaration is false, we may restrict,
   suspend or terminate the relevant account and any associated
   features without prior notice.

5. We may, at any time and at our sole discretion, require you to
   complete identity verification (KYC), including the submission
   of government-issued identification documents. Failure to
   cooperate may result in restriction of features.

6. You are solely responsible for ensuring that your use of this
   site complies with all laws and regulations applicable in your
   country or region of residence.

7. Transfers between MR and partner salon points (EP) are provided
   on an as-is basis. Consumed EP or MR will not be compensated or
   restored under any circumstances.

8. We may amend these terms from time to time. Continued use of
   the site after an amendment requires renewed agreement.

9. You confirm that you are of legal age to use this service in
   your jurisdiction of residence.

10. This English text is the governing version of this notice.
    Any translations or summaries are provided for convenience only.
```

### 3.4 デモモード

- localClient: profiles 3項目 + `declare_residency` RPC を同実装。
- デモではモーダルの表示・同意フローも本番同様に動く（サンドボックスで確認可能）。

## 4. 実装ファイル

- Create: `supabase/migrate-016-residency-winnings-lock.sql`
- Create: `src/components/ResidencyGate.tsx`（モーダル。同意文は定数 `CONSENT_VERSION` と共に保持）
- Modify: `src/components/Layout.tsx`（ゲート組み込み）
- Modify: `src/pages/Wallet.tsx`（勝ち分は出金対象外の注記）
- Modify: `src/lib/localClient.ts` + テスト追加
- Modify: `supabase/README.md`（migrate-016 追記）

## 5. 検証

- vitest（勝ち分ロックのローカルテスト含む）全合格 / build / tsc
- デモモード実機: 初回ログインでゲート表示 → 同意 → 再表示されない /
  「同意しない」でサインアウト / Mines で勝ち → Wallet の出金可能額が増えないこと
