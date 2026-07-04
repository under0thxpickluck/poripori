# MIRAIX Mines（宝石堀り）+ 出金日次上限 設計仕様書

作成: 2026-07-04 / ステータス: **実装完了（2026-07-04）**。残りはデプロイのみ（§7）。

> 実装結果: `npx vitest run` 74件全合格 / `npm run build`・`npx tsc --noEmit` 成功。
> デモモード実機E2E（headless Chrome + CDP、/mines）: 開始時のベット減算 → 安全開示 →
> Cash Out 加算 → バースト（没収）→ 履歴/統計表示 → リロードでの active ゲーム復元まで確認。
> 追加対応: ライトテーマで盤面（白アルファのガラスモーフィズム）が背景に溶けて見えなくなる
> 問題を発見し、ゲーム面をテーマ変数ごとダークに固定する `.stage-dark`（index.css）で解決。

## 1. 目的

- MR（MIRAIXポイント）を賭けて遊ぶ 5×5 Mines ゲームを追加する。Plinkoで確立した
  **サーバー権威パターン**（抽選・残高・台帳はすべて Supabase 側、クライアントは演出専用）を踏襲する。
- 併せて、保留になっていた**サロンEPへの出金日次上限**を導入する
  （特典・ボーナスMRのロック枠をゲームで出金可能枠へ変換する「ロック侵食」の実害を抑える）。

## 2. スコープ

### やること（Phase 1）
- 出金日次上限（migrate-014）: `ep_config` + `ep_begin_withdraw` 差し替え + Wallet 表示
- Mines 本体（migrate-015）: テーブル2つ + RPC 3本 + 設定テーブル + 管理RPC
- クライアント: `/mines` ページ一式（framer-motion 導入、効果音、バイブレーション、再開処理）
- ホームのゲームコーナー化（Plinko / Mines 2枚カード）、管理ページ `/admin/mines`
- localClient（デモモード）同実装 + テスト

### やらないこと（Phase 2 以降）
- 実績（Achievements）・デイリーチャレンジ・専用プロフィール/統計ページ
- ゲームプレイへのXP付与（既存XPはトレード由来のまま。Plinkoと同じ扱い）
- 乱数の pgcrypto 化（両ゲーム一括で別途判断）
- レート変動・Mines のシード公開（provably fair）

## 3. 不正防止の原則（最重要）

MR はサロンEPへ出金できるため実質的な価値を持つ。したがって:

- **地雷位置はクライアントに一切送らない。** プレイ中の地雷は `mines_secrets`
  （RLSポリシーなし = SECURITY DEFINER 関数のみが読める）に保持し、終局時に初めて
  `mines_games.mines` へ書き込んで公開する。
- ベット減算・倍率計算・払い戻しはすべて RPC 内で行い、行ロック（`for update`）で並行実行を直列化。
- 「同時に1ゲームまで」を部分uniqueインデックスでDB保証。

## 4. DB / RPC 設計

### 4.1 migrate-014: 出金日次上限

```sql
create table public.ep_config (
  id int primary key check (id = 1),
  daily_withdraw_ep numeric not null default 1000  -- 0 = 出金停止
);
insert into ep_config values (1, 1000) on conflict do nothing;
-- RLS: select は全員可 / 変更は admin RPC のみ
```

- `ep_begin_withdraw` を差し替え: 「当日（**Asia/Tokyo基準**）の `direction='out'` かつ
  `status in ('pending','completed')` の `ep_amount` 合計 + 今回申請額 > 上限」なら
  `DAILY_LIMIT` 例外。failed/reversed は返金済みなので集計から除外。
- 管理RPC `admin_set_daily_withdraw_ep(p numeric)`（0以上、role='admin' チェック）。
- `ep-transfer` Edge Function のエラーマップに `DAILY_LIMIT` を追加（再デプロイは既存の
  ハードニング分と同時でよい）。
- Wallet: `ep_config` と当日出金合計を取得して「本日の出金残り枠 ○○ MR」を表示。
  `DAILY_LIMIT` 時の日本語メッセージを追加。

### 4.2 migrate-015: Mines

```sql
create table public.mines_config (
  id int primary key check (id = 1),
  house_edge numeric not null default 0.95   -- 実効RTP係数（管理RPCで 0.10〜1.50 を強制）
);

create table public.mines_games (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  bet         numeric not null,
  mines_count int not null check (mines_count between 1 and 24),
  revealed    int[] not null default '{}',
  status      text not null default 'active' check (status in ('active','busted','cashed')),
  multiplier  numeric not null default 1,
  payout      numeric,          -- 終局時に確定（busted は 0）
  mines       int[],            -- ★終局までは NULL。終局時に公開して履歴表示に使う
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index mines_games_one_active_uidx on mines_games(user_id) where status = 'active';
-- RLS: select 本人のみ / 書き込みポリシーなし

create table public.mines_secrets (
  game_id uuid primary key references mines_games(id) on delete cascade,
  mines   int[] not null
);
-- RLS 有効・ポリシーなし（誰も select できない）
```

**倍率式**: 地雷 m 個・安全開示 k 枚のとき
`fair(k) = Π_{i=0..k-1} (25−i)/(25−m−i)`（= C(25,k)/C(25−m,k)）、
`multiplier = round(house_edge × fair(k), 4)`、`payout = round(bet × multiplier, 2)`。
理論最大は 25×0.95 = 23.75x（m=24 で1枚、または m=1 で24枚開け切り）。

**RPC**（すべて SECURITY DEFINER、`auth.uid()` 本人チェック、`grant execute to authenticated`）:

| RPC | 検証 | 動作 |
|---|---|---|
| `mines_start(p_bet, p_mines)` | betは整数1〜10,000 / mines 1〜24 / 残高（for update）/ activeゲーム無し | ベット即時減算 → 地雷 m 個を乱択して secrets へ → games 行を返す |
| `mines_reveal(p_game, p_cell)` | 本人・active・cell 0〜24・未開示 | 地雷: status='busted', payout=0, mines公開, secret削除。安全: revealed追加・倍率更新。**k=25−m で自動キャッシュアウト**（払い戻し＋'cashed'） |
| `mines_cashout(p_game)` | 本人・active・**開示1枚以上**（0枚は `NO_REVEAL`） | `payout` を points に加算、status='cashed'、mines公開、secret削除 |
| `admin_mines_set_house_edge(p)` | admin / 0.10〜1.50 | `mines_config.house_edge` 更新 |

**エラーコード**: `GAME_ACTIVE` / `GAME_NOT_FOUND`（他人・不存在）/ `GAME_FINISHED` /
`BAD_CELL` / `ALREADY_REVEALED` / `NO_REVEAL` / `BAD_BET` / `BAD_MINES` /
`INSUFFICIENT_POINTS` / `DAILY_LIMIT`（出金側）。`mapRpcError` に日本語を追加。

**戻り値**: reveal は `{safe, status, multiplier, payout?, balance?, mines?}`。
mines はバスト/終局時のみ含める。balance は points 変動があった時のみ返す。

## 5. クライアント設計

### 5.1 構成（ロジック完全分離）

```
src/lib/mines-math.ts        fair倍率・次マス倍率・バスト確率（純関数）
src/lib/sounds.ts            Web Audio 合成効果音（音源ファイル無し）
src/lib/haptics.ts           navigator.vibrate ラッパー（未対応は自動無効）
src/hooks/useMinesGame.ts    状態・RPC・active ゲーム再開
src/pages/Mines.tsx          ページ（組み立てのみ）
src/components/mines/Board.tsx / Tile.tsx / HUD.tsx / HistoryCards.tsx / CelebrationOverlay.tsx
src/components/GameCorner.tsx  ホームの2枚カード（PlinkoBanner を置き換え）
src/pages/admin/Mines.tsx    ハウスエッジ設定
```

- **framer-motion を新規導入**（`npm i framer-motion`）。
- 再開: マウント時に自分の active ゲームを select し、`revealed` から盤面を復元。
- 履歴/統計: `mines_games` 直近100件から履歴カード（12件表示）・勝率・最高倍率・連勝を導出。
  localStorage は**設定（ミュート等）のみ**に使用し、ポイント・履歴には使わない。

### 5.2 世界観・演出

- 宝石堀りテーマ。安全マス=宝石（数種類からランダム表示、**演出のみ**で配当に影響しない）、
  地雷=「罠」表記。ダーク（黒・濃紺）+ ゴールド/エメラルドのアクセント、ガラスモーフィズム。
- アニメーション: 盤面のスタッガー出現 / タイル開封のスケール+フリップ / 倍率のスプリング更新 /
  Cash Out の光とコイン風パーティクル / 罠は上品な暗転+パルス / **10倍以上で特別演出、
  20倍以上で画面全体の輝き**。`prefers-reduced-motion` を尊重して減衰。
- HUD: 現在倍率（大）・次の1マス成功時の倍率・期待獲得MR・Cash Out ボタン（獲得額を常時表示）。

### 5.3 効果音（Web Audio 合成・すべて 100ms 前後）

クリック（微小tick）/ 宝石（開示数に応じて音程が上がるチャイム）/ 倍率アップ（控えめ）/
Cash Out（2音の成功音）/ 罠（低いスラム音）。初回ユーザー操作で AudioContext 初期化、
ミュートトグルを localStorage に保存。

### 5.4 バイブレーション

罠=150〜200ms 単発 / Cash Out=短×2（[30,60,30]）/ 高倍率開示（5倍超）=20ms。
`navigator.vibrate` 不在なら全て no-op。操作をブロックしない（fire-and-forget）。

## 6. デモモード・テスト

- `localClient.ts`: `mines_config`/`mines_games` テーブル + RPC 3本を同ロジックで実装
  （地雷はモジュール内部変数に保持し、select には出さない）。`load()` の後方互換マージが
  新テーブルを拾うことを確認。
- テスト: `mines-math.test.ts`（倍率式・全 (m,k) で RTP=house_edge を検証）、
  `localClient.mines.test.ts`（開始→開示→バスト/キャッシュアウト/全開自動確定・残高整合・
  二重ゲーム禁止・0枚キャッシュアウト拒否）。
- 出金上限のロジックは SQL 側のみ（ローカルは Wallet 自体が無効のため対象外）。

## 7. デプロイ手順（ユーザー操作）

1. Studio で migrate-014 → migrate-015 を適用
2. `ep-transfer` Edge Function 再デプロイ（既存ハードニング分と同時でよい）
3. poripori を Vercel へデプロイ

## 8. リスクと既知の限界

- ロック侵食はゲームがある限り原理的に残る。日次出金上限（初期1,000MR/日・変更可）で
  実害の上限を固定するのが本設計の立場。
- `random()` は疑似乱数（Plinkoと同等。pgcrypto 化は Phase 2）。
- 表現は既存 Plinko の語彙（ベット/還元率）に合わせ、換金を想起させる文言は使わない。
