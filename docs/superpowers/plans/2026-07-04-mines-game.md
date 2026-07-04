# Mines + 出金日次上限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MR賭けのサーバー権威Minesゲーム(5×5・宝石テーマ)と、サロンEP出金の日次上限を追加する。

**Architecture:** Plinkoで確立したパターンを踏襲。抽選・残高・台帳はSupabase RPC(SECURITY DEFINER+行ロック)、地雷位置はRLSポリシー無しの`mines_secrets`に隔離しクライアントへ送らない。クライアントは演出専用(framer-motion/Web Audio合成音/Vibration API)。デモモードはlocalClientに同実装。

**Tech Stack:** React18 + TS + Tailwind + framer-motion(新規) + Supabase(plpgsql) + vitest

## Global Constraints

- 仕様: `docs/superpowers/specs/2026-07-04-mines-game-design.md`(承認済み)
- 倍率式: `multiplier = round(house_edge × Π_{i=0..k-1}(25−i)/(25−m−i), 4)`、`payout = round(bet×mult, 2)`、house_edge 初期0.95
- ベット: 整数1〜10,000 / 地雷数1〜24 / 同時activeゲーム1つ(部分uniqueインデックス)
- 出金日次上限: JST日付基準、`out`かつ`pending|completed`を集計、初期1,000MR/日、`DAILY_LIMIT`エラー
- localStorageは設定(ミュート)のみ。ポイント・履歴はDB
- 用語は既存Plinko踏襲(ベット/還元率)。地雷は「罠」、安全マスは宝石
- 各タスク後: `npx vitest run` 全合格 + `npm run build` 成功

---

### Task 1: migrate-014 出金日次上限(SQL + Edge Function + Wallet)

**Files:**
- Create: `supabase/migrate-014-withdraw-daily-limit.sql`
- Modify: `supabase/functions/ep-transfer/index.ts`(beginErrマップにDAILY_LIMIT追加)
- Modify: `src/pages/Wallet.tsx`(残り枠表示 + DAILY_LIMITメッセージ)
- Modify: `supabase/README.md`(適用順に14を追記)

**Interfaces:**
- Produces: `ep_config(id=1, daily_withdraw_ep)`(select全員可)、`admin_set_daily_withdraw_ep(numeric)`、`ep_begin_withdraw`が`DAILY_LIMIT`を送出

- [x] SQL: `ep_config`作成(RLS: select true)+seed(1,1000) / `ep_begin_withdraw`差し替え(BONUS_LOCKEDチェックの後に当日JST集計+上限チェック) / admin RPC(role='admin'必須、p>=0)
- [x] ep-transfer: `: beginErr.message.includes('DAILY_LIMIT') ? 'DAILY_LIMIT'` をマップに追加
- [x] Wallet: `ep_config`と当日out合計(RLSで自分の行のみ)をロードし「本日の出金残り枠」を出金説明文に併記。エラーマップに `DAILY_LIMIT → '本日の出金上限に達しました。残り枠は明日リセットされます。'`
- [x] 検証: vitest+build

### Task 2: mines-math.ts(純関数)+テスト

**Files:**
- Create: `src/lib/mines-math.ts`, `src/lib/mines-math.test.ts`

**Interfaces:**
- Produces: `fairMultiplier(mines, k): number` / `multiplierAt(mines, k, houseEdge): number`(round4) / `nextMultiplier(...)` / `bustChance(mines, revealedCount): number` / `MIN_BET=1, MAX_BET=10000, GRID=25`

- [x] テスト先行: fair(1,24)=25 / fair(24,1)=25 / multiplierAt(3,0,.95)=1? (k=0はfair=1→0.95…**k=0は1.0を返す仕様にする**: multiplierAtはk=0で1) / 単調増加 / RTP検証: Σ P(k枚で生存して止まる戦略の期待値)ではなく「k枚開けて生存する確率×fair(k)=1」を数点で検証
- [x] 実装 → vitest合格

### Task 3: migrate-015 Mines SQL

**Files:**
- Create: `supabase/migrate-015-mines.sql`
- Modify: `supabase/README.md`

**Interfaces:**
- Produces: RPC `mines_start(p_bet numeric, p_mines int) returns json`(games行) / `mines_reveal(p_game uuid, p_cell int) returns json` `{safe,status,multiplier,revealed,payout?,balance?,mines?}` / `mines_cashout(p_game uuid) returns json` `{payout,multiplier,balance,mines}` / `admin_mines_set_house_edge(p_edge numeric)`
- エラー: GAME_ACTIVE/GAME_NOT_FOUND/BAD_CELL/ALREADY_REVEALED/NO_REVEAL/BAD_BET/BAD_MINES/INSUFFICIENT_POINTS

- [x] 仕様書§4.2どおりテーブル3つ+RLS+部分uniqueインデックス
- [x] `mines_start`: bet整数チェック(`p_bet <> trunc(p_bet)`拒否)、points for update減算、地雷`select array_agg(x) from (select x from generate_series(0,24) x order by random() limit m)`
- [x] `mines_reveal`: games行をfor update、secretsから地雷読取。自動キャッシュアウト(k=25−m)含む
- [x] `mines_cashout`: k>=1、payout加算
- [x] revoke/grant(authenticatedのみ、adminはRPC内checck)

### Task 4: localClient同実装+テスト

**Files:**
- Modify: `src/lib/localClient.ts`(DB型にmines_games/mines_config、seed、rpc 3+1本。地雷はモジュール内Map保持)
- Create: `src/lib/localClient.mines.test.ts`

- [x] テスト先行: 開始で残高減算/二重開始GAME_ACTIVE/安全開示で倍率一致(mines-mathと突合)/罠でbusted+mines公開/cashout加算/0枚cashout拒否/全開自動cashed
- [x] 実装 → vitest合格

### Task 5: 演出基盤(framer-motion / sounds / haptics)

**Files:**
- Modify: `package.json`(`npm i framer-motion`)
- Create: `src/lib/sounds.ts`(click/gem(pitch↑)/multiplier/cashout/bust、AudioContext遅延初期化、mute永続化)
- Create: `src/lib/haptics.ts`(`vibrate(pattern)` no-opフォールバック、`bustBuzz()`150-200ms/`cashoutBuzz()`[30,60,30]/`bigWinBuzz()`20ms)

- [x] 実装のみ(UIなし)。build合格

### Task 6: ゲームUI一式

**Files:**
- Create: `src/hooks/useMinesGame.ts`(config/activeゲーム復元/start/reveal/cashout/履歴100件+統計導出)
- Create: `src/components/mines/Tile.tsx`(未開/宝石(ランダム種)/罠。framer-motionフリップ+スタッガー)
- Create: `src/components/mines/Board.tsx`
- Create: `src/components/mines/HUD.tsx`(ベット・地雷数選択・現在/次倍率・期待獲得・CashOutボタン)
- Create: `src/components/mines/HistoryCards.tsx`(直近12件+勝率/最高倍率/連勝)
- Create: `src/components/mines/CelebrationOverlay.tsx`(10x/20x演出)
- Create: `src/pages/Mines.tsx`

- [x] ダーク+ゴールド/エメラルド+ガラスモーフィズム、`prefers-reduced-motion`対応、スマホレスポンシブ
- [x] エラーはmapRpcError経由で表示。build合格

### Task 7: 導線・管理・ルーティング

**Files:**
- Create: `src/components/GameCorner.tsx`(Plinko/Minesの2枚カード)
- Modify: `src/pages/MarketList.tsx:264`(PlinkoBanner→GameCorner)
- Create: `src/pages/admin/Mines.tsx`(house_edge表示/変更、RTPプレビュー)
- Modify: `src/App.tsx`(/mines, /admin/mines)、`src/components/Navbar.tsx`(admin: Mines設定)
- Modify: `src/store/useStore.ts`(mapRpcErrorにMines系コード追加)

- [x] PlinkoBanner.tsxは削除せずGameCornerから流用 or 置換(小さければ統合)

### Task 8: 総合検証+ドキュメント

- [x] `npx vitest run`全合格 / `npm run build` / `npx tsc --noEmit`
- [x] 仕様書に「実装完了」追記、`supabase/README.md`(14/15)、メモリ更新
- [x] デモモード実機確認(headless Chrome+CDP、/minesで1ゲーム通し)
