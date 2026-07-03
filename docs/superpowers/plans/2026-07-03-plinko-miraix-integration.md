# Plinko × MIRAIX ポイント連携 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** school_repo の Plinko を MIRAIX の React ページとして移植し、賭け金・配当を Supabase RPC 経由で `profiles.points` と完全連携。管理者は還元率を変更できる。

**Architecture:** サーバー(`plinko_play` RPC)が検証・抽選・配当・残高更新を原子的に行い、クライアントの物理エンジンは「返ってきた着地マスへ玉を演出する」だけ。倍率テーブルは `plinko_config` テーブルが単一の真実で、ゲーム表示・配当計算・管理画面すべてがそこを参照する。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + zustand + Supabase (PostgreSQL/plpgsql) + vitest

**Spec:** `docs/superpowers/specs/2026-07-03-plinko-miraix-integration-design.md`

## Global Constraints

- リポジトリ: `C:\Users\unite\poripori`(school_repo は一切変更しない)
- ベット範囲: 1〜10,000 ポイント(サーバーで強制)
- 段数: 8/10/12/14/16、既定 RTP: 8段95% ⇔ 16段90% 線形補間
- admin RPC の RTP 許容範囲: 10%〜150%
- ポイントを動かすのは security definer RPC のみ。profiles への update ポリシーは追加しない
- UI 文言は日本語、Tailwind は既存トークン(bg/surface/surface-hover/border/accent/text/text-muted/yes/no)のみ使用
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- テスト実行: `npm test`(vitest run)。単一ファイルは `npx vitest run <path>`
- 作業ブランチ: `plinko-integration`(Task 1 冒頭で作成)

---

### Task 1: DB マイグレーション(plinko_config / plinko_plays / RPC)

**Files:**
- Create: `supabase/migrate-011-plinko.sql`

**Interfaces:**
- Produces: RPC `plinko_play(p_bet numeric, p_rows int) → json {bucket:int, multiplier:numeric, payout:numeric, balance:numeric}`、RPC `admin_plinko_set_multipliers(p_rows int, p_multipliers numeric[]) → void`、テーブル `plinko_config(rows_count int pk, multipliers numeric[], updated_at, updated_by)`(select 全員可)、`plinko_plays`(select 自分のみ)
- エラーコード: `AUTH_REQUIRED` / `BAD_BET` / `BAD_ROWS` / `INSUFFICIENT_POINTS` / `PROFILE_NOT_FOUND` / `ADMIN_REQUIRED` / `BAD_MULTIPLIERS` / `RTP_OUT_OF_RANGE`

- [ ] **Step 1: ブランチ作成**

```powershell
cd C:\Users\unite\poripori; git checkout -b plinko-integration
```

- [ ] **Step 2: マイグレーションファイルを作成**

`supabase/migrate-011-plinko.sql` を以下の内容で作成:

```sql
-- supabase/migrate-011-plinko.sql
-- Plinko × MIRAIX ポイント連携(docs/superpowers/specs/2026-07-03-plinko-miraix-integration-design.md)
-- Supabase Studio → SQL Editor に貼り付けて実行(migrate-010 と同じ運用)

-- 1) 倍率テーブル設定(単一の真実。ゲーム表示・配当計算・管理画面が全てここを参照)
create table if not exists public.plinko_config (
  rows_count  int primary key,
  multipliers numeric[] not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

alter table public.plinko_config enable row level security;
drop policy if exists plinko_config_read on public.plinko_config;
create policy plinko_config_read on public.plinko_config for select using (true);
-- insert/update/delete のポリシーは作らない(変更は admin RPC 経由のみ)

-- 既定値: school_repo の generateMultipliers(8段95%⇔16段90% 線形補間, GROWTH=2.0)の出力
insert into public.plinko_config (rows_count, multipliers) values
  (8,  '{5.7,2.9,1.4,0.72,0.38,0.72,1.4,2.9,5.7}'),
  (10, '{9.7,4.9,2.4,1.2,0.61,0.33,0.61,1.2,2.4,4.9,9.7}'),
  (12, '{17,8.3,4.2,2.1,1,0.52,0.29,0.52,1,2.1,4.2,8.3,17}'),
  (14, '{29,14,7.1,3.6,1.8,0.89,0.45,0.21,0.45,0.89,1.8,3.6,7.1,14,29}'),
  (16, '{49,25,12,6.2,3.1,1.5,0.77,0.38,0.22,0.38,0.77,1.5,3.1,6.2,12,25,49}')
on conflict (rows_count) do nothing;

-- 2) プレイ台帳(ep_transfers と同じ運用: クライアント書き込み不可)
create table if not exists public.plinko_plays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  bet        numeric not null,
  rows_count int not null,
  bucket     int not null,
  multiplier numeric not null,
  payout     numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists plinko_plays_user_idx
  on public.plinko_plays(user_id, created_at desc);

alter table public.plinko_plays enable row level security;
drop policy if exists plinko_plays_select_own on public.plinko_plays;
create policy plinko_plays_select_own on public.plinko_plays
  for select using (auth.uid() = user_id);

-- 3) プレイ: 検証→抽選(二項分布)→配当→残高更新→台帳記録 を1トランザクションで
create or replace function public.plinko_play(p_bet numeric, p_rows int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mult numeric[];
  v_points numeric;
  v_bucket int := 0;
  v_multiplier numeric;
  v_payout numeric;
  v_balance numeric;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet is null or p_bet < 1 or p_bet > 10000 then raise exception 'BAD_BET'; end if;
  select multipliers into v_mult from public.plinko_config where rows_count = p_rows;
  if not found then raise exception 'BAD_ROWS'; end if;
  select points into v_points from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_points < p_bet then raise exception 'INSUFFICIENT_POINTS'; end if;
  -- 抽選: 公正なコイントス p_rows 回(クライアントの旧 sampleBinomialBucket と同一モデル)
  for i in 1..p_rows loop
    if random() < 0.5 then v_bucket := v_bucket + 1; end if;
  end loop;
  v_multiplier := v_mult[v_bucket + 1]; -- PostgreSQL 配列は 1 始まり
  v_payout := round(p_bet * v_multiplier, 2);
  update public.profiles set points = points + v_payout - p_bet
   where id = v_uid returning points into v_balance;
  insert into public.plinko_plays (user_id, bet, rows_count, bucket, multiplier, payout)
  values (v_uid, p_bet, p_rows, v_bucket, v_multiplier, v_payout);
  return json_build_object(
    'bucket', v_bucket, 'multiplier', v_multiplier,
    'payout', v_payout, 'balance', v_balance);
end $$;

revoke execute on function public.plinko_play(numeric, int) from public, anon;
grant execute on function public.plinko_play(numeric, int) to authenticated;

-- 4) 管理者: 倍率テーブル変更(RTP 10%〜150% をサーバーで強制)
create or replace function public.admin_plinko_set_multipliers(p_rows int, p_multipliers numeric[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rtp numeric := 0;
  v_coeff numeric := 1; -- C(p_rows, k) を漸化式で計算
  k int;
  m numeric;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.plinko_config where rows_count = p_rows)
    then raise exception 'BAD_ROWS'; end if;
  if array_length(p_multipliers, 1) is distinct from p_rows + 1
    then raise exception 'BAD_MULTIPLIERS'; end if;
  for k in 0..p_rows loop
    m := p_multipliers[k + 1];
    if m is null or m < 0 then raise exception 'BAD_MULTIPLIERS'; end if;
    v_rtp := v_rtp + v_coeff * m;
    v_coeff := v_coeff * (p_rows - k) / (k + 1); -- C(n,k) → C(n,k+1)
  end loop;
  v_rtp := v_rtp / power(2::numeric, p_rows);
  if v_rtp < 0.10 or v_rtp > 1.50 then raise exception 'RTP_OUT_OF_RANGE'; end if;
  update public.plinko_config
     set multipliers = p_multipliers, updated_at = now(), updated_by = auth.uid()
   where rows_count = p_rows;
end $$;

revoke execute on function public.admin_plinko_set_multipliers(int, numeric[]) from public, anon;
grant execute on function public.admin_plinko_set_multipliers(int, numeric[]) to authenticated;
```

- [ ] **Step 3: セルフチェック**

以下を目視確認:
- 2テーブルとも `enable row level security` がある
- `plinko_config` に select ポリシーのみ、`plinko_plays` に select_own のみ(書き込みポリシーが無い)
- 両 RPC に `revoke ... from public, anon` がある
- seed の配列長 = rows_count+1(8段→9個, 10段→11個, 12段→13個, 14段→15個, 16段→17個)

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrate-011-plinko.sql
git commit -m "feat(plinko): add migration for config/plays tables and play/admin RPCs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 倍率生成ロジック(plinko-odds.ts)

**Files:**
- Create: `src/lib/plinko-odds.ts`
- Test: `src/lib/plinko-odds.test.ts`

**Interfaces:**
- Produces:
  - `ROW_OPTIONS: readonly number[]` = `[8, 10, 12, 14, 16]`
  - `GROWTH = 2.0`
  - `generateMultipliers(rows: number, targetRTP: number, growth?: number): number[]`(長さ rows+1、対称)
  - `calcRTP(rows: number, mult: number[]): number`
  - `binomCoeffs(n: number): number[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/plinko-odds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateMultipliers, calcRTP, ROW_OPTIONS, GROWTH } from './plinko-odds'

// migrate-011-plinko.sql の seed 値と完全一致すること(単一の真実の検証)
const MIGRATION_SEED: Record<number, number[]> = {
  8: [5.7, 2.9, 1.4, 0.72, 0.38, 0.72, 1.4, 2.9, 5.7],
  10: [9.7, 4.9, 2.4, 1.2, 0.61, 0.33, 0.61, 1.2, 2.4, 4.9, 9.7],
  12: [17, 8.3, 4.2, 2.1, 1, 0.52, 0.29, 0.52, 1, 2.1, 4.2, 8.3, 17],
  14: [29, 14, 7.1, 3.6, 1.8, 0.89, 0.45, 0.21, 0.45, 0.89, 1.8, 3.6, 7.1, 14, 29],
  16: [49, 25, 12, 6.2, 3.1, 1.5, 0.77, 0.38, 0.22, 0.38, 0.77, 1.5, 3.1, 6.2, 12, 25, 49],
}

// 既定 RTP: 8段95% ⇔ 16段90% の線形補間
function defaultRtp(rows: number): number {
  return 0.95 - ((rows - 8) / 8) * 0.05
}

describe('generateMultipliers', () => {
  it.each(ROW_OPTIONS.map((r) => [r]))('%i段: マイグレーション seed と一致する', (rows) => {
    expect(generateMultipliers(rows, defaultRtp(rows), GROWTH)).toEqual(MIGRATION_SEED[rows])
  })

  it.each(ROW_OPTIONS.map((r) => [r]))('%i段: 実RTPが狙いの±0.5%以内', (rows) => {
    const mult = generateMultipliers(rows, defaultRtp(rows), GROWTH)
    expect(Math.abs(calcRTP(rows, mult) - defaultRtp(rows))).toBeLessThan(0.005)
  })

  it('倍率テーブルは対称', () => {
    for (const rows of ROW_OPTIONS) {
      const m = generateMultipliers(rows, defaultRtp(rows), GROWTH)
      expect(m).toEqual([...m].reverse())
      expect(m).toHaveLength(rows + 1)
    }
  })

  it('RTP を変えるとテーブルが変わり、calcRTP が追従する', () => {
    const m = generateMultipliers(12, 0.8, GROWTH)
    expect(Math.abs(calcRTP(12, m) - 0.8)).toBeLessThan(0.005)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/plinko-odds.test.ts`
Expected: FAIL(`./plinko-odds` が存在しない)

- [ ] **Step 3: 実装(school_repo js/plinko.js §1 の忠実な移植)**

`src/lib/plinko-odds.ts`:

```ts
// Plinko 倍率テーブル生成。school_repo js/plinko.js からの移植。
// 本番の配当計算は Supabase の plinko_config を参照する(このモジュールは
// 管理画面のプレビュー生成と、seed 値がこのアルゴリズム由来であることの
// テストに使う)。

export const ROW_OPTIONS = [8, 10, 12, 14, 16] as const
export const GROWTH = 2.0 // 中央→端にかけての倍率の伸び方

export function binomCoeffs(n: number): number[] {
  const c = [1]
  for (let k = 1; k <= n; k++) {
    c.push((c[k - 1] * (n - k + 1)) / k)
  }
  return c
}

function roundMultiplier(x: number): number {
  if (x >= 10) return Math.round(x)
  if (x >= 1) return Math.round(x * 10) / 10
  return Math.round(x * 100) / 100
}

/** 行数 rows から、狙った還元率にほぼ一致する対称な倍率テーブルを作る */
export function generateMultipliers(rows: number, targetRTP: number, growth: number = GROWTH): number[] {
  const mid = rows / 2
  const coeffs = binomCoeffs(rows)
  const total = Math.pow(2, rows)
  const raw: number[] = []
  for (let k = 0; k <= rows; k++) {
    raw[k] = Math.pow(growth, Math.abs(k - mid))
  }
  const rawWeighted = coeffs.reduce((s, c, k) => s + c * raw[k], 0)
  const scale = (targetRTP * total) / rawWeighted
  const mult = raw.map((r) => roundMultiplier(r * scale))

  // 丸め誤差を中央マス(複数なら中央2マス)だけで吸収し、RTPをほぼ正確に合わせる
  const isEven = rows % 2 === 0
  const centerIdx = isEven ? [rows / 2] : [(rows - 1) / 2, (rows + 1) / 2]
  const centerWeight = centerIdx.reduce((s, k) => s + coeffs[k], 0)
  const fixedSum = coeffs.reduce((s, c, k) => (centerIdx.includes(k) ? s : s + c * mult[k]), 0)
  const neededCenterTotal = targetRTP * total - fixedSum
  const centerMult = Math.max(0, Math.round((neededCenterTotal / centerWeight) * 100) / 100)
  centerIdx.forEach((k) => (mult[k] = centerMult))

  return mult
}

export function calcRTP(rows: number, mult: number[]): number {
  const coeffs = binomCoeffs(rows)
  const total = Math.pow(2, rows)
  return coeffs.reduce((s, c, k) => s + c * mult[k], 0) / total
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/plinko-odds.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: Commit**

```powershell
git add src/lib/plinko-odds.ts src/lib/plinko-odds.test.ts
git commit -m "feat(plinko): port multiplier table generation with migration-parity tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 物理エンジン・純粋シミュレーション部(plinko-engine.ts 前半)

**Files:**
- Create: `src/lib/plinko-engine.ts`(このタスクでは純粋関数のみ。Canvas 描画は Task 4)
- Test: `src/lib/plinko-engine.test.ts`

**Interfaces:**
- Produces(Task 4 と テストが使用):
  - `type Rng = () => number`
  - `type Geometry`(rows, D, rowSpacingY, topMargin, centerX, leftWall, rightWall, bucketBarHeight, boardHeight, totalHeight, pegRadius, ballRadius, buckets, lastPegRowY, hopVx)
  - `type Peg = { x: number; y: number; row: number; hitAt: number }`
  - `type Ball`(x, y, vx, vy, trail, settled, targetBucket, targetX, plan, path, maxY, stuckFor, landing, landingStartX, landingStartY, landingElapsed, payload)
  - `computeGeometry(rows: number, cssWidth: number): Geometry`
  - `layoutPegs(geom: Geometry): Peg[]`
  - `createBall(geom: Geometry, targetBucket: number, payload: unknown, rng: Rng): Ball`
  - `advanceBall(ball: Ball, dt: number, geom: Geometry, pegs: Peg[], rng: Rng, nowMs: number): void`(1サブステップ進める。着地完了で `ball.settled = true`)
  - 定数 `SUBSTEP = 1 / 180`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/plinko-engine.test.ts`。school_repo で使った検証ハーネスの移植。全バケット強制×複数シードで「必ず指定マスに着地」「テレポートなし」「不自然な横滑りなし」を検証する:

```ts
import { describe, it, expect } from 'vitest'
import { computeGeometry, layoutPegs, createBall, advanceBall, SUBSTEP } from './plinko-engine'

// 再現性のためのシード付き乱数(LCG)
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function dropAndRecord(rows: number, targetBucket: number, seed: number) {
  const geom = computeGeometry(rows, 400)
  const pegs = layoutPegs(geom)
  const rng = makeRng(seed)
  const ball = createBall(geom, targetBucket, null, rng)
  const frames: { x: number; y: number }[] = []
  let simMs = 0
  // 60fps サンプリングで最長 8 秒
  for (let f = 0; f < 480 && !ball.settled; f++) {
    for (let s = 0; s < 3; s++) {
      simMs += SUBSTEP * 1000
      advanceBall(ball, SUBSTEP, geom, pegs, rng, simMs)
      if (ball.settled) break
    }
    frames.push({ x: ball.x, y: ball.y })
  }
  return { geom, ball, frames }
}

describe('plinko-engine 軌道品質', () => {
  const rowsList = [8, 12, 16]
  const seeds = [1, 42, 12345]

  for (const rows of rowsList) {
    it(`${rows}段: 全バケットに自然な軌道で着地する`, () => {
      for (let bucket = 0; bucket <= rows; bucket++) {
        for (const seed of seeds) {
          const { geom, ball, frames } = dropAndRecord(rows, bucket, seed)
          const D = geom.D

          // 必ず時間内に着地する
          expect(ball.settled).toBe(true)

          // 着地位置 = 指定バケットの中心
          const bucketCenter = geom.leftWall + (bucket + 0.5) * D
          expect(Math.abs(ball.x - bucketCenter)).toBeLessThan(D / 2)

          // フレーム間テレポートなし(1フレームで0.8マス以上動かない)
          for (let i = 1; i < frames.length; i++) {
            expect(Math.abs(frames[i].x - frames[i - 1].x)).toBeLessThan(0.8 * D)
          }

          // 持続的な横滑りなし(0.33秒窓での横移動は3マス以内。
          // 修正前の「中央への吸い寄せ」バグでは9マス超が観測されていた)
          for (let i = 20; i < frames.length; i++) {
            expect(Math.abs(frames[i].x - frames[i - 20].x)).toBeLessThan(3.0 * D)
          }
        }
      }
    })
  }
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/plinko-engine.test.ts`
Expected: FAIL(`./plinko-engine` が存在しない)

- [ ] **Step 3: 純粋シミュレーション部を実装**

`src/lib/plinko-engine.ts` を以下の内容で作成(school_repo js/plinko.js §4〜5 の移植。抽選・ポイント処理は持たない):

```ts
// ============================================================
// MIRAIX PLINKO — 物理シミュレーション+Canvas 描画エンジン
// ------------------------------------------------------------
// school_repo js/plinko.js からの移植。抽選もポイント処理も持たず、
// 「サーバーが決めた着地マス(targetBucket)へ物理的に自然な軌道で
// 玉を落とす」ことだけを担当する。
//  ・玉ごとに「各段で左右どちらへ跳ねるか」のプランを先に作る
//    (右k回・左rows-k回のシャッフル = 終点kで条件付けたランダム
//    ウォークと同じ分布なので、経路の見た目も統計的に自然)
//  ・ペグ衝突時は跳ね返りの向きだけをプランに合わせる
//  ・補正は「現在の段の理想位置」への微小な追従のみ(常に半マス以内)
//  ・ペグ帯を抜けたら短い着地イーズで必ず targetBucket 中心に収まる
// ============================================================

export type Rng = () => number

export type Geometry = {
  rows: number
  D: number
  rowSpacingY: number
  topMargin: number
  centerX: number
  leftWall: number
  rightWall: number
  bucketBarHeight: number
  boardHeight: number
  totalHeight: number
  pegRadius: number
  ballRadius: number
  buckets: number
  lastPegRowY: number
  hopVx: number
}

export type Peg = { x: number; y: number; row: number; hitAt: number }

export type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  trail: { x: number; y: number }[]
  settled: boolean
  targetBucket: number
  targetX: number
  plan: number[]
  path: number[]
  maxY: number
  stuckFor: number
  landing: boolean
  landingStartX: number
  landingStartY: number
  landingElapsed: number
  payload: unknown
}

// ---- 物理定数(school_repo 版と同一) ----
const GRAVITY = 1500 // px/s^2
const PEG_RESTITUTION = 0.55
const WALL_RESTITUTION = 0.65
const MAX_SPEED = 1400
export const SUBSTEP = 1 / 180
const TRAIL_LEN = 8
const STEER_TAU = 0.12 // 理想経路とのズレを詰める目安時間(秒)
const STEER_RATE = 8 // vx を追従速度へ寄せる速さ(1/秒)
const LANDING_EASE_SEC = 0.22 // 着地アニメーションの所要時間
const STUCK_TIMEOUT_SEC = 1.2 // 下方向に進めなくなってからの詰まり判定秒数

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function computeGeometry(rows: number, cssWidth: number): Geometry {
  const bottomPegCount = rows + 2
  const D = cssWidth / (bottomPegCount + 1)
  const rowSpacingY = D * 0.88
  const topMargin = D
  const bucketBarHeight = Math.max(38, D * 0.85)
  const boardHeight = topMargin + (rows - 1) * rowSpacingY + D
  const lastPegRowY = topMargin + (rows - 1) * rowSpacingY
  return {
    rows,
    D,
    rowSpacingY,
    topMargin,
    centerX: cssWidth / 2,
    leftWall: D,
    rightWall: (rows + 2) * D,
    bucketBarHeight,
    boardHeight,
    totalHeight: boardHeight + bucketBarHeight + 6,
    pegRadius: Math.max(2.5, D * 0.09),
    ballRadius: Math.max(4, D * 0.16),
    buckets: rows + 1,
    lastPegRowY,
    // ペグで跳ねた玉が次の段までに半マス(D/2)横へ移動するのに必要な横速度
    hopVx: (0.5 * D) / Math.sqrt((2 * rowSpacingY) / GRAVITY),
  }
}

export function layoutPegs(geom: Geometry): Peg[] {
  const pegs: Peg[] = []
  for (let i = 0; i < geom.rows; i++) {
    const count = 3 + i
    const rowWidth = (count - 1) * geom.D
    const y = geom.topMargin + i * geom.rowSpacingY
    for (let j = 0; j < count; j++) {
      pegs.push({ x: geom.centerX - rowWidth / 2 + j * geom.D, y, row: i, hitAt: -Infinity })
    }
  }
  return pegs
}

/**
 * targetBucket に着地するための段ごとの左右プラン(+1=右, -1=左)。
 * 右 k 回・左 rows-k 回の一様シャッフル = 「終点が k と決まったランダム
 * ウォーク」の条件付き分布そのものなので、途中経路も自然に見える。
 */
function buildPlan(rows: number, targetBucket: number, rng: Rng): number[] {
  const plan: number[] = []
  for (let i = 0; i < rows; i++) plan.push(i < targetBucket ? 1 : -1)
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = plan[i]
    plan[i] = plan[j]
    plan[j] = tmp
  }
  return plan
}

export function createBall(geom: Geometry, targetBucket: number, payload: unknown, rng: Rng): Ball {
  const plan = buildPlan(geom.rows, targetBucket, rng)
  // path[i] = i段目のペグに当たる瞬間の理想x座標(=当たるべきペグのx)。
  // 各決定で半マス(D/2)ずつ動き、path[rows] は必ず targetBucket の中心になる。
  const path = [geom.centerX]
  for (let i = 0; i < geom.rows; i++) {
    path.push(path[i] + plan[i] * geom.D * 0.5)
  }
  return {
    x: geom.centerX + (rng() - 0.5) * geom.D * 0.3,
    y: geom.topMargin * 0.25,
    vx: (rng() - 0.5) * 40,
    vy: 0,
    trail: [],
    settled: false,
    targetBucket,
    targetX: geom.leftWall + (targetBucket + 0.5) * geom.D,
    plan,
    path,
    maxY: -Infinity,
    stuckFor: 0,
    landing: false,
    landingStartX: 0,
    landingStartY: 0,
    landingElapsed: 0,
    payload,
  }
}

/** 誘導。戻り値 true のときは着地アニメーション中(物理はスキップ)。 */
function steerBall(ball: Ball, geom: Geometry, dt: number): boolean {
  if (ball.landing) {
    ball.landingElapsed += dt
    const te = easeOutCubic(Math.min(1, ball.landingElapsed / LANDING_EASE_SEC))
    ball.x = lerp(ball.landingStartX, ball.targetX, te)
    ball.y = lerp(ball.landingStartY, geom.boardHeight, te)
    if (te >= 1) ball.settled = true
    return true
  }

  // 詰まり検出: 最深到達点が更新されない時間を数える(総経過時間で判定すると
  // 段数が多い盤面で正常な玉まで途中から着地アニメに切り替わってワープする)
  if (ball.y > ball.maxY) {
    ball.maxY = ball.y
    ball.stuckFor = 0
  } else {
    ball.stuckFor += dt
  }
  const clearedPegs = ball.y > geom.lastPegRowY + geom.pegRadius
  if (clearedPegs || ball.stuckFor > STUCK_TIMEOUT_SEC) {
    ball.landing = true
    ball.landingStartX = ball.x
    ball.landingStartY = Math.min(ball.y, geom.boardHeight)
    ball.landingElapsed = 0
    return true
  }

  // 現在の高さにおける理想経路上のx(プランのジグザグを線分でつないだもの)
  // へ、横速度をそっと寄せる。追従速度はペグで跳ねたときの最大横速度と同じ
  // 上限に抑え、「跳ねより速い横滑り」は起こさない。
  const t = (ball.y - geom.topMargin) / geom.rowSpacingY
  const seg = Math.max(0, Math.min(geom.rows - 1, Math.floor(t)))
  const frac = Math.max(0, Math.min(1, t - seg))
  const idealX = lerp(ball.path[seg], ball.path[seg + 1], frac)
  const maxTrackVx = geom.hopVx * 2.2
  let desiredVx = (idealX - ball.x) / STEER_TAU
  if (desiredVx > maxTrackVx) desiredVx = maxTrackVx
  if (desiredVx < -maxTrackVx) desiredVx = -maxTrackVx
  ball.vx += (desiredVx - ball.vx) * Math.min(1, STEER_RATE * dt)
  return false
}

function stepBall(ball: Ball, dt: number, geom: Geometry, pegs: Peg[], rng: Rng, nowMs: number): void {
  ball.vy += GRAVITY * dt
  if (ball.vx > MAX_SPEED) ball.vx = MAX_SPEED
  if (ball.vx < -MAX_SPEED) ball.vx = -MAX_SPEED
  if (ball.vy > MAX_SPEED) ball.vy = MAX_SPEED

  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const r = geom.ballRadius
  if (ball.x - r < geom.leftWall) {
    ball.x = geom.leftWall + r
    ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION
  } else if (ball.x + r > geom.rightWall) {
    ball.x = geom.rightWall - r
    ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION
  }

  const minDist = r + geom.pegRadius
  const minDistSq = minDist * minDist
  for (const peg of pegs) {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distSq = dx * dx + dy * dy
    if (distSq < minDistSq && distSq > 0.0001) {
      const dist = Math.sqrt(distSq)
      const nx = dx / dist
      const ny = dy / dist
      const overlap = minDist - dist
      ball.x += nx * overlap
      ball.y += ny * overlap

      const vDotN = ball.vx * nx + ball.vy * ny
      if (vDotN < 0) {
        ball.vx -= (1 + PEG_RESTITUTION) * vDotN * nx
        ball.vy -= (1 + PEG_RESTITUTION) * vDotN * ny
        // 跳ね返りの「向き」だけをプランに合わせる。丸いペグでの左右は
        // 現実でもほぼコイントスなので、向きの選択自体は不自然に見えない。
        // 大きさは次の段までに半マス移動できる速度(hopVx)を基準に、
        // 揺らぎを持たせつつ上限も設けて暴れすぎを防ぐ。
        const dir = ball.plan[peg.row]
        const mag = Math.min(
          Math.max(Math.abs(ball.vx), geom.hopVx * (0.9 + rng() * 0.5)),
          geom.hopVx * 2.2
        )
        ball.vx = dir * mag
        peg.hitAt = nowMs
      }
    }
  }

  ball.trail.push({ x: ball.x, y: ball.y })
  if (ball.trail.length > TRAIL_LEN) ball.trail.shift()
}

/** 1サブステップ進める。着地完了で ball.settled = true になる。 */
export function advanceBall(ball: Ball, dt: number, geom: Geometry, pegs: Peg[], rng: Rng, nowMs: number): void {
  if (ball.settled) return
  if (steerBall(ball, geom, dt)) return
  stepBall(ball, dt, geom, pegs, rng, nowMs)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/plinko-engine.test.ts`
Expected: PASS(3段数 × 全バケット × 3シード。数秒かかる)

- [ ] **Step 5: Commit**

```powershell
git add src/lib/plinko-engine.ts src/lib/plinko-engine.test.ts
git commit -m "feat(plinko): port physics simulation core with trajectory-quality tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: エンジンの Canvas 描画+ファクトリ(plinko-engine.ts 後半)

**Files:**
- Modify: `src/lib/plinko-engine.ts`(末尾に追記)

**Interfaces:**
- Consumes: Task 3 の純粋関数群
- Produces(Plinko ページが使用):
  - `type PlinkoEngineOptions = { rows: number; multipliers: number[]; onBallLanded: (r: { bucket: number; payload: unknown }) => void }`
  - `type PlinkoEngine = { drop(targetBucket: number, payload?: unknown): void; resize(): void; destroy(): void; ballsInFlight(): number }`
  - `createPlinkoEngine(canvas: HTMLCanvasElement, opts: PlinkoEngineOptions): PlinkoEngine`
  - 挙動: `destroy()`/`resize()` は飛行中の玉があれば先に `onBallLanded` を発火してから盤面を破棄/再構築する(配当はサーバーで確定済みのため取りこぼさない)

- [ ] **Step 1: 実装を追記**

`src/lib/plinko-engine.ts` の末尾に以下を追加(school_repo js/plinko.js §6〜8 の描画・ループの移植):

```ts
// ============================================================
// Canvas 描画+エンジン本体
// ============================================================

export type PlinkoEngineOptions = {
  rows: number
  multipliers: number[]
  onBallLanded: (r: { bucket: number; payload: unknown }) => void
}

export type PlinkoEngine = {
  drop(targetBucket: number, payload?: unknown): void
  resize(): void
  destroy(): void
  ballsInFlight(): number
}

const GLOW_MS = 420
const FLASH_MS = 500

const COLOR_STOPS: [number, number, number][] = [
  [255, 210, 68], // 中央: 黄
  [255, 150, 60], // 中間: 橙
  [255, 68, 90], // 端: 赤
]

function bucketColor(t: number): [number, number, number] {
  const seg = t * (COLOR_STOPS.length - 1)
  const i = Math.min(COLOR_STOPS.length - 2, Math.floor(seg))
  const f = seg - i
  const a = COLOR_STOPS[i]
  const b = COLOR_STOPS[i + 1]
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]
}

function rgb(c: [number, number, number], alpha = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`
}

function formatMult(m: number): string {
  return (m >= 10 ? m.toFixed(0) : m.toFixed(m < 1 ? 2 : 1)) + 'x'
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

export function createPlinkoEngine(canvas: HTMLCanvasElement, opts: PlinkoEngineOptions): PlinkoEngine {
  const ctx = canvas.getContext('2d')!
  const rng: Rng = Math.random
  let geom: Geometry
  let pegs: Peg[]
  let balls: Ball[] = []
  let bucketFlash: number[] = []
  let dpr = 1
  let rafId = 0
  let lastTs = 0
  let destroyed = false

  function rebuild() {
    const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 400
    geom = computeGeometry(opts.rows, cssWidth)
    pegs = layoutPegs(geom)
    bucketFlash = new Array(geom.buckets).fill(0)
    balls = []
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(geom.totalHeight * dpr)
    canvas.style.height = geom.totalHeight + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // 飛行中の玉の配当はサーバーで確定済み。盤面を壊す前に必ず通知する。
  function flushInFlight() {
    for (const ball of balls) {
      opts.onBallLanded({ bucket: ball.targetBucket, payload: ball.payload })
    }
    balls = []
  }

  function drawPegs(now: number) {
    for (const peg of pegs) {
      const since = now - peg.hitAt
      const t = since < GLOW_MS ? 1 - since / GLOW_MS : 0
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, geom.pegRadius * (1 + t * 0.9), 0, Math.PI * 2)
      if (t > 0) {
        ctx.shadowBlur = 22 * t
        ctx.shadowColor = 'rgba(160,220,255,0.95)'
        ctx.fillStyle = `rgba(${lerp(230, 255, t)}, ${lerp(236, 250, t)}, 255, 1)`
      } else {
        ctx.shadowBlur = 3
        ctx.shadowColor = 'rgba(120,160,255,0.35)'
        ctx.fillStyle = 'rgba(226,232,245,0.9)'
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  function drawBalls() {
    for (const ball of balls) {
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i]
        ctx.beginPath()
        ctx.arc(p.x, p.y, geom.ballRadius * 0.7, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,214,110,${(i / ball.trail.length) * 0.25})`
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, geom.ballRadius, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(
        ball.x - geom.ballRadius * 0.3,
        ball.y - geom.ballRadius * 0.3,
        1,
        ball.x,
        ball.y,
        geom.ballRadius
      )
      grad.addColorStop(0, '#fff8e0')
      grad.addColorStop(1, '#ffb238')
      ctx.fillStyle = grad
      ctx.shadowBlur = 10
      ctx.shadowColor = 'rgba(255,178,56,0.7)'
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  function drawBuckets(now: number) {
    const mult = opts.multipliers
    const y = geom.boardHeight
    const minM = Math.min(...mult)
    const maxM = Math.max(...mult)
    for (let k = 0; k < mult.length; k++) {
      const x0 = geom.leftWall + k * geom.D
      const t =
        maxM === minM
          ? 0
          : (Math.log(mult[k] + 0.05) - Math.log(minM + 0.05)) /
            (Math.log(maxM + 0.05) - Math.log(minM + 0.05))
      const flashT = bucketFlash[k] ? Math.max(0, 1 - (now - bucketFlash[k]) / FLASH_MS) : 0
      roundRect(ctx, x0 + 1, y, geom.D - 2, geom.bucketBarHeight, 6)
      ctx.fillStyle = rgb(bucketColor(t), 0.92)
      if (flashT > 0) {
        ctx.shadowBlur = 26 * flashT
        ctx.shadowColor = 'rgba(255,255,255,0.9)'
      }
      ctx.fill()
      ctx.shadowBlur = 0
      if (flashT > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashT * 0.5})`
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(10,10,20,0.85)'
      ctx.font = `700 ${Math.max(9, geom.D * 0.24)}px 'Noto Sans JP', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(formatMult(mult[k]), x0 + geom.D / 2, y + geom.bucketBarHeight / 2 + 1)
    }
  }

  function draw(now: number) {
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.strokeStyle = 'rgba(120,160,255,0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(geom.leftWall - 4, 2, geom.rightWall - geom.leftWall + 8, geom.boardHeight)
    ctx.restore()
    drawPegs(now)
    drawBalls()
    drawBuckets(now)
  }

  function loop(ts: number) {
    if (destroyed) return
    rafId = requestAnimationFrame(loop)
    if (!lastTs) lastTs = ts
    let frameDt = (ts - lastTs) / 1000
    lastTs = ts
    if (frameDt > 0.05) frameDt = 0.05 // タブ復帰時などの大ジャンプを抑制

    if (frameDt > 0) {
      const steps = Math.max(1, Math.ceil(frameDt / SUBSTEP))
      const dt = frameDt / steps
      const now = performance.now()
      for (let s = 0; s < steps; s++) {
        for (const ball of balls) advanceBall(ball, dt, geom, pegs, rng, now)
      }
      const remain: Ball[] = []
      for (const ball of balls) {
        if (ball.settled) {
          bucketFlash[ball.targetBucket] = now
          opts.onBallLanded({ bucket: ball.targetBucket, payload: ball.payload })
        } else {
          remain.push(ball)
        }
      }
      balls = remain
    }
    draw(performance.now())
  }

  rebuild()
  rafId = requestAnimationFrame(loop)

  return {
    drop(targetBucket, payload = null) {
      balls.push(createBall(geom, targetBucket, payload, rng))
    },
    resize() {
      flushInFlight()
      rebuild()
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(rafId)
      flushInFlight()
    },
    ballsInFlight: () => balls.length,
  }
}
```

- [ ] **Step 2: 型チェックとテストが通ることを確認**

Run: `npx tsc --noEmit; npm test`
Expected: 型エラーなし、既存+新規テスト全 PASS

- [ ] **Step 3: Commit**

```powershell
git add src/lib/plinko-engine.ts
git commit -m "feat(plinko): add canvas renderer and engine factory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: /plinko ゲームページ+ルート+エラーマッピング

**Files:**
- Create: `src/pages/Plinko.tsx`
- Modify: `src/store/useStore.ts`(`mapRpcError` を export し、新コードを追加)
- Modify: `src/App.tsx`(lazy import と `/plinko` ルート)

**Interfaces:**
- Consumes: `createPlinkoEngine`(Task 4)、`ROW_OPTIONS`(Task 2)、RPC `plinko_play`(Task 1)、`useAuth`(session/profile/loadProfile)、`LoginModal`
- Produces: ルート `/plinko`(PlinkoBanner のリンク先)

- [ ] **Step 1: mapRpcError に新コードを追加して export する**

`src/store/useStore.ts` の `function mapRpcError(msg: string): string {` 行を `export function mapRpcError(msg: string): string {` に変更し、`if (msg.includes('INSUFFICIENT_POINTS'))` の行の直前に以下を追加:

```ts
  if (msg.includes('BAD_BET')) return 'ベット額は1〜10,000の範囲で入力してください'
  if (msg.includes('BAD_ROWS')) return '段数の設定が見つかりません'
  if (msg.includes('BAD_MULTIPLIERS')) return '倍率テーブルが不正です'
  if (msg.includes('RTP_OUT_OF_RANGE')) return '還元率は10%〜150%の範囲にしてください'
```

- [ ] **Step 2: ゲームページを作成**

`src/pages/Plinko.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dices, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { mapRpcError } from '../store/useStore'
import { createPlinkoEngine, type PlinkoEngine } from '../lib/plinko-engine'
import { calcRTP } from '../lib/plinko-odds'
import LoginModal from '../components/LoginModal'

type PlayResult = { bucket: number; multiplier: number; payout: number; balance: number }
type BallPayload = PlayResult & { bet: number }
type HistoryEntry = { multiplier: number; bet: number; payout: number }

const MIN_BET = 1
const MAX_BET = 10000
const HISTORY_LIMIT = 12

function clampBet(v: number): number {
  if (!Number.isFinite(v)) return MIN_BET
  return Math.min(MAX_BET, Math.max(MIN_BET, Math.round(v)))
}

export default function Plinko() {
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const loadProfile = useAuth((s) => s.loadProfile)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<PlinkoEngine | null>(null)
  const [config, setConfig] = useState<Record<number, number[]> | null>(null)
  const [rows, setRows] = useState(12)
  const [bet, setBet] = useState(10)
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState('')
  const [dropping, setDropping] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // 倍率テーブル(plinko_config)を取得。サーバーの配当計算と必ず一致する。
  useEffect(() => {
    supabase
      .from('plinko_config')
      .select('rows_count, multipliers')
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, number[]> = {}
        for (const row of data) map[row.rows_count] = (row.multipliers as (number | string)[]).map(Number)
        setConfig(map)
      })
  }, [])

  // 飛行中の玉がないときだけ profile の残高と同期(飛行中はローカルで増減)
  useEffect(() => {
    if (profile && (engineRef.current?.ballsInFlight() ?? 0) === 0) {
      setBalance(profile.points)
    }
    if (!profile) setBalance(null)
  }, [profile])

  const handleLanded = useCallback(
    (r: { bucket: number; payload: unknown }) => {
      const res = r.payload as BallPayload | null
      if (!res) return
      setHistory((h) => [{ multiplier: res.multiplier, bet: res.bet, payout: res.payout }, ...h].slice(0, HISTORY_LIMIT))
      setBalance((b) => (b == null ? b : Math.round((b + res.payout) * 100) / 100))
      if ((engineRef.current?.ballsInFlight() ?? 0) === 0) loadProfile()
    },
    [loadProfile]
  )

  // 盤面(rows/config)が決まったらエンジンを生成。変更時は作り直す。
  useEffect(() => {
    const canvas = canvasRef.current
    const multipliers = config?.[rows]
    if (!canvas || !multipliers) return
    const engine = createPlinkoEngine(canvas, { rows, multipliers, onBallLanded: handleLanded })
    engineRef.current = engine
    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      engine.destroy()
      engineRef.current = null
    }
  }, [config, rows, handleLanded])

  async function handleDrop() {
    if (!session || dropping) return
    const b = clampBet(bet)
    setBet(b)
    setError('')
    setDropping(true)
    const { data, error } = await supabase.rpc('plinko_play', { p_bet: b, p_rows: rows })
    setDropping(false)
    if (error) {
      setError(mapRpcError(error.message))
      return
    }
    const res = data as PlayResult
    setBalance((x) => (x == null ? x : Math.round((x - b) * 100) / 100))
    engineRef.current?.drop(res.bucket, { ...res, bet: b } satisfies BallPayload)
  }

  const multipliers = config?.[rows]
  const rtp = multipliers ? calcRTP(rows, multipliers) : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
          <Dices size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Plinko</h1>
          <p className="text-text-muted text-sm">
            たまには運任せ。ポイントを賭けて玉を落とそう
            {rtp != null && <span className="ml-2">還元率 {(rtp * 100).toFixed(1)}%</span>}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-text-muted">残高</p>
          <p className="text-lg font-bold text-text">
            {balance != null ? `${balance.toLocaleString()} pt` : '—'}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-3 mb-4">
        <canvas ref={canvasRef} className="w-full block" />
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">ベット(pt)</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={MIN_BET}
                max={MAX_BET}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                onBlur={() => setBet(clampBet(bet))}
                className="w-24 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
              />
              <button onClick={() => setBet(clampBet(bet / 2))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">1/2</button>
              <button onClick={() => setBet(clampBet(bet * 2))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">x2</button>
              <button onClick={() => setBet(clampBet(balance ?? MIN_BET))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">MAX</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">段数</label>
            <select
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value, 10))}
              className="px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            >
              {config &&
                Object.keys(config)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <option key={r} value={r}>
                      {r} 段
                    </option>
                  ))}
            </select>
          </div>
          {session ? (
            <button
              onClick={handleDrop}
              disabled={dropping || !config || balance == null || balance < MIN_BET}
              className="ml-auto px-8 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              DROP
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors"
            >
              <LogIn size={15} /> ログインして遊ぶ
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-no">{error}</p>}
      </div>

      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {history.map((h, i) => {
            const win = h.payout - h.bet >= 0
            return (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded-full border ${
                  win ? 'bg-yes/10 text-yes border-yes/30' : 'bg-no/10 text-no border-no/30'
                }`}
              >
                {h.multiplier >= 10 ? h.multiplier.toFixed(0) : h.multiplier.toFixed(h.multiplier < 1 ? 2 : 1)}x
              </span>
            )
          })}
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: ルートを追加**

`src/App.tsx`:
- lazy import 群(`const Faq = ...` の後)に追加:

```tsx
const Plinko = lazy(() => import('./pages/Plinko'))
```

- `<Route path="/ranking" ...>` の行の直後に追加:

```tsx
          <Route path="/plinko" element={<L><Plinko /></L>} />
```

- [ ] **Step 4: 型チェック+ビルド確認**

Run: `npx tsc --noEmit; npm run build`
Expected: エラーなし

- [ ] **Step 5: Commit**

```powershell
git add src/pages/Plinko.tsx src/store/useStore.ts src/App.tsx
git commit -m "feat(plinko): add /plinko game page wired to plinko_play RPC

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: ホームのバナー「たまには運任せにしてみる？」

**Files:**
- Create: `src/components/PlinkoBanner.tsx`
- Modify: `src/pages/MarketList.tsx`(FeaturedCarousel の直後に挿入)

**Interfaces:**
- Consumes: ルート `/plinko`(Task 5)
- Produces: `PlinkoBanner`(props なし)

- [ ] **Step 1: バナーを作成**

`src/components/PlinkoBanner.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Dices, ArrowRight } from 'lucide-react'

export default function PlinkoBanner() {
  return (
    <Link
      to="/plinko"
      className="relative block mb-6 rounded-lg border border-accent/30 bg-gradient-to-r from-accent/15 via-surface to-surface hover:border-accent/60 transition-colors overflow-hidden group"
    >
      <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
        PR
      </span>
      <div className="flex items-center gap-4 p-5">
        <div className="w-12 h-12 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0">
          <Dices size={26} />
        </div>
        <div className="min-w-0 pr-8">
          <p className="text-base font-bold text-text">たまには運任せにしてみる？</p>
          <p className="text-xs text-text-muted mt-0.5">Plinko でポイントを増やそう 🎲 賭けて、落として、当てるだけ</p>
        </div>
        <ArrowRight size={18} className="ml-auto text-accent shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: MarketList に挿入**

`src/pages/MarketList.tsx`:
- import 群(`import BottomSheet ...` の後)に追加:

```tsx
import PlinkoBanner from '../components/PlinkoBanner'
```

- `{featured.length > 0 && <FeaturedCarousel markets={featured} />}` の直後の行に追加:

```tsx
      {isDefaultView && <PlinkoBanner />}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit; npm run build`
Expected: エラーなし

- [ ] **Step 4: Commit**

```powershell
git add src/components/PlinkoBanner.tsx src/pages/MarketList.tsx
git commit -m "feat(plinko): add home banner linking to /plinko

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 管理者ページ(還元率設定)

**Files:**
- Create: `src/pages/admin/Plinko.tsx`
- Modify: `src/App.tsx`(admin ルート)
- Modify: `src/components/Navbar.tsx`(admin リンク配列に追加)

**Interfaces:**
- Consumes: `generateMultipliers` / `calcRTP` / `ROW_OPTIONS` / `GROWTH`(Task 2)、RPC `admin_plinko_set_multipliers`(Task 1)、`mapRpcError`(Task 5)
- Produces: ルート `/admin/plinko`

- [ ] **Step 1: 管理ページを作成**

`src/pages/admin/Plinko.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStore, mapRpcError } from '../../store/useStore'
import { generateMultipliers, calcRTP, ROW_OPTIONS, GROWTH } from '../../lib/plinko-odds'

type ConfigRow = { rows_count: number; multipliers: number[]; updated_at: string }

// 8段⇔16段の線形補間で各段数の狙いRTPを出す
function targetRtp(rows: number, rtp8: number, rtp16: number): number {
  const t = (rows - ROW_OPTIONS[0]) / (ROW_OPTIONS[ROW_OPTIONS.length - 1] - ROW_OPTIONS[0])
  return rtp8 + (rtp16 - rtp8) * t
}

export default function AdminPlinko() {
  const { currentUser } = useStore()
  const user = currentUser()
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [rtp8, setRtp8] = useState(95)
  const [rtp16, setRtp16] = useState(90)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data } = await supabase
      .from('plinko_config')
      .select('rows_count, multipliers, updated_at')
      .order('rows_count')
    if (!data) return
    const rows = data.map((r) => ({ ...r, multipliers: (r.multipliers as (number | string)[]).map(Number) }))
    setConfig(rows)
    const lo = rows.find((r) => r.rows_count === ROW_OPTIONS[0])
    const hi = rows.find((r) => r.rows_count === ROW_OPTIONS[ROW_OPTIONS.length - 1])
    if (lo) setRtp8(Math.round(calcRTP(lo.rows_count, lo.multipliers) * 1000) / 10)
    if (hi) setRtp16(Math.round(calcRTP(hi.rows_count, hi.multipliers) * 1000) / 10)
  }

  useEffect(() => {
    load()
  }, [])

  const preview = useMemo(
    () =>
      ROW_OPTIONS.map((rows) => {
        const mult = generateMultipliers(rows, targetRtp(rows, rtp8, rtp16) / 100, GROWTH)
        return { rows, mult, rtp: calcRTP(rows, mult) }
      }),
    [rtp8, rtp16]
  )

  const hasOver100 = preview.some((p) => p.rtp > 1)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    for (const p of preview) {
      const { error } = await supabase.rpc('admin_plinko_set_multipliers', {
        p_rows: p.rows,
        p_multipliers: p.mult,
      })
      if (error) {
        setMessage({ ok: false, text: `${p.rows}段の保存に失敗: ${mapRpcError(error.message)}` })
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setMessage({ ok: true, text: '保存しました。以後のプレイに新しい還元率が適用されます' })
    load()
  }

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Plinko設定</h1>
        <p className="text-text-muted text-sm">還元率(RTP)の変更。抽選の分布は常に公正な二項分布のまま、マスの倍率だけが変わります</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-text-muted mb-1">8段のRTP(%)</label>
            <input
              type="number"
              step={0.5}
              min={10}
              max={150}
              value={rtp8}
              onChange={(e) => setRtp8(Number(e.target.value))}
              className="w-28 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">16段のRTP(%)</label>
            <input
              type="number"
              step={0.5}
              min={10}
              max={150}
              value={rtp16}
              onChange={(e) => setRtp16(Number(e.target.value))}
              className="w-28 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            />
          </div>
          <p className="text-xs text-text-muted">間の段数(10/12/14)は線形補間されます</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
        {hasOver100 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-400">
            <AlertTriangle size={15} /> RTPが100%を超えています。ポイントが増え続ける設定です(プロモ用)
          </p>
        )}
        {message && (
          <p className={`mt-3 flex items-center gap-1.5 text-sm ${message.ok ? 'text-yes' : 'text-no'}`}>
            {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {message.text}
          </p>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="text-left px-5 py-3 font-medium">段数</th>
              <th className="text-left px-4 py-3 font-medium">保存後の倍率テーブル(プレビュー)</th>
              <th className="text-right px-5 py-3 font-medium">実RTP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.map((p) => (
              <tr key={p.rows}>
                <td className="px-5 py-3 font-semibold text-text">{p.rows}段</td>
                <td className="px-4 py-3 text-text-muted font-mono text-xs break-all">{p.mult.join(', ')}</td>
                <td className={`px-5 py-3 text-right font-semibold ${p.rtp > 1 ? 'text-amber-400' : 'text-text'}`}>
                  {(p.rtp * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config.length > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          現在の設定の最終更新: {new Date(Math.max(...config.map((c) => +new Date(c.updated_at)))).toLocaleString('ja-JP')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ルートと管理メニューを追加**

`src/App.tsx`:
- lazy import 群(`const AdminUsers = ...` の後)に追加:

```tsx
const AdminPlinko = lazy(() => import('./pages/admin/Plinko'))
```

- `<Route path="/admin/users" ...>` の行の直後(AdminGuard 内)に追加:

```tsx
            <Route path="/admin/plinko" element={<L><AdminPlinko /></L>} />
```

`src/components/Navbar.tsx` の admin リンク配列(`{ to: '/admin/ads', label: '広告管理' },` の後)に追加:

```tsx
  { to: '/admin/plinko', label: 'Plinko設定' },
```

- [ ] **Step 3: 型チェック+ビルド確認**

Run: `npx tsc --noEmit; npm run build`
Expected: エラーなし

- [ ] **Step 4: Commit**

```powershell
git add src/pages/admin/Plinko.tsx src/App.tsx src/components/Navbar.tsx
git commit -m "feat(plinko): add admin RTP settings page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テスト+ビルド**

Run: `npm test; npm run build`
Expected: 全テスト PASS、ビルド成功

- [ ] **Step 2: マイグレーション適用(手動)**

Supabase Studio → SQL Editor で `supabase/migrate-011-plinko.sql` の内容を実行する。
これはユーザーの Supabase プロジェクトに対する操作なので、**実行はユーザーに依頼する**
(migrate-009/010 と同じ運用)。適用前でもフロントは壊れない(plinko_config が空 →
段数セレクトが空になり DROP 不可)が、E2E 確認には適用が必要。

- [ ] **Step 3: 手動 E2E チェックリスト(`npm run dev` で確認)**

- ホームに「たまには運任せにしてみる？」バナーが表示され、クリックで /plinko へ遷移する
- 未ログイン: DROP の代わりに「ログインして遊ぶ」→ LoginModal が開く
- ログイン済み: DROP で残高が即時 −bet され、玉が落ちて着地したマスと配当が一致する
- 玉の挙動: 途中でワープしない、淵の玉が不自然に中央へ引き寄せられない
- 残高不足で「ポイントが不足しています」が表示される
- 段数を変えると盤面と倍率表示が変わる
- 管理者: /admin/plinko で RTP を変更→保存→ゲーム画面をリロードすると倍率表示が変わる
- 非管理者が /admin/plinko を開くと「管理者権限が必要です」
- Portfolio 等の既存ページが壊れていない

- [ ] **Step 4: マージ方針の確認**

`superpowers:finishing-a-development-branch` に従い、master へのマージ/PR をユーザーに確認する。

---

## Self-Review 記録

- スペック網羅: plinko_config/plinko_plays/plinko_play/admin RPC(Task 1)、odds 移植+parity テスト(Task 2)、エンジン移植+軌道品質テスト(Task 3-4)、/plinko ページ+ログイン誘導+エラーマッピング(Task 5)、バナー(Task 6)、管理ページ+ナビ(Task 7)、非スコープ(XP なし・school_repo 無変更)は全タスクで遵守 — 漏れなし
- プレースホルダー: なし(全ステップに完全なコード/コマンドを記載)
- 型整合: `createPlinkoEngine`/`PlinkoEngine`/`onBallLanded` のシグネチャは Task 3/4/5 で一致。`mapRpcError` の export は Task 5 で行い Task 7 が消費(実行順で満たされる)
