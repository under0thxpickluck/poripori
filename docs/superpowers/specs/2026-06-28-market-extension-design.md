# 市場の締切延長／再開（Market Extension）設計

- 日付: 2026-06-28
- ステータス: 承認済み（実装プラン待ち）

## 背景・目的

Polymarket では、締切が来たのに結果がまだ確定していない市場で、運営が締切を後ろ倒しして
取引を再開する「延長（market extension）」が見られる。poripori にも同等の機能を入れて、
締切到来＝即「解決待ちで凍結」ではなく、**管理者が新しい締切を設定して `closed` の市場を
取引可能（`open`）に戻せる**ようにする。

## スコープ

### やること
- `closed`（締切到来・解決待ち）の市場のみを対象に、新しい締切で `open` に戻す
- 延長したことを軽量に記録（回数・最終延長日時）し、市場詳細にバッジ表示
- 管理者が新締切を「プリセット（+1日/+3日/+1週間）＋任意の日時指定」で選べる UI
- 本番（Supabase）とローカル開発（localClient）で同じ挙動

### やらないこと（YAGNI）
- `open` 中の市場の延長（締切前倒し含む）
- `resolved` 市場の巻き戻し・再開（払い戻しの取り消しが必要で危険）
- 理由テキスト付きの監査ログテーブル
- リカーリング市場（毎週自動で立て直す）の自動化

## 重要な前提（既存コードの制約）

スキーマ確認で判明した、設計を縛る事実：

1. **取引ガードは二重条件**。`buy_shares` / `sell_shares`（`supabase/schema.sql`）は
   `status = 'open'` **かつ** `now() < deadline` の両方を要求する。
   → 再開には「`status` を `open` に戻す」と「`deadline` を未来にする」の**両方が必須**。
2. **自動クローズ cron**（`close_expired_markets`）が毎分
   `status='open' and now() >= deadline` を `closed` にする。
   → 新締切が過去/現在だと **1分以内に即再クローズ**される。新締切は厳密に未来であることを強制する。
3. **`seed_initial_price` トリガー**が `closed → open` の遷移で発火し price_history に点を打つ。
   → 再開でチャートが自然に継続する。**追加実装は不要**。

## アーキテクチャ

状態が動く操作はサーバー権威の `security definer` RPC で atomic に行う既存方針
（`buy_shares` / `sell_shares` / `resolve_market`）に合わせ、延長も **RPC `extend_market`** とする。
単なる直接 `update` ではなく RPC にすることで、admin 判定・`closed` 限定・未来締切の強制を
DB 側で保証し、cron 即クローズ事故や二重延長を構造的に防ぐ。

状態遷移: `closed --extend_market--> open`（`pending → open → closed → resolved` の流れに
`closed → open` の逆方向エッジを1本追加する形）。

## コンポーネント別の変更

### 1. DB マイグレーション — `supabase/migrate-007-extend-market.sql`（新規）

列追加（idempotent）:
```sql
alter table public.markets add column if not exists extended_count   int not null default 0;
alter table public.markets add column if not exists last_extended_at timestamptz;
```

RPC:
```sql
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
- `seed_initial_price` が `closed → open` 遷移で自動発火し、price_history に継続点を打つ（追加コード不要）。
- `schema.sql` 本体（再実行用の正本）にも同じ列定義と関数を追記し、migrate と整合させる。

### 2. 型 — `src/types.ts`

`Market` 型に追加:
```ts
extendedCount: number
lastExtendedAt: string | null
```

### 3. ストア — `src/store/useStore.ts`

- `mapMarket`（23行目付近）に `extendedCount: n(m.extended_count)`、
  `lastExtendedAt: m.last_extended_at ?? null` を追加。
- アクション追加:
  ```ts
  extendMarket: (marketId: string, newDeadlineISO: string) => Promise<void>
  ```
  実装は `resolveMarket` と同型: `supabase.rpc('extend_market', { p_market_id, p_new_deadline })`
  → エラー時 `set({ error: mapRpcError(...) })`、成功時 `loadAll(['markets'])`。
- `mapRpcError` に `NOT_CLOSED`（「締切済みの市場のみ延長できます」）、
  `DEADLINE_IN_PAST`（「新しい締切は未来の日時にしてください」）の和訳を追加。

### 4. ローカルクライアント — `src/lib/localClient.ts`

- `rpc()` の switch（432行目付近）に `case 'extend_market'` を追加。
- `extendMarket(marketId, newDeadlineISO)` 関数を `resolveMarket`（534行目）に倣って実装:
  `requireAdmin()` → 市場検索 → `status !== 'closed'` なら `NOT_CLOSED` →
  新締切が `<= Date.now()` なら `DEADLINE_IN_PAST` → `status='open'`, `deadline` 更新,
  `extended_count += 1`, `last_extended_at = now`、`save(db)` + `emit('markets','UPDATE',…)`。
- 本番のトリガー挙動を合わせるため、`closed → open` で price_history に1点 push し
  `emit('price_history','INSERT',…)` する（チャート継続のため）。
- ローカル DB 既存レコードに列が無い場合に備え、読み出し時 `extended_count ?? 0` で吸収する。

### 5. 管理画面 — `src/pages/admin/Markets.tsx`

- `status === 'closed'` の行の操作列に「延長」ボタンを追加（既存の「締切」「解決」と並べる）。
- クリックでインライン UI を開く（`resolving` と同様の行内ステート `extending`）:
  - プリセットボタン: **+1日 / +3日 / +1週間**（基準は `now()`）
  - 任意指定: `datetime-local` 入力 + 確定ボタン
  - キャンセル（×）
- 確定時に `extendMarket(m.id, iso)` を呼ぶ。

### 6. 市場詳細 — `src/pages/MarketDetail.tsx`

- `market.extendedCount > 0` のとき「延長済み ×N」バッジを表示（タイトル/メタ情報の近く）。
  一覧カード（MarketCard）には今回は出さない。

## エラーハンドリング

| 例外 | 条件 | ユーザー向け文言 |
|---|---|---|
| `ADMIN_REQUIRED` | 非管理者 | 管理者権限が必要です（既存） |
| `MARKET_NOT_FOUND` | 市場なし | 対象の市場が見つかりません（既存） |
| `NOT_CLOSED` | `status != 'closed'` | 締切済みの市場のみ延長できます |
| `DEADLINE_IN_PAST` | 新締切が過去/現在 | 新しい締切は未来の日時にしてください |

UI 側でも datetime-local の min を現在時刻にして、過去日時を選びにくくする（DB 強制とは二重）。

## テスト

- **純関数の抽出 + ユニットテスト**: 締切プリセット計算 `addDeadline(base, '1d'|'3d'|'1w')` を
  小さなヘルパに切り出し、`now + N` が正しいか検証（`src/lib/` に置き `*.test.ts`）。
- **store の `extendMarket`**: supabase クライアントをモックし、(a) 正しい RPC 名・引数で呼ぶ、
  (b) 成功時に `loadAll(['markets'])` を呼ぶ、(c) エラー時に `error` state を和訳でセットする、を検証。
- 既存の `lmsr.test.ts` のスタイル（vitest）に合わせる。

## ロールアウト手順

1. `migrate-007-extend-market.sql` を Supabase Studio で実行（列追加＋RPC作成）。
2. フロントをデプロイ。ローカルは `localClient` 経由で同挙動を確認。
