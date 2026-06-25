-- ============================================================================
-- Migration 004 — initial price point on market open + realtime trades feed
-- Run once in Supabase Studio → SQL Editor.
-- ============================================================================

-- When a market becomes 'open', drop an initial price point so the chart has
-- a starting anchor (a flat line at the current price) before any trade.
create or replace function public.seed_initial_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'open' and (TG_OP = 'INSERT' or OLD.status is distinct from 'open') then
    insert into public.price_history (market_id, yes)
    values (NEW.id, price_yes(NEW.q_yes, NEW.q_no, NEW.b));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_seed_initial_price on public.markets;
create trigger trg_seed_initial_price
  after insert or update on public.markets
  for each row execute function public.seed_initial_price();

-- Backfill: give every existing market at least one price point.
insert into public.price_history (market_id, yes)
select m.id, price_yes(m.q_yes, m.q_no, m.b)
from public.markets m
where m.status in ('open', 'closed', 'resolved')
  and not exists (select 1 from public.price_history ph where ph.market_id = m.id);

-- Realtime for the activity feed (live trades).
do $$
begin
  alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null;
end $$;
