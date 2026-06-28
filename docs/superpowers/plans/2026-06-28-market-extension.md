# Market Extension（締切延長／再開）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者が `closed`（締切済み・解決待ち）の市場を、新しい未来の締切で `open` に戻して取引を再開できるようにする。

**Architecture:** 状態が動く操作をサーバー権威の `security definer` RPC で行う既存方針（`resolve_market` 等）に倣い、延長を RPC `extend_market` として実装。DB が「admin 限定・`closed` 限定・未来締切」を強制する。フロントは型・ストア・ローカルクライアント・管理画面・市場詳細に最小変更を加える。

**Tech Stack:** React 18 + TypeScript + Vite, Zustand, Supabase (PostgREST + pg_cron + RLS), vitest, Tailwind, date-fns, lucide-react。

## Global Constraints

- 対象は `status === 'closed'` の市場のみ。`open` / `pending` / `resolved` は延長不可。
- 新締切は厳密に未来（`> now()`）。過去/現在は DB・ローカル・UI すべてで拒否する。
- 取引再開には `status='open'` と未来 `deadline` の両方が必要（`buy_shares`/`sell_shares` の二重ガードのため）。
- 既存の命名・スタイルに合わせる：snake_case を DB 層、camelCase をアプリ層、エラーは `mapRpcError` で和訳。
- 例外名（DB→クライアント共通）：`NOT_CLOSED`、`DEADLINE_IN_PAST`。既存例外（`ADMIN_REQUIRED` 等）は再利用。
- 軽量記録のみ：`extended_count`（回数）と `last_extended_at`（最終延長日時）。理由ログテーブルは作らない。

---

### Task 1: DB マイグレーション + schema 正本

**Files:**
- Create: `supabase/migrate-007-extend-market.sql`
- Modify: `supabase/schema.sql`（markets テーブル定義に2列追加、RPC セクションに `extend_market` 追加）

**Interfaces:**
- Produces: SQL 関数 `public.extend_market(p_market_id uuid, p_new_deadline timestamptz) returns void`。
  例外: `AUTH_REQUIRED` / `ADMIN_REQUIRED` / `MARKET_NOT_FOUND` / `NOT_CLOSED` / `DEADLINE_IN_PAST`。
  markets に列 `extended_count int not null default 0`、`last_extended_at timestamptz`。

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrate-007-extend-market.sql`:
```sql
-- ============================================================================
-- migrate-007: 市場の締切延長／再開（extend_market）
-- closed の市場を、新しい未来の締切で open に戻す。Supabase Studio で実行。
-- ============================================================================

-- 1) 軽量記録の列
alter table public.markets add column if not exists extended_count   int not null default 0;
alter table public.markets add column if not exists last_extended_at timestamptz;

-- 2) RPC（admin 限定・closed 限定・未来締切を強制）
create or replace function public.extend_market(p_market_id uuid, p_new_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  m public.markets%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'admin' then raise exception 'ADMIN_REQUIRED'; end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found then raise exception 'MARKET_NOT_FOUND'; end if;
  if m.status <> 'closed' then raise exception 'NOT_CLOSED'; end if;
  if p_new_deadline <= now() then raise exception 'DEADLINE_IN_PAST'; end if;

  update public.markets
     set status           = 'open',
         deadline         = p_new_deadline,
         extended_count   = extended_count + 1,
         last_extended_at = now()
   where id = p_market_id;
end;
$$;
```

- [ ] **Step 2: schema.sql の正本にも反映**

`supabase/schema.sql` の `create table ... public.markets (...)` 内、`volume` 行の直後に追加:
```sql
  extended_count   numeric not null default 0,
  last_extended_at timestamptz,
```
（既存列は `numeric` を多用しているため `extended_count` も `numeric` で揃える。マイグレーションの `int` と互換。）

さらに `resolve_market` 関数定義の直後に、Step 1 の `extend_market` 関数定義（`create or replace function public.extend_market ...`）をそのまま貼り付ける。

- [ ] **Step 3: 構文を目視確認**

`begin/end`、`raise exception` の例外名（`NOT_CLOSED` / `DEADLINE_IN_PAST`）、`for update` ロックがあること、`closed` 以外と過去締切を弾く分岐があることを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrate-007-extend-market.sql supabase/schema.sql
git commit -m "feat(db): extend_market RPC and markets extension columns"
```

> 適用は手動（ロールアウト時に Supabase Studio → SQL Editor で `migrate-007-extend-market.sql` を実行）。`closed → open` で既存の `seed_initial_price` トリガーが発火し price_history に継続点が入る（追加コード不要）。

---

### Task 2: 締切プリセット純関数（TDD）

**Files:**
- Create: `src/lib/deadline.ts`
- Test: `src/lib/deadline.test.ts`

**Interfaces:**
- Produces: `type DeadlinePreset = '1d' | '3d' | '1w'`、`addDeadline(base: Date, preset: DeadlinePreset): Date`。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/deadline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addDeadline } from './deadline'

describe('addDeadline', () => {
  const base = new Date('2026-06-28T00:00:00.000Z')

  it('+1日', () => {
    expect(addDeadline(base, '1d').toISOString()).toBe('2026-06-29T00:00:00.000Z')
  })
  it('+3日', () => {
    expect(addDeadline(base, '3d').toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
  it('+1週間', () => {
    expect(addDeadline(base, '1w').toISOString()).toBe('2026-07-05T00:00:00.000Z')
  })
  it('base を破壊しない', () => {
    addDeadline(base, '1w')
    expect(base.toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- deadline`
Expected: FAIL（`addDeadline` が未定義／`./deadline` が解決できない）

- [ ] **Step 3: 最小実装**

`src/lib/deadline.ts`:
```ts
export type DeadlinePreset = '1d' | '3d' | '1w'

const PRESET_MS: Record<DeadlinePreset, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
}

/** base から preset 分だけ進めた新しい Date を返す（base は破壊しない）。 */
export function addDeadline(base: Date, preset: DeadlinePreset): Date {
  return new Date(base.getTime() + PRESET_MS[preset])
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- deadline`
Expected: PASS（4件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/deadline.ts src/lib/deadline.test.ts
git commit -m "feat: addDeadline preset helper"
```

---

### Task 3: 型 + ストアのマッピング・延長アクション

**Files:**
- Modify: `src/types.ts`（`Market` に2フィールド追加）
- Modify: `src/store/useStore.ts`（`mapMarket`、`mapRpcError`、`StoreActions` 型、`extendMarket` 実装）

**Interfaces:**
- Consumes: `n(v): number`（既存）、`mapRpcError(msg): string`（既存・拡張）、`get().loadAll(['markets'])`（既存）。
- Produces: `Market.extendedCount: number`、`Market.lastExtendedAt: string | null`。
  ストアアクション `extendMarket(marketId: string, newDeadlineISO: string): Promise<void>`。

- [ ] **Step 1: `Market` 型にフィールド追加**

`src/types.ts` の `Market` 型、`priceHistory` 行の直前に追加:
```ts
  /** 締切延長された回数（0 = 未延長） */
  extendedCount: number
  /** 最終延長日時（ISO, 未延長は null） */
  lastExtendedAt: string | null
```

- [ ] **Step 2: `mapMarket` にマッピング追加**

`src/store/useStore.ts` の `mapMarket` 内、`imageUrl: m.image_url ?? undefined,` の直後に追加:
```ts
    extendedCount: n(m.extended_count),
    lastExtendedAt: m.last_extended_at ?? null,
```

- [ ] **Step 3: `mapRpcError` に和訳追加**

`src/store/useStore.ts` の `mapRpcError`、`ADMIN_REQUIRED` の行の直後に追加:
```ts
  if (msg.includes('NOT_CLOSED')) return '締切済みの市場のみ延長できます'
  if (msg.includes('DEADLINE_IN_PAST')) return '新しい締切は未来の日時にしてください'
```

- [ ] **Step 4: アクション型を宣言**

`src/store/useStore.ts` の型定義（`resolveMarket: (marketId: string, result: 'YES' | 'NO') => Promise<void>` の行）の直後に追加:
```ts
  extendMarket: (marketId: string, newDeadlineISO: string) => Promise<void>
```

- [ ] **Step 5: アクションを実装**

`src/store/useStore.ts` の `resolveMarket` 実装（`await refreshProfile()` で閉じる `},`）の直後に追加:
```ts
  extendMarket: async (marketId, newDeadlineISO) => {
    const { error } = await supabase.rpc('extend_market', {
      p_market_id: marketId,
      p_new_deadline: newDeadlineISO,
    })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },
```

- [ ] **Step 6: 型チェックが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラー無し（`extendMarket` 未定義や `Market` 必須フィールド不足が出ないこと）

- [ ] **Step 7: コミット**

```bash
git add src/types.ts src/store/useStore.ts
git commit -m "feat(store): extendMarket action + extension fields mapping"
```

---

### Task 4: ローカルクライアントの extend_market（TDD）

**Files:**
- Modify: `src/lib/localClient.ts`（local `Market` 型に2列、seed 市場に初期値、`rpc()` に case、`extendMarket` 関数）
- Test: `src/lib/localClient.extend.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()`、`profile(id)`、`db`、`save(db)`、`emit(table, type, row)`、`nowIso()`、`priceSeq`、`currentPrice(qYes,qNo,b)`、`PricePoint`、`createLocalClient()`、`switchLocalUser(id)`、`ADMIN_ID`、`AYANO_ID`、`resetLocalDb()`（すべて既存・エクスポート済み）。
- Produces: `createLocalClient().rpc('extend_market', { p_market_id, p_new_deadline })` が本番 RPC と同じ規則で動く。

- [ ] **Step 1: local `Market` 型に列を追加**

`src/lib/localClient.ts` の `type Market = { ... }`（24-39行）、`image_url: string | null` の直後に追加:
```ts
  extended_count: number
  last_extended_at: string | null
```

- [ ] **Step 2: seed 市場に初期値を追加**

`src/lib/localClient.ts` の seed 市場を構築している箇所（`const markets: Market[] = [ ... ]` 付近、127行目）で各市場オブジェクトに以下を含める（既存の `image_url` などと並べて）:
```ts
    extended_count: 0,
    last_extended_at: null,
```
（オブジェクトが複数あるすべてに追加。`map` で生成している場合はその返却オブジェクトに追加。）

- [ ] **Step 3: 失敗するテストを書く**

`src/lib/localClient.extend.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalClient, switchLocalUser, resetLocalDb, ADMIN_ID, AYANO_ID } from './localClient'

const client = createLocalClient()
const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

// closed な市場 ID を1つ用意するヘルパ（seed に closed が無ければ作る）。
async function aClosedMarketId(): Promise<string> {
  switchLocalUser(ADMIN_ID)
  const { data } = await client.from('markets').select('*')
  const rows = (data ?? []) as Array<{ id: string; status: string }>
  const closed = rows.find((m) => m.status === 'closed')
  if (closed) return closed.id
  // open を1つ closed にして使う
  const open = rows.find((m) => m.status === 'open')!
  await client.from('markets').update({ status: 'closed' }).eq('id', open.id)
  return open.id
}

describe('rpc extend_market', () => {
  beforeEach(() => resetLocalDb())

  it('admin は closed 市場を未来締切で open に戻し、extended_count を増やす', async () => {
    switchLocalUser(ADMIN_ID)
    const id = await aClosedMarketId()
    const newDeadline = future()
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: newDeadline })
    expect(error).toBeNull()

    const { data } = await client.from('markets').select('*').eq('id', id)
    const m = (data as any[])[0]
    expect(m.status).toBe('open')
    expect(m.deadline).toBe(newDeadline)
    expect(m.extended_count).toBe(1)
    expect(m.last_extended_at).not.toBeNull()
  })

  it('過去の締切は DEADLINE_IN_PAST で拒否', async () => {
    switchLocalUser(ADMIN_ID)
    const id = await aClosedMarketId()
    const past = new Date(Date.now() - 1000).toISOString()
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: past })
    expect(error?.message).toContain('DEADLINE_IN_PAST')
  })

  it('closed 以外は NOT_CLOSED で拒否', async () => {
    switchLocalUser(ADMIN_ID)
    const { data } = await client.from('markets').select('*')
    const open = (data as any[]).find((m) => m.status === 'open')
    const { error } = await client.rpc('extend_market', { p_market_id: open.id, p_new_deadline: future() })
    expect(error?.message).toContain('NOT_CLOSED')
  })

  it('非 admin は ADMIN_REQUIRED で拒否', async () => {
    const id = await aClosedMarketId() // 内部で一旦 admin に切替
    switchLocalUser(AYANO_ID)
    const { error } = await client.rpc('extend_market', { p_market_id: id, p_new_deadline: future() })
    expect(error?.message).toContain('ADMIN_REQUIRED')
  })
})
```

> 注: `aClosedMarketId` が `AYANO_ID` がadminでない前提に依存。もし seed で AYANO が admin の場合は、テスト内の非adminユーザーを実際の一般ユーザー ID に差し替える（`getLocalUsers()` で role!=='admin' を1人選ぶ）。

- [ ] **Step 4: 失敗を確認**

Run: `npm test -- localClient.extend`
Expected: FAIL（`UNKNOWN_RPC:extend_market` を含むエラー、または `extend_market` case 無しで全 it 失敗）

- [ ] **Step 5: `rpc()` に case を追加**

`src/lib/localClient.ts` の `rpc()` switch、`case 'resolve_market':` ブロックの直後に追加:
```ts
      case 'extend_market':
        extendMarket(params.p_market_id as string, params.p_new_deadline as string)
        return { data: null, error: null }
```

- [ ] **Step 6: `extendMarket` 関数を実装**

`src/lib/localClient.ts` の `resolveMarket` 関数定義の直後に追加:
```ts
function extendMarket(marketId: string, newDeadlineISO: string) {
  requireAdmin()
  const m = db.markets.find((x) => x.id === marketId)
  if (!m) throw new Error('MARKET_NOT_FOUND')
  if (m.status !== 'closed') throw new Error('NOT_CLOSED')
  if (new Date(newDeadlineISO).getTime() <= Date.now()) throw new Error('DEADLINE_IN_PAST')

  m.status = 'open'
  m.deadline = newDeadlineISO
  m.extended_count = (m.extended_count ?? 0) + 1
  m.last_extended_at = nowIso()

  // 本番の seed_initial_price トリガー相当（closed→open でチャート継続点を打つ）
  const point: PricePoint = {
    id: ++priceSeq,
    market_id: marketId,
    t: nowIso(),
    yes: currentPrice(m.q_yes, m.q_no, m.b).yes,
  }
  db.price_history.push(point)

  save(db)
  emit('markets', 'UPDATE', m as unknown as Record<string, unknown>)
  emit('price_history', 'INSERT', point as unknown as Record<string, unknown>)
}
```

- [ ] **Step 7: テストが通ることを確認**

Run: `npm test -- localClient.extend`
Expected: PASS（4件）。AYANO が admin だった場合は Step 3 の注に従いテストの非adminユーザーを修正して再実行。

- [ ] **Step 8: コミット**

```bash
git add src/lib/localClient.ts src/lib/localClient.extend.test.ts
git commit -m "feat(local): extend_market rpc mirror + tests"
```

---

### Task 5: 管理画面に「延長」UI

**Files:**
- Modify: `src/pages/admin/Markets.tsx`

**Interfaces:**
- Consumes: `useStore().extendMarket`（Task 3）、`addDeadline`（Task 2）。

- [ ] **Step 1: import とストア取得・ローカルステートを追加**

`src/pages/admin/Markets.tsx` 冒頭の import に追加:
```ts
import { addDeadline, type DeadlinePreset } from '../../lib/deadline'
```
`useStore()` の分割代入に `extendMarket` を追加（`closeMarket, resolveMarket` の隣）:
```ts
  const { markets, closeMarket, resolveMarket, extendMarket, currentUser } = useStore()
```
`resolving` ステートの直後に追加:
```ts
  const [extending, setExtending] = useState<string | null>(null)
  const [customDeadline, setCustomDeadline] = useState('')
```

- [ ] **Step 2: プリセット適用ハンドラを追加**

`if (user?.role !== 'admin')` ガードの直前に追加:
```ts
  const applyPreset = (marketId: string, preset: DeadlinePreset) => {
    extendMarket(marketId, addDeadline(new Date(), preset).toISOString())
    setExtending(null)
    setCustomDeadline('')
  }
  const applyCustom = (marketId: string) => {
    if (!customDeadline) return
    extendMarket(marketId, new Date(customDeadline).toISOString())
    setExtending(null)
    setCustomDeadline('')
  }
```

- [ ] **Step 3: closed 行に「延長」ボタン＋インラインピッカーを追加**

`src/pages/admin/Markets.tsx` の操作セル内、`{m.status === 'open' && ( ...締切ボタン... )}` ブロックの直後に追加:
```tsx
                        {m.status === 'closed' && (
                          extending === m.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => applyPreset(m.id, '1d')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">+1日</button>
                              <button onClick={() => applyPreset(m.id, '3d')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">+3日</button>
                              <button onClick={() => applyPreset(m.id, '1w')} className="text-xs px-2 py-1 rounded-lg bg-surface-hover text-text hover:bg-border border border-border transition-colors">+1週</button>
                              <input
                                type="datetime-local"
                                value={customDeadline}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={(e) => setCustomDeadline(e.target.value)}
                                className="text-xs px-1.5 py-1 rounded-lg bg-surface text-text border border-border"
                              />
                              <button onClick={() => applyCustom(m.id)} disabled={!customDeadline} className="text-xs px-2 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition-colors disabled:opacity-40">確定</button>
                              <button onClick={() => { setExtending(null); setCustomDeadline('') }} className="text-xs px-2 py-1 text-text-muted hover:text-text transition-colors"><X size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => setExtending(m.id)} className="text-xs px-2.5 py-1 rounded-lg bg-surface-hover text-text-muted hover:bg-border border border-border transition-colors">延長</button>
                          )
                        )}
```
（`X` は既存 import 済み。）

- [ ] **Step 4: 型チェックとビルド確認**

Run: `npx tsc --noEmit`
Expected: エラー無し。

- [ ] **Step 5: コミット**

```bash
git add src/pages/admin/Markets.tsx
git commit -m "feat(admin): extend (reopen) UI with presets and custom deadline"
```

---

### Task 6: 市場詳細に「延長済み」バッジ

**Files:**
- Modify: `src/pages/MarketDetail.tsx`

**Interfaces:**
- Consumes: `market.extendedCount`（Task 3）。

- [ ] **Step 1: バッジを追加**

`src/pages/MarketDetail.tsx` のステータスバッジ群（`{market.status === 'closed' && ( ... 締切済み・解決待ち ... )}` ブロック）の直後、同じ `flex ... flex-wrap` コンテナ内に追加:
```tsx
                  {market.extendedCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                      延長済み ×{market.extendedCount}
                    </span>
                  )}
```

- [ ] **Step 2: 型チェック確認**

Run: `npx tsc --noEmit`
Expected: エラー無し。

- [ ] **Step 3: フルテスト＆ビルド**

Run: `npm test`
Expected: 既存 + 新規（deadline 4件、localClient.extend 4件）すべて PASS。
Run: `npm run build`
Expected: 成功。

- [ ] **Step 4: コミット**

```bash
git add src/pages/MarketDetail.tsx
git commit -m "feat(market): show extended-count badge on detail"
```

---

## Self-Review

**Spec coverage:**
- closed のみ延長 → Task 1（DB 強制）/ Task 4（local）/ Task 5（closed 行のみ UI）✔
- 軽量記録（extended_count / last_extended_at）→ Task 1 列追加 / Task 3 マッピング ✔
- 詳細にバッジ → Task 6 ✔
- プリセット＋日付指定 UI → Task 5 ✔
- 本番＆ローカル同挙動 → Task 1（RPC）/ Task 4（local mirror）✔
- 二重ガード・未来締切強制・cron 即クローズ回避 → Task 1（`DEADLINE_IN_PAST` + status='open'）✔
- seed_initial_price で再開チャート継続 → Task 1 注記 / Task 4 で local も点追加 ✔
- エラー和訳（NOT_CLOSED / DEADLINE_IN_PAST）→ Task 3 ✔
- テスト（プリセット純関数 + extend ロジック）→ Task 2 / Task 4 ✔
  （スペックの「store extendMarket をモック検証」は、storeモック基盤が無く resolveMarket と同型の薄ラッパのため、同一規則を持つ localClient テストで代替。型整合は `tsc --noEmit` で担保。）

**Placeholder scan:** TBD/TODO 無し。全コード提示済み。

**Type consistency:** `extendMarket(marketId, newDeadlineISO)` の名称・引数は Task 3 宣言／Task 4 case／Task 5 呼び出しで一致。`extendedCount`/`lastExtendedAt`（camel, アプリ層）と `extended_count`/`last_extended_at`（snake, DB/local 層）の使い分けが一貫。例外名 `NOT_CLOSED`/`DEADLINE_IN_PAST` が DB・local・mapRpcError で一致。
