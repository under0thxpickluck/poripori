# Supabase setup

The database is server-authoritative: clients never write balances or shares
directly — they call `security definer` RPCs (`buy_shares`, `sell_shares`,
`resolve_market`, `claim_daily_bonus`, `admin_*`). RLS makes the read-only
tables world-readable and blocks direct writes.

## Apply order

Run these in **Supabase Studio → SQL Editor**, in order. Each file is safe to
re-run (functions/policies are `create or replace` / `drop ... if exists`).

1. `schema.sql` — full canonical schema (tables, LMSR helpers, RPCs, triggers,
   RLS, realtime). A fresh project only needs this file.
2. `migrate-002-admin.sql` — admin RPCs + market insert/delete policies.
3. `migrate-003-realtime.sql` — realtime on `price_history`.
4. `migrate-004-live.sql` — initial price point on open + realtime on `trades`.
5. `migrate-005-deadline-guards.sql` — deadline enforcement in buy/sell, double-
   resolve guard, sell-XP fix, and **automatic close at deadline via pg_cron**.
6. `migrate-006-realtime-sync.sql` — add `markets`/`profiles`/`positions` to the
   realtime publication so prices, balances, payouts and market status update on
   every client without a reload.
7. `migrate-007-extend-market.sql` — market extension (deadline extend/reopen).
8. `migrate-008-comment-guards.sql` — comment length guard (server-side defense-in-depth).
9. `migrate-009-apply-pending.sql` — apply pending (catch-up bundle: 005/007/008).
10. `migrate-010-ep-transfers.sql` — EPクロス連動: profiles連携列 / ep_transfers / 転送RPC（Studio SQL Editorで手動適用）

> `schema.sql` already contains the final version of every function (including
> the 005 changes). The `migrate-00X` files are incremental patches for projects
> that were created before those changes landed. On a brand-new project,
> `schema.sql` alone is sufficient; the migrations are no-ops there.

## pg_cron (automatic market close)

`close_expired_markets()` flips any `open` market past its `deadline` to
`closed`. `migrate-005` (and `schema.sql`) schedule it every minute with
`pg_cron`. If pg_cron isn't enabled yet, the scheduling block raises a notice
instead of failing:

1. Dashboard → **Database → Extensions** → enable **`pg_cron`**.
2. Re-run the `do $$ ... cron.schedule(...) ... $$;` block at the bottom of
   `migrate-005-deadline-guards.sql`.

Verify it's scheduled:

```sql
select jobname, schedule, active from cron.job;
-- expect: close-expired-markets | * * * * * | t
```

The deadline is **also enforced inside `buy_shares`/`sell_shares`** (they raise
`MARKET_CLOSED` once `now() >= deadline`), so trading is blocked the instant the
deadline passes even if the cron tick hasn't run yet.

## Environment

Copy `../.env.example` to `../.env` and fill in the project URL + anon key.
Only the **public** (anon/publishable) key belongs in the frontend.

## Making yourself an admin

After signing in once (magic link), promote your profile from the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
```
