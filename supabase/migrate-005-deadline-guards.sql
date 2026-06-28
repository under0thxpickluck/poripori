-- ============================================================================
-- Migration 005 — deadline enforcement, double-resolve guard, sell-XP fix,
--                 and automatic market close at deadline (pg_cron).
-- Run ONCE in Supabase Studio → SQL Editor (after schema.sql / migrate-004).
-- Safe to run on an existing project.
-- ============================================================================

-- 1) BUY: reject trades once the deadline has passed (defense-in-depth even if
--    the auto-close cron lags behind). ----------------------------------------
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

  select * into m from public.markets where id = p_market_id for update;
  if not found then raise exception 'MARKET_NOT_FOUND'; end if;
  if m.status <> 'open' then raise exception 'MARKET_NOT_OPEN'; end if;
  if now() >= m.deadline then raise exception 'MARKET_CLOSED'; end if;

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

-- 2) SELL: reject after deadline, and DO NOT award XP on sell (prevents
--    buy→sell XP farming). ----------------------------------------------------
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
  if now() >= m.deadline then raise exception 'MARKET_CLOSED'; end if;

  select case when p_side='YES' then yes_shares else no_shares end
    into v_held from public.positions where user_id = v_uid and market_id = p_market_id for update;
  if v_held is null or v_held < p_shares then raise exception 'INSUFFICIENT_SHARES'; end if;

  v_new_qyes := m.q_yes - (case when p_side='YES' then p_shares else 0 end);
  v_new_qno  := m.q_no  - (case when p_side='NO'  then p_shares else 0 end);
  v_refund := cost_fn(m.q_yes, m.q_no, m.b) - cost_fn(v_new_qyes, v_new_qno, m.b);
  v_new_price := price_yes(v_new_qyes, v_new_qno, m.b);

  update public.profiles set points = points + v_refund where id = v_uid;
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

-- 3) RESOLVE: guard against resolving a missing or already-resolved market
--    (double payout). ----------------------------------------------------------
create or replace function public.resolve_market(p_market_id uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if; -- NULL-safe（profiles 行が無い認証ユーザーも拒否）
  if p_result not in ('YES','NO') then raise exception 'BAD_RESULT'; end if;

  select status into v_status from public.markets where id = p_market_id for update;
  if v_status is null then raise exception 'MARKET_NOT_FOUND'; end if;
  if v_status = 'resolved' then raise exception 'ALREADY_RESOLVED'; end if;

  update public.profiles p
     set points = points + (case when p_result='YES' then pos.yes_shares else pos.no_shares end),
         xp     = xp     + (case when p_result='YES' then pos.yes_shares else pos.no_shares end)
    from public.positions pos
   where pos.market_id = p_market_id and pos.user_id = p.id;

  update public.markets set status='resolved', resolved=p_result where id = p_market_id;
end;
$$;

-- 4) Auto-close markets whose deadline has passed. ----------------------------
create or replace function public.close_expired_markets()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with closed as (
    update public.markets
       set status = 'closed'
     where status = 'open' and now() >= deadline
    returning id
  )
  select count(*) into v_count from closed;
  return v_count;
end;
$$;

-- Backfill: close anything already past its deadline right now.
select public.close_expired_markets();

-- 5) Schedule the auto-close every minute via pg_cron. ------------------------
-- Requires the pg_cron extension (Supabase: Dashboard → Database → Extensions
-- → enable "pg_cron"). If the block raises a notice, enable pg_cron then re-run
-- just this DO block.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('close-expired-markets')
    where exists (select 1 from cron.job where jobname = 'close-expired-markets');
  perform cron.schedule('close-expired-markets', '* * * * *',
    $cron$ select public.close_expired_markets() $cron$);
exception
  when undefined_table or insufficient_privilege or feature_not_supported then
    raise notice 'pg_cron not available — enable it in the dashboard, then re-run this DO block.';
end $$;
