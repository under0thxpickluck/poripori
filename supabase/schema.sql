-- ============================================================================
-- MIRAIX / LIFAI Labs — Supabase schema
-- Paste this whole file into Supabase Studio → SQL Editor → Run.
-- It is idempotent-ish (safe to re-run); it drops & recreates functions/policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- App profile, 1:1 with auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  points        numeric not null default 1000,
  xp            numeric not null default 0,
  role          text   not null default 'user' check (role in ('user','admin')),
  last_bonus    date,
  bonus_streak  int    not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.markets (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  description  text not null default '',
  deadline     timestamptz not null,
  status       text not null default 'pending'
                 check (status in ('pending','open','closed','resolved')),
  q_yes        numeric not null default 0,
  q_no         numeric not null default 0,
  b            numeric not null default 100 check (b > 0),
  resolved     text check (resolved in ('YES','NO')),
  created_by   uuid references public.profiles(id) on delete set null,
  category     text not null default 'AI',
  volume       numeric not null default 0,
  image_url    text,
  created_at   timestamptz not null default now()
);
create index if not exists markets_status_idx on public.markets(status);

create table if not exists public.positions (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  market_id  uuid not null references public.markets(id) on delete cascade,
  yes_shares numeric not null default 0,
  no_shares  numeric not null default 0,
  primary key (user_id, market_id)
);

create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  market_id       uuid not null references public.markets(id) on delete cascade,
  side            text not null check (side in ('YES','NO')),
  action          text not null check (action in ('buy','sell')),
  shares          numeric not null,
  cost            numeric not null,
  price_per_share numeric not null,
  created_at      timestamptz not null default now()
);
create index if not exists trades_market_idx on public.trades(market_id);
create index if not exists trades_user_idx on public.trades(user_id);

create table if not exists public.price_history (
  id         bigint generated always as identity primary key,
  market_id  uuid not null references public.markets(id) on delete cascade,
  t          timestamptz not null default now(),
  yes        numeric not null
);
create index if not exists price_history_market_idx on public.price_history(market_id, t);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_market_idx on public.comments(market_id);

create table if not exists public.ads (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  image_url  text not null default '',
  link_url   text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. LMSR math (immutable helpers)
-- ---------------------------------------------------------------------------
create or replace function public.cost_fn(q_yes numeric, q_no numeric, b numeric)
returns numeric language sql immutable as $$
  select b * ( greatest(q_yes/b, q_no/b)
    + ln( exp(q_yes/b - greatest(q_yes/b, q_no/b))
        + exp(q_no/b  - greatest(q_yes/b, q_no/b)) ) );
$$;

create or replace function public.price_yes(q_yes numeric, q_no numeric, b numeric)
returns numeric language sql immutable as $$
  select exp(q_yes/b - greatest(q_yes/b, q_no/b))
       / ( exp(q_yes/b - greatest(q_yes/b, q_no/b))
         + exp(q_no/b  - greatest(q_yes/b, q_no/b)) );
$$;

-- ---------------------------------------------------------------------------
-- 3. Auto-create a profile when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Server-authoritative actions (atomic; clients call these via RPC)
-- ---------------------------------------------------------------------------

-- BUY ----------------------------------------------------------------------
create or replace function public.buy_shares(p_market_id uuid, p_side text, p_shares numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  m public.markets%rowtype;
  v_uid uuid := auth.uid();
  v_points numeric;
  v_cost numeric;
  v_new_qyes numeric;
  v_new_qno numeric;
  v_new_price numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_side not in ('YES','NO') then raise exception 'BAD_SIDE'; end if;
  if p_shares <= 0 then raise exception 'BAD_SHARES'; end if;

  select * into m from public.markets where id = p_market_id for update; -- row lock
  if not found then raise exception 'MARKET_NOT_FOUND'; end if;
  if m.status <> 'open' then raise exception 'MARKET_NOT_OPEN'; end if;

  v_new_qyes := m.q_yes + (case when p_side='YES' then p_shares else 0 end);
  v_new_qno  := m.q_no  + (case when p_side='NO'  then p_shares else 0 end);
  v_cost := cost_fn(v_new_qyes, v_new_qno, m.b) - cost_fn(m.q_yes, m.q_no, m.b);

  select points into v_points from public.profiles where id = v_uid for update;
  if v_points < v_cost then raise exception 'INSUFFICIENT_POINTS'; end if;

  v_new_price := price_yes(v_new_qyes, v_new_qno, m.b);

  update public.profiles set points = points - v_cost, xp = xp + v_cost where id = v_uid;
  update public.markets
     set q_yes = v_new_qyes, q_no = v_new_qno, volume = volume + v_cost
   where id = p_market_id;

  insert into public.positions (user_id, market_id, yes_shares, no_shares)
  values (v_uid, p_market_id,
          case when p_side='YES' then p_shares else 0 end,
          case when p_side='NO'  then p_shares else 0 end)
  on conflict (user_id, market_id) do update
     set yes_shares = positions.yes_shares + excluded.yes_shares,
         no_shares  = positions.no_shares  + excluded.no_shares;

  insert into public.trades (user_id, market_id, side, action, shares, cost, price_per_share)
  values (v_uid, p_market_id, p_side, 'buy', p_shares, v_cost,
          case when p_shares > 0 then v_cost / p_shares else 0 end);

  insert into public.price_history (market_id, yes) values (p_market_id, v_new_price);

  return v_cost;
end;
$$;

-- SELL ---------------------------------------------------------------------
create or replace function public.sell_shares(p_market_id uuid, p_side text, p_shares numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  m public.markets%rowtype;
  v_uid uuid := auth.uid();
  v_held numeric;
  v_refund numeric;
  v_new_qyes numeric;
  v_new_qno numeric;
  v_new_price numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_side not in ('YES','NO') then raise exception 'BAD_SIDE'; end if;
  if p_shares <= 0 then raise exception 'BAD_SHARES'; end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found then raise exception 'MARKET_NOT_FOUND'; end if;
  if m.status <> 'open' then raise exception 'MARKET_NOT_OPEN'; end if;

  select case when p_side='YES' then yes_shares else no_shares end
    into v_held from public.positions where user_id = v_uid and market_id = p_market_id for update;
  if v_held is null or v_held < p_shares then raise exception 'INSUFFICIENT_SHARES'; end if;

  v_new_qyes := m.q_yes - (case when p_side='YES' then p_shares else 0 end);
  v_new_qno  := m.q_no  - (case when p_side='NO'  then p_shares else 0 end);
  v_refund := cost_fn(m.q_yes, m.q_no, m.b) - cost_fn(v_new_qyes, v_new_qno, m.b);
  v_new_price := price_yes(v_new_qyes, v_new_qno, m.b);

  update public.profiles set points = points + v_refund, xp = xp + v_refund where id = v_uid;
  update public.markets
     set q_yes = v_new_qyes, q_no = v_new_qno, volume = volume + v_refund
   where id = p_market_id;
  update public.positions
     set yes_shares = yes_shares - (case when p_side='YES' then p_shares else 0 end),
         no_shares  = no_shares  - (case when p_side='NO'  then p_shares else 0 end)
   where user_id = v_uid and market_id = p_market_id;

  insert into public.trades (user_id, market_id, side, action, shares, cost, price_per_share)
  values (v_uid, p_market_id, p_side, 'sell', p_shares, v_refund,
          case when p_shares > 0 then v_refund / p_shares else 0 end);

  insert into public.price_history (market_id, yes) values (p_market_id, v_new_price);

  return v_refund;
end;
$$;

-- RESOLVE (admin only) -----------------------------------------------------
create or replace function public.resolve_market(p_market_id uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_result not in ('YES','NO') then raise exception 'BAD_RESULT'; end if;

  -- pay winners: 1 winning share = 1 point
  update public.profiles p
     set points = points + (case when p_result='YES' then pos.yes_shares else pos.no_shares end),
         xp     = xp     + (case when p_result='YES' then pos.yes_shares else pos.no_shares end)
    from public.positions pos
   where pos.market_id = p_market_id and pos.user_id = p.id;

  update public.markets set status='resolved', resolved=p_result where id = p_market_id;
end;
$$;

-- DAILY BONUS --------------------------------------------------------------
create or replace function public.claim_daily_bonus()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_last date;
  v_streak int;
  v_amount numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select last_bonus, bonus_streak into v_last, v_streak from public.profiles where id = v_uid for update;
  if v_last = current_date then
    return json_build_object('claimed', false);
  end if;
  if v_last = current_date - 1 then v_streak := coalesce(v_streak,0) + 1; else v_streak := 1; end if;
  v_amount := 100 + least(v_streak - 1, 6) * 50;
  update public.profiles
     set points = points + v_amount, xp = xp + v_amount,
         last_bonus = current_date, bonus_streak = v_streak
   where id = v_uid;
  return json_build_object('claimed', true, 'amount', v_amount, 'streak', v_streak);
end;
$$;

-- ADMIN: adjust points / role (admin only) --------------------------------
create or replace function public.admin_add_points(p_user uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set points = points + p_amount, xp = xp + greatest(p_amount, 0) where id = p_user;
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if p_role not in ('user','admin') then raise exception 'BAD_ROLE'; end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.markets       enable row level security;
alter table public.positions     enable row level security;
alter table public.trades        enable row level security;
alter table public.price_history enable row level security;
alter table public.comments      enable row level security;
alter table public.ads           enable row level security;

-- Profiles: world-readable (for leaderboard; mask names in the client). No direct writes.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);

-- Markets: everyone sees non-pending; owners/admins also see their pending.
drop policy if exists markets_read on public.markets;
create policy markets_read on public.markets for select using (
  status <> 'pending'
  or created_by = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
-- Users may propose markets only as 'pending'; admins may insert 'open' directly.
drop policy if exists markets_insert on public.markets;
create policy markets_insert on public.markets for insert with check (
  created_by = auth.uid()
  and (
    status = 'pending'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
);
drop policy if exists markets_admin_update on public.markets;
create policy markets_admin_update on public.markets for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists markets_admin_delete on public.markets;
create policy markets_admin_delete on public.markets for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Positions / trades / price_history: world-readable (top holders, activity, charts). Writes via RPC only.
drop policy if exists positions_read on public.positions;
create policy positions_read on public.positions for select using (true);
drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select using (true);
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history for select using (true);

-- Comments: world-readable; authenticated users insert their own.
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (user_id = auth.uid());

-- Ads: everyone reads active ads; admins manage.
drop policy if exists ads_read on public.ads;
create policy ads_read on public.ads for select using (
  active or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists ads_admin_all on public.ads;
create policy ads_admin_all on public.ads for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------------
-- 6. Optional starter markets (no creator). Delete if you seed your own.
-- ---------------------------------------------------------------------------
-- Only seed when the table is completely empty (so re-running this file is safe).
insert into public.markets (question, description, deadline, status, q_yes, q_no, b, category, volume)
select * from (values
  ('ビットコインは2026年末までに$200,000を超えるか？',
   'BTC/USDが2026-12-31時点で$200,000を超えているか。', '2026-12-31T23:59:59Z'::timestamptz, 'open', 140::numeric, 260::numeric, 100::numeric, 'Crypto', 0::numeric),
  ('ChatGPT-5は2026年内にリリースされるか？',
   'OpenAIが次世代モデルを2026-12-31までに一般公開するか。', '2026-12-31T00:00:00Z'::timestamptz, 'open', 240::numeric, 160::numeric, 100::numeric, 'AI', 0::numeric)
) as v(question, description, deadline, status, q_yes, q_no, b, category, volume)
where not exists (select 1 from public.markets);
