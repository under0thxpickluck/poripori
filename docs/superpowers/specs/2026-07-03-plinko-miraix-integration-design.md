# Plinko × MIRAIX ポイント連携 — 設計

日付: 2026-07-03
ステータス: ユーザー承認済み(口頭)。実装計画はこのスペックを元に作成する。

## 背景・目的

school_repo に実装済みの TL PLINKO(Canvas 物理演出+先抽選方式のプリンコゲーム)を、
MIRAIX(このリポジトリ)内で遊べるようにする。賭け金・配当は MIRAIX ポイント
(`profiles.points`)と同義として扱い、完全に連携する。

導線はホーム(マーケット一覧)に置く**バナー広告風のカード**
「たまには運任せにしてみる？」。

## スコープ

- Supabase: プレイ用 RPC・設定テーブル・プレイ台帳(migrate-011)
- React: `/plinko` ゲームページ、ホームのバナー、管理者の還元率設定ページ
- 物理エンジンの TypeScript 移植(school_repo 側は無変更で残す)

### 非スコープ

- XP・ゲーミフィケーションとの連動(プレイで XP は増えない)
- school_repo 版 Plinko の変更・削除
- 二項分布(玉が各マスに落ちる確率)自体の変更 — 管理者が調整できるのは
  倍率テーブル(=還元率)であり、抽選は常に公正なコイントス rows 回

## アーキテクチャ

```
MarketList(ホーム)
  └─ PlinkoBanner「たまには運任せにしてみる？」 ──→ /plinko(React ページ)
                                                       │
                                          plinko-engine.ts(物理・描画)
                                                       │ rpc('plinko_play', {bet, rows})
                                          Supabase RPC: 検証→抽選→配当→残高更新(原子的)
                                                       │
                                          profiles.points / plinko_plays / plinko_config
                                                       ↑
                              /admin/plinko(管理者が倍率テーブル=RTP を変更)
```

原則: **ポイントを動かすのはサーバーだけ**。クライアントは
「サーバーが決めた着地マスへ玉を演出する」だけ(buy_shares / EP 転送と同じ思想)。
ゲームは元々「先に抽選 → 玉を誘導」方式なので、抽選主体をサーバーに
移すだけで構造がそのまま噛み合う。

## DB — supabase/migrate-011-plinko.sql

### plinko_config(倍率テーブルの単一の真実)

| 列 | 型 | 説明 |
|---|---|---|
| rows_count | int PK | 8 / 10 / 12 / 14 / 16 |
| multipliers | numeric[] | 長さ rows_count+1 の倍率配列(対称) |
| updated_at | timestamptz | |
| updated_by | uuid null | 変更した管理者 |

- RLS: select は全員可(ゲーム画面がマスの倍率表示に使う)。insert/update/delete の
  ポリシーは作らない(変更は admin RPC 経由のみ)。
- マイグレーションで既定値を seed する。既定値は school_repo の
  `generateMultipliers`(RTP: 8段95% ⇔ 16段90% の線形補間、GROWTH=2.0)が生成する
  値をそのまま埋め込む:
  - 8段: {5.7, 2.9, 1.4, 0.72, 0.38, 0.72, 1.4, 2.9, 5.7}(RTP 95.09%)
  - 10段: {9.7, 4.9, 2.4, 1.2, 0.61, 0.33, 0.61, 1.2, 2.4, 4.9, 9.7}(RTP 93.82%)
  - 12段: {17, 8.3, 4.2, 2.1, 1, 0.52, 0.29, 0.52, 1, 2.1, 4.2, 8.3, 17}(RTP 92.61%)
  - 14段: {29, 14, 7.1, 3.6, 1.8, 0.89, 0.45, 0.21, 0.45, 0.89, 1.8, 3.6, 7.1, 14, 29}(RTP 91.27%)
  - 16段: {49, 25, 12, 6.2, 3.1, 1.5, 0.77, 0.38, 0.22, 0.38, 0.77, 1.5, 3.1, 6.2, 12, 25, 49}(RTP 89.98%)

### plinko_plays(プレイ台帳)

| 列 | 型 |
|---|---|
| id | uuid PK default gen_random_uuid() |
| user_id | uuid → profiles(id) on delete cascade |
| bet | numeric |
| rows_count | int |
| bucket | int |
| multiplier | numeric |
| payout | numeric |
| created_at | timestamptz default now() |

- RLS: select は自分の行のみ(`auth.uid() = user_id`)。書き込みポリシーなし
  (RPC のみが書く)。ep_transfers と同じ運用。

### RPC: plinko_play(p_bet numeric, p_rows int) → json

security definer。処理は 1 トランザクション:

1. `auth.uid()` null → `AUTH_REQUIRED`
2. p_rows が plinko_config に存在しない → `BAD_ROWS`
3. p_bet が 1〜10,000 の範囲外 → `BAD_BET`
4. `profiles` を `for update` でロックし、points < p_bet → `INSUFFICIENT_POINTS`
5. 抽選: `k = Σ(random() < 0.5 ? 1 : 0)` を p_rows 回(二項分布)
6. `multiplier = multipliers[k+1]`(PostgreSQL 配列は 1 始まり)、
   `payout = round(p_bet * multiplier, 2)`
7. `points += payout - p_bet` で更新、`plinko_plays` に記録
8. `json_build_object('bucket', k, 'multiplier', ..., 'payout', ..., 'balance', ...)` を返す

grant execute は authenticated のみ(anon には revoke)。

### RPC: admin_plinko_set_multipliers(p_rows int, p_multipliers numeric[]) → void

security definer。`admin_add_points` と同じ ADMIN_REQUIRED チェックの後:

- p_rows が既存の rows_count でない → `BAD_ROWS`
- 配列長 ≠ p_rows+1、または負の値を含む → `BAD_MULTIPLIERS`
- 二項係数で加重した RTP を計算し、10%〜150% の範囲外 → `RTP_OUT_OF_RANGE`
  (100% 超は意図的なプロモ設定として許容。UI 側で警告表示)
- `plinko_config` を update(updated_by = auth.uid())

## クライアント — ゲームエンジン移植

`src/lib/plinko-engine.ts`(新規)。school_repo の js/plinko.js から
ジオメトリ・物理・誘導(計画経路追従、詰まり検出、着地イーズ)・描画を移植し、
モジュール化する:

```ts
createPlinkoEngine(canvas, {
  rows,
  multipliers,          // 表示用(plinko_config から取得)
  onBallLanded(ball),   // 着地確定時のコールバック
}) => {
  drop(targetBucket, bet), // サーバーが返した着地マスを渡す
  setRows(rows, multipliers),
  resize(),
  destroy(),
}
```

- **抽選ロジック(sampleBinomialBucket)と TLWallet 依存は持ち込まない**。
  エンジンは純粋に「指定マスへ自然に落ちる演出」だけを担う。
- 倍率生成 `generateMultipliers` / `calcRTP` も TS へ移植し
  `src/lib/plinko-odds.ts` に置く(管理者ページのプレビューとテストで使用)。

## クライアント — /plinko ページ

`src/pages/Plinko.tsx`(lazy route)。

- 盤面 Canvas + ベット入力(1/2, x2, MAX)+段数選択 + 直近履歴 + 残高表示
- 残高は `useAuth().profile.points` を表示。ドロップ時に「−bet」を即時反映し、
  玉が着地した瞬間にサーバーが返した確定残高へ同期(`loadProfile()`)
- ドロップ処理: `supabase.rpc('plinko_play')` → 成功したら
  `engine.drop(result.bucket, bet)`。RPC エラー時は玉を落とさず
  既存トーンのエラー表示(`mapRpcError` に新エラーコードを追加)
- RPC 呼び出し中は DROP ボタンを無効化(連打防止)。複数玉の同時落下は
  RPC が返り次第 drop するので許容(それぞれ独立に精算済み)
- 未ログイン: 盤面は表示、DROP は無効化し「ログインして遊ぶ」→ 既存 LoginModal
- 倍率表示は plinko_config を select して使う(サーバーと必ず一致)
- スタイルは Tailwind の既存トークン(surface / border / accent 等)に合わせる

## クライアント — ホームのバナー

`src/components/PlinkoBanner.tsx`。MarketList のフィーチャーカルーセル直下に全幅で表示。

- コピー: 「たまには運任せにしてみる？」+サブ「Plinko でポイントを増やそう 🎲」
- AdCard と同じく右上に小さな「広告」風バッジ(トーンを合わせる)、
  アクセントカラーのグラデーション背景、クリックで `/plinko` へ(内部遷移)

## クライアント — 管理者ページ

`src/pages/admin/Plinko.tsx`、ルート `/admin/plinko`(AdminGuard 配下)、
Navbar の管理メニューに「Plinko設定」を追加。

- 還元率(RTP)を 2 つの数値で編集: 「8段のRTP」「16段のRTP」(間の段数は線形補間)
- `plinko-odds.ts` で 5 段数分の倍率テーブルを生成しプレビュー表示
  (各段の倍率配列と正確な RTP)
- 保存 = 段数ごとに `admin_plinko_set_multipliers` を呼ぶ(5 回)
- RTP > 100% の入力には「ポイントが増え続ける設定です」と警告表示(保存は可能)
- 現在の設定値は plinko_config から読み込んで初期表示

## エラー処理

`mapRpcError` に追加: `BAD_BET`(ベット額が不正です)、`BAD_ROWS`、
`BAD_MULTIPLIERS`、`RTP_OUT_OF_RANGE`。`INSUFFICIENT_POINTS` は既存文言を流用。
RPC ネットワーク失敗時はポイント変動なし(サーバー原子性)なので、
クライアントは表示を profile 再取得で立て直すだけでよい。

## テスト(vitest)

- `plinko-odds.test.ts`: `generateMultipliers` が migration の seed 値と一致すること
  (5 段数分)、`calcRTP` が狙い RTP ±丸め誤差に収まること
- `plinko-engine.test.ts`: フェイク 2D コンテキストでエンジンを駆動し、
  (a) 全玉が指定マスに着地する (b) フレーム間テレポートなし
  (c) 横方向の不自然な滑りなし — school_repo で使った検証ハーネスの移植
- 既存テスト(lmsr 等)と同じ `npm test` で実行

## 決定事項の記録

- 組み込み方式: iframe ではなく React 移植(テーマ・認証・デプロイの一元化)
- 不正対策: サーバー抽選 RPC(既存の buy_shares / EP 転送と同水準)
- 未ログイン: プレイ不可、ログイン誘導
- 管理者が変更できるのは倍率テーブル(還元率)のみ。抽選分布は固定
